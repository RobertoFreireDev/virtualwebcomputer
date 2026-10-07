# Virtual-Web-Computer

**Virtual PC** is a personal wiki / notebook for Windows: folders and pages in a
sidebar, rich-text pages with syntax-highlighted code blocks, ASCII diagrams,
tables, and JSON backups.

The whole app is `virtualwebpc.html`, embedded in a small WebView2 desktop
program (`desktop/`). It doesn't run in an ordinary browser: the page is served
only inside the app, from a private origin, under a strict Content Security
Policy. Your data stays in the app's own profile (`%LOCALAPPDATA%\VirtualPC`).

## Requirements

- Windows 10/11 (x64)
- [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0) (to build: the .NET 10 SDK)
- Microsoft Edge WebView2 Runtime (preinstalled on Windows 11)

## Run for development

```powershell
cd desktop
dotnet run                                   # Debug: DevTools on, separate data folder
```

A Debug build keeps its data in `%LOCALAPPDATA%\VirtualPC.Debug`, so a build
with DevTools on never opens your real library. Use Export / Import to try
real pages in it.

## Publish

From the repository root:

```powershell
dotnet publish desktop -c Release -o desktop\publish
```

This produces a single file, `desktop\publish\VirtualPC.exe` (~1.4 MB). Copy it
anywhere and start it; it needs only the .NET 10 Desktop Runtime and the
WebView2 Runtime on the target PC. The Release build stores your library in
`%LOCALAPPDATA%\VirtualPC`, has DevTools off and ignores `WEBVIEW2_*`
environment variables.

The HTML is compiled into the exe, so publish again after changing
`virtualwebpc.html`. Close Virtual PC first if it runs from `desktop\publish`:
a running exe can't be overwritten.

Memory use (host + all WebView2 processes, Task Manager "Memory"): about
73 MB idle and about 82 MB with a typical page open.

## Backups

Exports are the whole library in plain JSON. The Save dialog starts in
Downloads; avoid folders synced to the cloud (OneDrive, …) if the backup
should stay on this computer.

## Moving a library from the browser version

Open the browser-only `virtualwebpc.html` (commit `f6609f7` or earlier) in the browser you used, click
**Export**, then click **Import** in the app and choose **Replace** or **Merge**.

Once the app has it, remove the copy from the browser: any local HTML file
opened in that browser can read it. Delete the folders in the old version, or
open DevTools there → Application → Local Storage and delete
`virtualpc.data.v1`.

## Tests

```powershell
cd test
npm install
npm test
```

See `test/README.md` and `CLAUDE.md` for details.
