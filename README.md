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

## Build and run

```powershell
cd desktop
dotnet run                                   # development (Debug: DevTools on)
dotnet publish -c Release -o publish         # → desktop\publish\VirtualPC.exe (~1.4 MB, single file)
```

Copy `VirtualPC.exe` anywhere and start it. After changing
`virtualwebpc.html`, rebuild: the HTML is compiled into the exe.

Memory use (host + all WebView2 processes, Task Manager "Memory"): about
73 MB idle and about 82 MB with a typical page open.

## Moving a library from the browser version

Open the browser-only `virtualwebpc.html` (commit `f6609f7` or earlier) in the browser you used, click
**Export**, then click **Import** in the app and choose **Replace** or **Merge**.

## Tests

```powershell
cd test
npm install
npm test
```

See `test/README.md` and `CLAUDE.md` for details.
