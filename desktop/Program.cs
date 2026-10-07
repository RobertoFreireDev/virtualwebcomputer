namespace VirtualPC;

static class Program
{
    const string InstanceName = @"Local\VirtualPC.SingleInstance";
    const string ActivateName = @"Local\VirtualPC.Activate";

    [STAThread]
    static void Main()
    {
#if !DEBUG
        // These variables let anything that can set the environment redirect the
        // browser engine, the data folder or attach a debugger. Release builds ignore them.
        foreach (var name in new[] {
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
            "WEBVIEW2_USER_DATA_FOLDER", "WEBVIEW2_RELEASE_CHANNEL_PREFERENCE",
            "WEBVIEW2_PIPE_FOR_SCRIPT_DEBUGGER", "WEBVIEW2_CHANNEL_SEARCH_KIND" })
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
        ThreadPool.RegisterWaitForSingleObject(activate,
            (_, _) => form.BeginInvoke(new Action(form.Reveal)), null, Timeout.Infinite, false);
        Application.Run(form);
    }
}
