namespace VirtualPC;

static class Program
{
    /* Names the data folder (%LOCALAPPDATA%\<Name>) and the single-instance objects.
       A Debug build has DevTools on and honours WEBVIEW2_* (e.g. a remote debugging
       port any browser can attach to), so it never opens the real library. */
#if DEBUG
    internal const string Name = "VirtualPC.Debug";
#else
    internal const string Name = "VirtualPC";
#endif
    const string InstanceName = @"Local\" + Name + ".SingleInstance";
    const string ActivateName = @"Local\" + Name + ".Activate";

    [STAThread]
    static void Main()
    {
#if !DEBUG
        // WEBVIEW2_* variables let anything that can set the environment redirect the
        // browser engine or the data folder, add switches (a debugging port) or attach a
        // script debugger. Release builds ignore every one of them, not just the known ones.
        foreach (string name in Environment.GetEnvironmentVariables().Keys)
            if (name.StartsWith("WEBVIEW2_", StringComparison.OrdinalIgnoreCase))
                Environment.SetEnvironmentVariable(name, null);
#endif
        // One window per user: two would share the same storage and overwrite each other.
        using var instance = new Mutex(true, InstanceName, out var first);
        using var activate = new EventWaitHandle(false, EventResetMode.AutoReset, ActivateName);
        if (!first)
        {
            activate.Set();
            return;
        }

        ApplicationConfiguration.Initialize();
        var form = new MainForm();
        ThreadPool.RegisterWaitForSingleObject(activate, (_, _) => {
            // a launch before the window exists, or while it is closing, would otherwise
            // throw on this pool thread and take the running app down with it
            try { form.BeginInvoke(new Action(form.Reveal)); }
            catch (InvalidOperationException) { }
        }, null, Timeout.Infinite, false);
        Application.Run(form);
    }
}
