using System.Diagnostics;
using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VirtualPC;

/// <summary>
/// The only window: a WebView2 showing virtualwebpc.html, which is embedded in
/// the exe and served from a private origin that never touches the network.
/// The page's localStorage (the whole library) lives in the app's own profile
/// under %LOCALAPPDATA%\VirtualPC, not in any browser the user runs.
/// </summary>
sealed class MainForm : Form
{
    /* .example is reserved (RFC 2606): the name can never belong to a real site.
       Every request to it is answered from memory, so the origin — and with it
       the localStorage key space — stays stable across versions. */
    const string Origin = "https://virtualpc.example/";

    /* Chromium switches that keep the whole app (host + WebView2 processes) under
       100 MB: the GPU work runs inside the browser process instead of a process of
       its own, a single renderer, V8 tuned for size (≈90 MB less on very large
       pages), and none of the background services a single local page doesn't need. */
    const string BrowserArgs =
        "--in-process-gpu --renderer-process-limit=1 --js-flags=--optimize-for-size --disable-background-networking " +
        "--disable-component-update --disable-extensions --disable-sync --no-pings " +
        "--disable-features=msSmartScreenProtection,SpareRendererForSitePerProcess,Translate,msEdgeTranslate,AutofillServerCommunication";

    /* Defence in depth for content pasted into pages: only the app's own inline
       script and styles run, nothing is fetched or framed, images may be embedded
       (data:) or linked over http(s) as before. */
    const string Headers =
        "Content-Type: text/html; charset=utf-8\r\n" +
        "Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
        "img-src data: blob: https: http:; font-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; " +
        "frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'\r\n" +
        "X-Content-Type-Options: nosniff\r\n" +
        "Cache-Control: no-store";

    /* Context-menu entries that would navigate, save the page, or are browser
       chrome; the editing ones (cut/copy/paste, spelling, emoji…) stay. */
    static readonly HashSet<string> HiddenMenuItems = new(StringComparer.OrdinalIgnoreCase) {
        "back", "forward", "reload", "saveAs", "print", "createQrCode", "share", "webCapture",
        "inspectElement", "viewPageSource", "saveLinkAs", "saveImageAs", "saveMediaAs",
        "copyLinkToHighlight", "openLinkInNewWindow", "readAloud", "translate", "addToCollections"
    };

    static readonly byte[] Page = ReadPage();

    readonly WebView2 web = new() {
        Dock = DockStyle.Fill,
        DefaultBackgroundColor = Color.FromArgb(0x0f, 0x13, 0x17)   // --ink, so there is no white flash
    };
    bool closing, closed;

    public MainForm()
    {
        Text = "Virtual PC";
        BackColor = web.DefaultBackgroundColor;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1280, 800);
        MinimumSize = new Size(640, 420);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
        Controls.Add(web);
        Load += async (_, _) => await StartAsync();
        Resize += (_, _) => Trim();
    }

    static byte[] ReadPage()
    {
        using var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("virtualwebpc.html")
            ?? throw new InvalidOperationException("virtualwebpc.html is not embedded");
        using var m = new MemoryStream();
        s.CopyTo(m);
        return m.ToArray();
    }

    async Task StartAsync()
    {
        var dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VirtualPC");
        CoreWebView2Environment env;
        try
        {
            var options = new CoreWebView2EnvironmentOptions(BrowserArgs) {
                AreBrowserExtensionsEnabled = false,
                EnableTrackingPrevention = false   // nothing third-party is ever loaded
            };
            env = await CoreWebView2Environment.CreateAsync(null, dataDir, options);
            await web.EnsureCoreWebView2Async(env);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this,
                "Virtual PC needs the Microsoft Edge WebView2 Runtime, which was not found.\n\n" +
                "Install it from https://go.microsoft.com/fwlink/p/?LinkId=2124703 and start Virtual PC again.",
                "Virtual PC", MessageBoxButtons.OK, MessageBoxIcon.Error);
            closed = true; Close();
            return;
        }

        var core = web.CoreWebView2;
        var s = core.Settings;
#if DEBUG
        s.AreDevToolsEnabled = true;
#else
        s.AreDevToolsEnabled = false;
#endif
        s.AreHostObjectsAllowed = false;
        s.IsStatusBarEnabled = false;
        s.IsPasswordAutosaveEnabled = false;
        s.IsGeneralAutofillEnabled = false;
        s.IsSwipeNavigationEnabled = false;
        s.IsPinchZoomEnabled = false;

        core.AddWebResourceRequestedFilter(Origin + "*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += Serve;
        core.NavigationStarting += (_, e) => {
            if (e.Uri == Origin) return;            // first load and reload (F5)
            e.Cancel = true;
            OpenOutside(e.Uri);                      // a link clicked in a page
        };
        core.FrameNavigationStarting += (_, e) => e.Cancel = true;
        core.NewWindowRequested += (_, e) => { e.Handled = true; OpenOutside(e.Uri); };
        core.PermissionRequested += (_, e) =>
            e.State = e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead
                ? CoreWebView2PermissionState.Allow   // Image / Paste ▾ buttons
                : CoreWebView2PermissionState.Deny;
        core.DownloadStarting += SaveExport;
        core.ContextMenuRequested += (_, e) => TrimMenu(e.MenuItems);
        core.ProcessFailed += (_, e) => {
            if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited
                or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                core.Reload();
        };
        core.DocumentTitleChanged += (_, _) => Text = core.DocumentTitle is { Length: > 0 } t ? t : "Virtual PC";

        core.Navigate(Origin);
    }

    /* the page is the only resource there is */
    void Serve(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var env = web.CoreWebView2.Environment;
        e.Response = e.Request.Uri == Origin && e.Request.Method == "GET"
            ? env.CreateWebResourceResponse(new MemoryStream(Page, false), 200, "OK", Headers)
            : env.CreateWebResourceResponse(null, 404, "Not Found", "Cache-Control: no-store");
    }

    /* Links in pages open in the user's default browser — only web and mail links. */
    static void OpenOutside(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var u)) return;
        if (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeMailto) return;
        try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); }
        catch { /* no handler registered */ }
    }

    /* Export builds a blob and clicks a download link: ask where to save it with
       the Windows dialog instead of the browser's download bubble. Anything that
       isn't the app's own blob (e.g. "Save link as" on an http link) is refused. */
    void SaveExport(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        if (!e.DownloadOperation.Uri.StartsWith("blob:" + Origin, StringComparison.Ordinal))
        {
            e.Cancel = true;
            return;
        }
        var deferral = e.GetDeferral();
        BeginInvoke(() => {
            using (deferral)
            {
                using var dialog = new SaveFileDialog {
                    Title = "Export",
                    FileName = Path.GetFileName(e.ResultFilePath),
                    InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    Filter = "Virtual PC backup (*.json)|*.json|All files (*.*)|*.*",
                    DefaultExt = "json",
                    AddExtension = true,
                    OverwritePrompt = true
                };
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    e.ResultFilePath = dialog.FileName;
                    e.Handled = true;                  // no download bubble
                }
                else e.Cancel = true;
            }
        });
    }

    static void TrimMenu(IList<CoreWebView2ContextMenuItem> items)
    {
        for (var i = items.Count - 1; i >= 0; i--)
            if (HiddenMenuItems.Contains(items[i].Name)) items.RemoveAt(i);
        // no leading, trailing or doubled separators left behind
        for (var i = items.Count - 1; i >= 0; i--)
            if (items[i].Kind == CoreWebView2ContextMenuItemKind.Separator
                && (i == 0 || i == items.Count - 1 || items[i - 1].Kind == CoreWebView2ContextMenuItemKind.Separator))
                items.RemoveAt(i);
    }

    /* minimised: let WebView2 drop caches and page out what it can */
    void Trim()
    {
        if (web.CoreWebView2 is not { } core) return;
        core.MemoryUsageTargetLevel = WindowState == FormWindowState.Minimized
            ? CoreWebView2MemoryUsageTargetLevel.Low
            : CoreWebView2MemoryUsageTargetLevel.Normal;
    }

    /* Bring this window forward when a second copy of the app is started. */
    public void Reveal()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
    }

    /* The page saves 250 ms after each change and on beforeunload; closing the
       window doesn't reliably run beforeunload, so commit and flush first. */
    protected override async void OnFormClosing(FormClosingEventArgs e)
    {
        if (!closed && !closing && web.CoreWebView2 is { } core)
        {
            e.Cancel = true;
            closing = true;
            try { await core.ExecuteScriptAsync("try{ if(mode !== 'view') commit(); flush(); }catch(e){}"); }
            catch { /* the page is gone; nothing left to save */ }
            closed = true;
            Close();
            return;
        }
        base.OnFormClosing(e);
    }
}
