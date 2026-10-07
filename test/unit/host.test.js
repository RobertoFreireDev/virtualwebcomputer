import { describe, it, expect, afterEach } from "vitest";
import { loadApp, sampleTree, KEY } from "../helpers/app.js";

/* The app ships as a Windows program (desktop/, WebView2). The HTML refuses to
   run when it is opened in an ordinary browser: no library is read or written
   and the page only says where to open it. */
let app;
afterEach(() => app && app.close());

describe("inside the desktop app (window.chrome.webview present)", () => {
  it("boots normally", () => {
    app = loadApp();
    expect(app.jsdomErrors).toEqual([]);
    expect(app.rows().length).toBeGreaterThan(0);
    expect(app.$("blocked")).toBeNull();
  });

  it("describes itself as a desktop app on first run", () => {
    app = loadApp();
    const seed = app.seedPage().content;
    expect(seed).not.toMatch(/your browser/i);
    expect(seed).not.toMatch(/browser storage/i);
    expect(seed).toMatch(/on this computer/i);
  });
});

describe("opened in a plain browser", () => {
  it("does not start the app", () => {
    app = loadApp({ host: false });
    expect(app.$("tree")).toBeNull();
    expect(app.$("editor")).toBeNull();
    expect(app.q(".row")).toBeNull();
  });

  it("says to open it with the desktop app", () => {
    app = loadApp({ host: false });
    const msg = app.$("blocked");
    expect(msg).not.toBeNull();
    expect(msg.textContent).toMatch(/Virtual PC desktop app/);
  });

  it("neither reads nor writes the stored library", () => {
    const stored = JSON.stringify({ tree: sampleTree(), selected: "p1" });
    app = loadApp({ host: false, stored });
    app.flush();
    expect(app.window.localStorage.getItem(KEY)).toBe(stored);
    expect(app.document.body.textContent).not.toContain("alpha text");
    expect(app.document.body.textContent).not.toContain("Alpha");
  });

  it("does not seed an empty storage", () => {
    app = loadApp({ host: false });
    app.flush();
    expect(app.window.localStorage.getItem(KEY)).toBeNull();
  });
});
