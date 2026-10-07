import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp, sampleTree, tick } from "../helpers/app.js";
import { click, key, chooseFile, contextmenu } from "../helpers/dom.js";

let app;
const db = () => app.get("db");
const dlg = () => app.$("dialog");
const gl = id => app.row(id).querySelector(".gl");
const ICONS = () => app.get("FOLDER_ICONS");
const KEYS = ["pc", "trash", "book", "star", "clock", "config", "home", "music", "image", "code", "mail", "archive",
  "people", "search", "save", "upload", "download", "browser", "security", "cloud",
  "database", "chart", "calendar", "video", "map", "work", "idea"];
/* the markup as the browser serialises it (`<path/>` → `<path></path>`) */
const norm = s => { const d = app.document.createElement("div"); d.innerHTML = s; return d.innerHTML; };
const pick = k => click(dlg().querySelector(`.icon-grid [data-icon="${k}"]`));

afterEach(() => app.close());

describe("FOLDER_ICONS", () => {
  beforeEach(() => { app = loadApp({ stored: { tree: sampleTree() } }); });

  it("offers 27 folder icons", () => {
    expect(Object.keys(ICONS())).toEqual(KEYS);
    expect(KEYS).toHaveLength(27);
  });

  it("gives every icon its own label and drawing", () => {
    const defs = app.get("FOLDER_ICON_DEFS");
    const labels = KEYS.map(k => defs[k].label), svgs = KEYS.map(k => defs[k].svg);
    labels.forEach((l, i) => expect(l.trim(), KEYS[i]).not.toBe(""));
    expect(new Set(labels).size).toBe(KEYS.length);
    expect(new Set(svgs).size).toBe(KEYS.length);
  });

  it("draws every icon in the same style as the folder and page glyphs", () => {
    for (const k of KEYS) {
      const svg = new app.window.DOMParser().parseFromString(ICONS()[k], "image/svg+xml").documentElement;
      expect(svg.getAttribute("width"), k).toBe("14");
      expect(svg.getAttribute("height"), k).toBe("14");
      expect(svg.getAttribute("viewBox"), k).toBe("0 0 16 16");
      expect(svg.getAttribute("fill"), k).toBe("none");
      expect(svg.getAttribute("stroke"), k).toBe("currentColor");
      expect(svg.getAttribute("stroke-width"), k).toBe("1.4");
      expect(svg.children.length, k).toBeGreaterThan(0);
    }
  });

  it("leaves the default folder and page glyphs untouched", () => {
    expect(app.get("ICON").folder).toContain("M1.8 4.2c0-.66.54-1.2 1.2-1.2h3l1.5 1.8h5.7");
    expect(app.get("ICON").page).toContain("M9 1.8H4.2");
  });
});

describe("glyph()", () => {
  beforeEach(() => { app = loadApp({ stored: { tree: sampleTree() } }); });

  it("uses the default folder icon when there is no icon, an empty one or an unknown one", () => {
    const folder = app.get("ICON").folder;
    expect(app.call("glyph", { type: "folder" })).toBe(folder);
    expect(app.call("glyph", { type: "folder", icon: "" })).toBe(folder);
    expect(app.call("glyph", { type: "folder", icon: "rocket-from-the-future" })).toBe(folder);
    expect(app.call("glyph", { type: "folder", icon: "toString" })).toBe(folder);
    expect(app.call("glyph", { type: "folder", icon: 42 })).toBe(folder);
  });

  it("uses the chosen icon for a folder", () => {
    expect(app.call("glyph", { type: "folder", icon: "star" })).toBe(ICONS().star);
  });

  it("never changes page icons", () => {
    expect(app.call("glyph", { type: "page", icon: "star" })).toBe(app.get("ICON").page);
  });
});

describe("tree rows", () => {
  it("render a folder's chosen icon and the default for the rest", () => {
    const tree = sampleTree(); tree[0].icon = "book";
    app = loadApp({ stored: { tree } });
    expect(gl("f1").innerHTML).toBe(norm(ICONS().book));
    expect(gl("f3").innerHTML).toBe(norm(app.get("ICON").folder));
    expect(gl("p1").innerHTML).toBe(norm(app.get("ICON").page));
  });

  it("mark folder icons as clickable, page icons not", () => {
    app = loadApp({ stored: { tree: sampleTree() } });
    expect(gl("f1").title).toBe("Change icon");
    expect(gl("p1").title).toBe("");
  });

  it("give a new folder the default icon and no stored icon field", () => {
    app = loadApp({ stored: { tree: sampleTree() } });
    app.call("addFolder");
    const n = db().tree.at(-1);
    expect("icon" in n).toBe(false);
    app.$("tree").querySelector(".label[contenteditable=true]")?.blur();
    expect(gl(n.id).innerHTML).toBe(norm(app.get("ICON").folder));
  });
});

describe("icon picker", () => {
  beforeEach(() => { app = loadApp({ stored: { tree: sampleTree(), selected: "p1" } }); });

  it("opens when the folder icon is clicked, without toggling the folder", () => {
    click(gl("f1"));
    expect(app.dialogOpen()).toBe(true);
    expect(dlg().querySelector("h3").textContent).toBe("Folder icon");
    expect(app.call("find", "f1").node.open).toBe(true);
    expect(db().selected).toBe("f1");
  });

  it("does nothing special when a page icon is clicked", () => {
    click(gl("p3"));
    expect(app.dialogOpen()).toBe(false);
    expect(app.get("openId")).toBe("p3");
  });

  it("lists Default plus the 27 icons, marking the current one", () => {
    click(gl("f1"));
    const btns = [...dlg().querySelectorAll(".icon-grid [data-icon]")];
    expect(btns.map(b => b.dataset.icon)).toEqual(["", ...KEYS]);
    expect(btns[0].innerHTML).toContain(norm(app.get("ICON").folder));
    expect(btns[1].innerHTML).toContain(norm(ICONS().pc));
    expect(btns.filter(b => b.classList.contains("on")).map(b => b.dataset.icon)).toEqual([""]);
    for (const b of btns) expect(b.title).not.toBe("");
  });

  it("saves the chosen icon to the node and to storage, and redraws the row", () => {
    click(gl("f1"));
    pick("star");
    expect(app.dialogOpen()).toBe(false);
    expect(app.call("find", "f1").node.icon).toBe("star");
    expect(gl("f1").innerHTML).toBe(norm(ICONS().star));
    app.flush();
    expect(app.stored().tree[0].icon).toBe("star");
  });

  it("marks the current icon when reopened", () => {
    click(gl("f1")); pick("clock");
    click(gl("f1"));
    const on = [...dlg().querySelectorAll(".icon-grid .on")].map(b => b.dataset.icon);
    expect(on).toEqual(["clock"]);
  });

  it("Default removes the stored field", () => {
    click(gl("f1")); pick("trash");
    click(gl("f1")); pick("");
    expect("icon" in app.call("find", "f1").node).toBe(false);
    expect(gl("f1").innerHTML).toBe(norm(app.get("ICON").folder));
    app.flush();
    expect("icon" in app.stored().tree[0]).toBe(false);
  });

  it("Cancel and Escape leave the icon alone", () => {
    click(gl("f1")); pick("pc");
    click(gl("f1"));
    click(dlg().querySelector('[data-a="0"]'));
    expect(app.dialogOpen()).toBe(false);
    click(gl("f1"));
    key(app.document, "Escape");
    expect(app.dialogOpen()).toBe(false);
    expect(app.call("find", "f1").node.icon).toBe("pc");
  });

  it("works for nested folders", () => {
    db().tree[0].children[1].open = true; app.call("renderTree");
    click(gl("f2")); pick("music");
    expect(app.call("find", "f2").node.icon).toBe("music");
  });

  it("is offered from the folder context menu too", () => {
    contextmenu(app.row("f3"));
    const item = [...app.qa("#menu button")].find(b => b.textContent === "Change icon");
    expect(item).toBeTruthy();
    click(item);
    pick("home");
    expect(app.call("find", "f3").node.icon).toBe("home");
  });
});

describe("dialogs show the chosen folder icon", () => {
  it("in the delete confirmation and the export picker", async () => {
    const tree = sampleTree(); tree[0].children[1].icon = "archive"; tree[0].icon = "pc";
    app = loadApp({ stored: { tree } });
    app.call("remove", "f1");
    expect(dlg().querySelector(".pick-tree.ro").innerHTML).toContain(norm(ICONS().archive));
    key(app.document, "Escape");
    click(app.$("btnExport")); await tick();
    expect(dlg().querySelector('.pick-tree input[data-id="f1"]').nextElementSibling.innerHTML).toBe(norm(ICONS().pc));
  });
});

describe("backwards compatibility", () => {
  it("loads old data without icon fields unchanged and never adds one", () => {
    const old = sampleTree();
    app = loadApp({ stored: { tree: old, selected: "p1", navWidth: 300, navOpen: true } });
    for (const id of ["f1", "f2", "f3"]) expect(app.call("find", id).node.icon).toBeUndefined();
    app.call("save"); app.flush();
    expect(app.stored().tree).toEqual(old);
  });

  it("exports the icon and imports it back", async () => {
    const tree = sampleTree(); tree[0].icon = "code";
    app = loadApp({ stored: { tree } });
    click(app.$("btnExport")); await tick();
    click(dlg().querySelector('[data-a="1"]')); await tick();
    const payload = JSON.parse(app.downloads[0].text);
    expect(payload.version).toBe(1);
    expect(payload.tree[0].icon).toBe("code");
    expect("icon" in payload.tree[2]).toBe(false);
    chooseFile(app.$("file"), { text: app.downloads[0].text }); await tick();
    click(dlg().querySelector('[data-a="1"]')); await tick();
    click(dlg().querySelector('[data-v="replace"]')); await tick();
    expect(db().tree[0].icon).toBe("code");
    expect("icon" in db().tree[2]).toBe(false);
  });

  it("normalize() keeps known icons, drops unknown or invalid ones and ignores icons on pages", () => {
    app = loadApp({ stored: { tree: sampleTree() } });
    const out = app.call("normalize", [
      { type: "folder", name: "A", icon: "star", children: [] },
      { type: "folder", name: "B", icon: "nope", children: [] },
      { type: "folder", name: "C", icon: { x: 1 }, children: [] },
      { type: "folder", name: "D", children: [] },
      { type: "page", name: "E", icon: "star", content: "" }
    ]);
    expect(out[0].icon).toBe("star");
    for (const n of out.slice(1)) expect("icon" in n).toBe(false);
  });

  it("imports an old backup (no icons) with default icons", async () => {
    app = loadApp({ stored: { tree: [] } });
    chooseFile(app.$("file"), { text: JSON.stringify({ app: "virtualpc", version: 1, tree: sampleTree() }) }); await tick();
    click(dlg().querySelector('[data-a="1"]')); await tick();
    click(dlg().querySelector('[data-v="replace"]')); await tick();
    let any = false; app.call("each", n => { if ("icon" in n) any = true; });
    expect(any).toBe(false);
    expect(gl(db().tree[0].id).innerHTML).toBe(norm(app.get("ICON").folder));
  });
});
