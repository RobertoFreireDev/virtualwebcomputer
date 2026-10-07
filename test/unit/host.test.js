import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { loadApp, sampleTree, KEY, html } from "../helpers/app.js";

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

/* desktop/MainForm.cs serves the page with `script-src 'sha256-…'` (the hash of
   its one inline script, computed at startup) instead of 'unsafe-inline', so an
   injected handler, <script> or javascript: URL never runs. JSDOM ignores CSP:
   these pin what the policy relies on, or the app would break only in the exe. */
describe("Content Security Policy contract", () => {
  const sha = s => createHash("sha256").update(s, "utf8").digest("base64");

  it("has exactly one inline <script>, without attributes", () => {
    expect(html.match(/<script\b/gi)).toEqual(["<script"]);
    expect(html.match(/<\/script\b/gi)).toHaveLength(1);
    expect(html).toContain("<script>");
  });

  it("hashes the script the way the HTML parser hands it to the browser (CRLF → LF)", () => {
    app = loadApp();
    const start = html.indexOf("<script>") + "<script>".length, end = html.indexOf("</script>");
    const hostSide = html.slice(start, end).replace(/\r\n?/g, "\n");   // what MainForm.ScriptHash() hashes
    const parsed = app.document.querySelector("script").textContent;
    expect(sha(hostSide)).toBe(sha(parsed));
  });

  it("uses no inline event-handler attributes, in the markup or in generated HTML", () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*["'`]/i);
    app = loadApp({ stored: JSON.stringify({ tree: sampleTree(), selected: "p1" }) });
    const withHandler = [...app.document.querySelectorAll("*")]
      .filter(el => [...el.attributes].some(a => /^on/i.test(a.name)));
    expect(withHandler).toEqual([]);
  });
});
