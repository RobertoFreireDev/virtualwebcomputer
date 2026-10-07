/*
 * The "Diagram" code block language: ASCII / Unicode art (boxes, arrows, groups, ER
 * cards, sequence diagrams, folder trees, outlines, ASCII tables) is drawn as a vector
 * picture in view mode. The stored block stays <pre class="code" data-lang="diagram">…text…</pre>;
 * the drawing lives in the viewer DOM only.
 *
 * Fixtures F1–F12 are the acceptance corpus from DIAGRAM_CODEBLOCK_SPEC.md — kept as arrays
 * of lines so the column alignment is byte-for-byte.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp, sampleTree, tick } from "../helpers/app.js";
import { click, change } from "../helpers/dom.js";

const CW = 8, CH = 17;

const F1 = [
  "+--------+      +---------+      +----------+",
  "| Client | ---> | API     | ---> | Database |",
  "+--------+      +---------+      +----------+",
  "                     |",
  "                     v",
  "                +---------+",
  "                | Cache   |",
  "                +---------+"
].join("\n");

const F2 = [
  "┌─ Backend ──────────────────────────┐",
  "│                                    │",
  "│  ┌──────────┐      ┌────────────┐  │",
  "│  │ Auth     │─────►│ Users DB   │  │",
  "│  └──────────┘      └────────────┘  │",
  "│                                    │",
  "└────────────────────────────────────┘"
].join("\n");

const F3 = [
  "┌──────────────┐          ┌──────────────┐",
  "│ customers    │          │ orders       │",
  "├──────────────┤ 1      * ├──────────────┤",
  "│ id (PK)      │──────────│ id (PK)      │",
  "│ name         │          │ customer_id  │",
  "└──────────────┘          └──────────────┘"
].join("\n");

const F4 = [
  "my-app/",
  "├── src/",
  "│   ├── components/",
  "│   │   └── Button.tsx",
  "│   └── index.ts      # entry point",
  "├── package.json",
  "└── README.md"
].join("\n");

const F5 = [
  "project",
  "|-- docs",
  "|   `-- guide.md",
  "+-- tests",
  "    \\-- app.test.js"
].join("\n");

const F6 = [
  "Browser            Server             DB",
  "   |                  |                |",
  "   |  GET /orders     |                |",
  "   |----------------->|                |",
  "   |                  |  SELECT ...    |",
  "   |                  |--------------->|",
  "   |                  |<---------------|",
  "   |<-----------------|                |"
].join("\n");

const F7 = [
  "User Request",
  "     │",
  "     ▼",
  "┌─────────────┐",
  "│ Load Balancer│",
  "└─────────────┘",
  "     │",
  "     ├──────────────┐",
  "     ▼              ▼",
  "┌─────────┐    ┌─────────┐",
  "│ App #1  │    │ App #2  │",
  "└─────────┘    └─────────┘"
].join("\n");

const F8 = [
  "        +-------+",
  "        | Start |",
  "        +-------+",
  "            |",
  "            v",
  "           / \\",
  "          /   \\",
  "         < ok? >---no---> [ Retry ]",
  "          \\   /",
  "           \\ /",
  "            |",
  "           yes",
  "            |",
  "            v",
  "        +------+",
  "        | Done |",
  "        +------+"
].join("\n");

const F9 = [
  "+----+-------+--------+",
  "| id | name  | role   |",
  "+----+-------+--------+",
  "| 1  | Ana   | admin  |",
  "| 2  | Bruno | editor |",
  "+----+-------+--------+"
].join("\n");

const F10 = [
  "Order",
  "  Customer",
  "    name",
  "    email",
  "  Items[]",
  "    Product",
  "    quantity"
].join("\n");

const F11 = [
  "┌────────────┐",
  "│ 📁 docs    │",
  "└────────────┘"
].join("\n");

const F12 = "Use e-mail and/or chat (v1.2) for server a | b => ok.";

/* F13 — ER cards side by side, crow's feet (───<│ / │>───) on the "many" side */
const F13 = [
  "┌───────────────┐        ┌────────────────┐        ┌───────────────┐",
  "│ PLAYER        │        │ INVENTORY      │        │ ITEM          │",
  "├───────────────┤        ├────────────────┤        ├───────────────┤",
  "│ PK id         │ 1    * │ PK id          │ *    1 │ PK id         │",
  "│    name       │───────<│ FK player_id   │>───────│    name       │",
  "│    level      │        │ FK item_id     │        │    rarity     │",
  "│    created_at │        │    quantity    │        │    value      │",
  "└───────────────┘        └────────────────┘        └───────────────┘"
].join("\n");

/* F14 — four levels of nested frames inside a double-line outer frame */
const F14 = [
  "╔══════════════════════════════════════════════╗",
  "║ Cloud                                        ║",
  "║  ┌────────────────────────────────────────┐  ║",
  "║  │ VPC                                    │  ║",
  "║  │  ┌──────────────┐   ┌──────────────┐   │  ║",
  "║  │  │ Public       │   │ Private      │   │  ║",
  "║  │  │  ┌────────┐  │   │  ┌────────┐  │   │  ║",
  "║  │  │  │ Web    │──┼──►│  │ App    │  │   │  ║",
  "║  │  │  └────────┘  │   │  └───┬────┘  │   │  ║",
  "║  │  └──────────────┘   │      ▼       │   │  ║",
  "║  │                     │  ┌────────┐  │   │  ║",
  "║  │                     │  │ DB     │  │   │  ║",
  "║  │                     │  └────────┘  │   │  ║",
  "║  │                     └──────────────┘   │  ║",
  "║  └────────────────────────────────────────┘  ║",
  "╚══════════════════════════════════════════════╝"
].join("\n");

let app;
beforeEach(() => { app = loadApp({ stored: { tree: sampleTree(), selected: "p1" } }); });
afterEach(() => app.close());

/* ── pure-data helpers ── */
const norm = t => [...app.call("dgNormalize", t)];
const kind = t => app.call("dgKind", app.call("dgNormalize", t));
const grid = t => app.call("dgGrid", app.call("dgNormalize", t));
const scan = t => app.call("dgScan", grid(t));
const model = t => { const g = grid(t); return app.call("dgModel", g, app.call("dgScan", g)); };
const graphic = t => scan(t).flat().filter(Boolean).length;
const heads = (m, dir) => m.heads.filter(h => h.dir === dir).length;
const texts = m => m.texts.map(t => t.text);
const text = (m, s) => m.texts.find(t => t.text === s);
const segs = (m, k) => m.segs.filter(s => s.kind === k);
/* {name: [children]} / "name" — the shape of a dgTree() result */
const shape = nodes => [...nodes].map(n => n.children.length ? { [n.name]: shape(n.children) } : n.name);

/* ── view-mode helpers ── */
const block = (t, lang = "diagram") => `<pre class="code" data-lang="${lang}">${app.call("esc", t)}</pre>`;
function show(html) { app.set("raw", html); app.call("render"); return app.qa("#viewer .code-wrap"); }
const css = () => app.document.querySelector("style").textContent.replace(/\s+/g, " ");

describe("plumbing: the Diagram language", () => {
  it("is a LANGS entry right after plain, labelled Diagram, without a highlighter", () => {
    const LANGS = app.get("LANGS");
    expect(Object.keys(LANGS).slice(0, 2)).toEqual(["plain", "diagram"]);
    expect(LANGS.diagram.label).toBe("Diagram");
    expect(LANGS.diagram.re).toBeUndefined();
    expect(LANGS.diagram.fmt).toBe(app.get("fmtDiagram"));
    expect(app.call("highlight", "+--+ <b>", "diagram")).toBe("+--+ &lt;b&gt;");
  });

  it("appears second in the block header's language select", () => {
    const opts = [...app.call("makeHead").querySelectorAll("option")];
    expect([opts[1].value, opts[1].textContent]).toEqual(["diagram", "Diagram"]);
  });

  it("choosing it in the header sets data-lang=diagram and saves", () => {
    app.call("open", "p3");
    app.call("setMode", "edit");
    const sel = app.$("blocks").children[0].querySelector("select");
    sel.value = "diagram"; change(sel);
    expect(app.q("#editor pre.code").dataset.lang).toBe("diagram");
    expect(app.call("find", "p3").node.content).toContain('data-lang="diagram"');
    expect(app.$("status").textContent).toBe("Saved");
  });

  it("clean() keeps data-lang=diagram and never lets SVG markup through", () => {
    expect(app.call("clean", '<pre class="code" data-lang="diagram">a</pre>')).toBe('<pre class="code" data-lang="diagram">a</pre>');
    expect(app.call("clean", '<p>x</p><svg class="dg-svg"><text class="dg-t">t</text></svg>')).not.toMatch(/<svg|<text|dg-/);
  });

  it("turns wrapping off for diagram blocks so columns stay aligned", () => {
    expect(css()).toContain('.body pre.code[data-lang="diagram"]{white-space:pre;overflow-x:auto}');
  });
});

describe("fmtDiagram (Format button)", () => {
  const fmt = t => app.call("fmtDiagram", t);

  it("expands tabs to 4-column stops, strips the common indent and trailing space, keeps columns", () => {
    expect(fmt("    a\tb\n      c   ")).toBe("a   b\n  c");
    expect(fmt("\t+--+\n\t|  |\n\t+--+")).toBe("+--+\n|  |\n+--+");
    expect(fmt("ab\tc")).toBe("ab  c");
  });

  it("drops leading/trailing blank lines, CR, BOM and zero-width spaces, maps NBSP to a space", () => {
    expect(fmt("﻿\r\n\r\n  a b​\r\n  c\r\n\r\n")).toBe("a b\nc");
  });

  it("is idempotent", () => {
    for (const f of [F1, F2, F4, F8]) expect(fmt(fmt(f))).toBe(fmt(f));
  });

  it("throws 'empty diagram' for empty input", () => {
    expect(() => fmt("  \n\t\n")).toThrow("empty diagram");
  });

  it("the Format button re-indents a diagram block, and toasts on an empty one", () => {
    app.call("open", "p3");
    app.call("setMode", "edit");
    const pre = app.q("#editor pre.code");
    pre.dataset.lang = "diagram"; pre.textContent = "    +--+\n\t|  |";
    app.call("syncBlocks");
    click(app.$("blocks").children[0].querySelector(".fmt"));
    expect(pre.textContent).toBe("+--+\n|  |\n");
    pre.textContent = "   \n";
    click(app.$("blocks").children[0].querySelector(".fmt"));
    expect(app.toastText()).toBe("Can't format: empty diagram");
  });
});

describe("normalize, width and grid", () => {
  it("dgWidth: wide/emoji = 2, combining marks and joiners = 0, box drawing = 1", () => {
    const w = ch => app.call("dgWidth", ch);
    expect([w("a"), w("─"), w("▶"), w("→"), w("中"), w("📁"), w("́"), w("‍"), w("️")]).toEqual([1, 1, 1, 1, 2, 2, 0, 0, 0]);
  });

  it("dgNormalize returns the cleaned lines", () => {
    expect(norm("\n\n   x\t|\n    y\n\n")).toEqual(["x    |", " y"]);   // the tab stop is at column 8 of the original line
  });

  it("dgGrid: a wide character takes its cell plus a continuation cell", () => {
    const g = grid(F11);
    expect([g.rows, g.cols]).toEqual([3, 14]);
    expect(g.at(1, 2)).toBe("📁");
    expect(g.at(1, 3)).toBe("");
    expect(g.at(1, 13)).toBe("│");
    expect(g.at(9, 9)).toBe(" ");
  });

  it("dgGrid folds combining marks into the previous cell", () => {
    const g = grid("éx");
    expect(g.cols).toBe(2);
    expect(g.at(0, 0)).toBe("é");
    expect(g.at(0, 1)).toBe("x");
  });
});

describe("dgKind / dgLooks", () => {
  it("classifies every fixture", () => {
    expect([F1, F2, F3, F6, F7, F8, F11].map(kind)).toEqual(Array(7).fill("grid"));
    expect([kind(F4), kind(F5)]).toEqual(["tree", "tree"]);
    expect(kind(F9)).toBe("table");
    expect(kind("| a | b |\n|---|---|\n| 1 | 2 |")).toBe("table");
    expect(kind(F10)).toBe("outline");
    expect(kind("- a\n  - b\n  - c")).toBe("outline");
    expect(kind(F12)).toBe("text");
  });

  it("stacked boxes joined by a | are a grid, not a table", () => {
    expect(kind("+-----+\n|  A  |\n+-----+\n   |\n+-----+\n|  B  |\n+-----+")).toBe("grid");
  });

  it("F13/F14: cards side by side and nested frames are grids, not tables", () => {
    expect([kind(F13), kind(F14)]).toEqual(["grid", "grid"]);
    expect([F13, F14].every(t => app.call("dgLooks", t))).toBe(true);
    expect(app.call("dgRender", F14).el.querySelector("svg.dg-svg")).not.toBeNull();
  });

  it("a table is one rectangle: gap-free borders, every bar on a border junction column", () => {
    expect(kind("┌────┬────┐\n│ a  │ b  │\n├────┼────┤\n│ 1  │ 2  │\n└────┴────┘")).toBe("table");
    expect(kind("+---+   +---+\n| a |   | b |\n+---+   +---+\n| 1 |   | 2 |\n+---+   +---+")).toBe("grid");
    expect(kind("+-------+\n| a     |\n| +---+ |\n| | b | |\n| +---+ |\n+-------+")).toBe("grid");
  });

  it("dgLooks is strict: trees, boxes, arrowheads or 3+ box-drawing characters", () => {
    const looks = t => app.call("dgLooks", t);
    expect([F1, F2, F3, F4, F5, F6, F7, F8, F11].every(looks)).toBe(true);
    expect([F9, F10, F12].some(looks)).toBe(false);
    expect(looks("for (let i = 0; i < n; i++) {\n  p->next = a[i] - b;\n  f(x => x + 1);\n}")).toBe(false);
    expect(looks("// ---------- section ----------\nx = y;")).toBe(false);
    expect(looks("")).toBe(false);
  });
});

describe("dgTree — trees and outlines", () => {
  it("F4: unicode folder tree with a note", () => {
    const t = app.call("dgTree", norm(F4));
    expect(shape(t)).toEqual([{ "my-app": [{ src: [{ components: ["Button.tsx"] }, "index.ts"] }, "package.json", "README.md"] }]);
    expect(t[0].folder).toBe(true);
    const src = t[0].children[0];
    expect([src.folder, src.children[0].folder, src.children[1].folder]).toEqual([true, true, false]);
    expect(src.children[1].note).toBe("entry point");
    expect(src.children[1].name).toBe("index.ts");
  });

  it("F5: ASCII markers (|-- `-- +-- \\--)", () => {
    expect(shape(app.call("dgTree", norm(F5)))).toEqual([{ project: [{ docs: ["guide.md"] }, { tests: ["app.test.js"] }] }]);
  });

  it("tolerates 2- and 3-column steps and other note styles", () => {
    const t = app.call("dgTree", norm("root/\n├─ a/\n│  └─ b.txt   <- the file\n└─ c   // last"));
    expect(shape(t)).toEqual([{ root: [{ a: ["b.txt"] }, "c"] }]);
    expect(t[0].children[0].children[0].note).toBe("the file");
    expect(t[0].children[1].note).toBe("last");
  });

  it("F10: outline from indentation; bullets are stripped", () => {
    expect(shape(app.call("dgTree", norm(F10)))).toEqual([{ Order: [{ Customer: ["name", "email"] }, { "Items[]": ["Product", "quantity"] }] }]);
    expect(shape(app.call("dgTree", norm("- a\n  * b\n  • c")))).toEqual([{ a: ["b", "c"] }]);
  });

  it("renders folders as <details open> and files as .dg-file, notes muted", () => {
    const r = app.call("dgRender", F4);
    expect(r.kind).toBe("tree");
    const ul = r.el.querySelector("ul.dg-tree");
    expect(ul).not.toBeNull();
    const details = [...r.el.querySelectorAll("details")];
    expect(details.map(d => d.hasAttribute("open"))).toEqual([true, true, true]);
    expect(details.map(d => d.querySelector("summary").firstChild.textContent)).toEqual(["my-app", "src", "components"]);
    expect([...r.el.querySelectorAll(".dg-file")].map(e => e.textContent)).toEqual(["Button.tsx", "index.ts", "package.json", "README.md"]);
    expect(r.el.querySelector(".dg-note").textContent).toBe("entry point");
  });

  it("outline uses the same UI", () => {
    const r = app.call("dgRender", F10);
    expect(r.kind).toBe("outline");
    expect([...r.el.querySelectorAll("summary")].map(s => s.textContent)).toEqual(["Order", "Customer", "Items[]"]);
  });

  it("names are text, never markup", () => {
    const r = app.call("dgRender", "<img src=x onerror=alert(1)>\n├── <b>a</b>\n└── b");
    expect(r.el.querySelector("img,b")).toBeNull();
    expect(r.el.textContent).toContain("<b>a</b>");
  });
});

describe("table kind", () => {
  it("F9 renders a normal <table> with a header and two body rows", () => {
    const r = app.call("dgRender", F9);
    expect(r.kind).toBe("table");
    const t = r.el.querySelector("table");
    expect([...t.querySelectorAll("thead th")].map(e => e.textContent)).toEqual(["id", "name", "role"]);
    expect(t.querySelectorAll("tbody tr")).toHaveLength(2);
    expect([...t.querySelectorAll("tbody td")].map(e => e.textContent)).toEqual(["1", "Ana", "admin", "2", "Bruno", "editor"]);
  });

  it("cell text is sanitised", () => {
    const r = app.call("dgRender", "+-----+\n| <img src=x onerror=1> |\n+-----+\n| a |\n+-----+");
    expect(r.el.querySelector("img")).toBeNull();
  });
});

describe("grid scan + model", () => {
  it("F1 boxes and arrows: 4 boxes, heads 2×e 1×s, texts, the | snaps to the API box", () => {
    const m = model(F1);
    expect(m.boxes).toHaveLength(4);
    expect([heads(m, "e"), heads(m, "s")]).toEqual([2, 1]);
    for (const s of ["Client", "API", "Database", "Cache"]) expect(texts(m)).toContain(s);
    const v = segs(m, "v").find(s => s.x1 === 21 * CW + CW / 2);
    expect(v).toBeDefined();
    expect(Math.min(v.y1, v.y2)).toBe(2 * CH + CH / 2);          // reaches the centre of the API box's bottom border
    expect(m.boxes.every(b => b.depth === 0)).toBe(true);
  });

  it("F2 nested group with its title in the border", () => {
    const m = model(F2);
    expect(m.boxes).toHaveLength(3);
    const outer = m.boxes.find(b => b.title === "Backend");
    expect(outer).toBeDefined();
    expect([outer.group, outer.depth]).toEqual([true, 0]);
    expect(m.boxes.filter(b => b !== outer).map(b => b.depth)).toEqual([1, 1]);
    expect(heads(m, "e")).toBe(1);
    expect(m.heads).toHaveLength(1);
    expect(text(m, "Backend").title).toBe(true);
    /* the border is drawn with a gap where the title is */
    const top = segs(m, "h").filter(s => s.y1 === CH / 2);
    expect(top.length).toBe(2);
  });

  it("F3 ER cards: one divider each, bold headers, 1 relationship line, 1 and * stay text", () => {
    const m = model(F3);
    expect(m.boxes).toHaveLength(2);
    expect(m.boxes.map(b => [...b.dividers])).toEqual([[2], [2]]);
    expect(text(m, "customers").hd).toBe(true);
    expect(text(m, "orders").hd).toBe(true);
    expect(text(m, "name").hd).toBe(false);
    const rel = segs(m, "h").filter(s => s.y1 === 3 * CH + CH / 2);
    expect(rel).toHaveLength(1);
    expect([rel[0].x1, rel[0].x2]).toEqual([15 * CW + CW / 2, 26 * CW + CW / 2]);
    expect(texts(m)).toContain("1");
    expect(texts(m)).toContain("*");
    expect(m.dots).toHaveLength(0);
    expect(m.heads).toHaveLength(0);
  });

  it("F13 ER crow's feet: ───<│ and │>─── fan out at the box side, the line reaches the box", () => {
    const m = model(F13);
    expect(m.boxes).toHaveLength(3);
    expect(m.boxes.map(b => [...b.dividers])).toEqual([[2], [2], [2]]);
    expect(["PLAYER", "INVENTORY", "ITEM"].map(s => text(m, s).hd)).toEqual([true, true, true]);
    expect(texts(m)).not.toContain("<");
    expect(texts(m)).not.toContain(">");
    expect(texts(m)).toContain("1");
    expect(texts(m)).toContain("*");
    expect(m.heads).toHaveLength(0);
    expect(m.feet.map(f => [f.r, f.c, f.dir])).toEqual([[4, 24, "e"], [4, 43, "w"]]);
    const rel = segs(m, "h").filter(s => s.y1 === 4 * CH + CH / 2).map(s => [s.x1, s.x2]);
    expect(rel).toEqual([[16 * CW + CW / 2, 25 * CW + CW / 2], [42 * CW + CW / 2, 51 * CW + CW / 2]]);
    /* the three prongs spread from the far edge of the cell to the box side */
    const f = m.feet[0];
    expect(f.points.map(p => p[0])).toEqual([24 * CW, 25 * CW + CW / 2, 25 * CW + CW / 2]);
  });

  it("a < or > between two h-lines, or pointing into a side, is not a crow's foot", () => {
    expect(model("│<───").feet).toHaveLength(0);
    expect(model("│<───").heads).toHaveLength(1);
    expect(model("───>│").heads).toHaveLength(1);
    expect(model("───<───").feet).toHaveLength(0);
  });

  it("F14 nested frames: 7 boxes at depths 0–3, heads 1×e 1×s, every name is text", () => {
    const m = model(F14);
    expect(m.boxes).toHaveLength(7);
    expect(m.boxes.map(b => b.depth).sort()).toEqual([0, 1, 2, 2, 3, 3, 3]);
    expect(m.boxes.find(b => b.depth === 0).style).toBe("double");
    expect([heads(m, "e"), heads(m, "s")]).toEqual([1, 1]);
    for (const s of ["Cloud", "VPC", "Public", "Private", "Web", "App", "DB"]) expect(texts(m)).toContain(s);
  });

  it("F6 sequence diagram: no boxes, 3 lifelines, heads 2×e 2×w, dots are not corners", () => {
    const m = model(F6);
    expect(m.boxes).toHaveLength(0);
    expect(segs(m, "v")).toHaveLength(3);
    expect([heads(m, "e"), heads(m, "w")]).toEqual([2, 2]);
    expect(texts(m)).toContain("GET /orders");
    expect(texts(m)).toContain("SELECT ...");
    expect(segs(m, "curve")).toHaveLength(0);
  });

  it("F7 sloppy output: the off-by-one rectangle is only lines, the App boxes are boxes", () => {
    let m;
    expect(() => { m = model(F7); }).not.toThrow();
    expect(m.boxes).toHaveLength(2);
    expect(m.boxes.some(b => b.r1 === 3)).toBe(false);
    expect(heads(m, "s")).toBe(3);
    expect(m.heads).toHaveLength(3);
    const lb = segs(m, "h").find(s => s.y1 === 3 * CH + CH / 2);
    expect([lb.x1, lb.x2]).toEqual([CW / 2, 14 * CW + CW / 2]);           // Load Balancer's top is still drawn
    const branch = segs(m, "h").find(s => s.y1 === 7 * CH + CH / 2);
    expect([branch.x1, branch.x2]).toEqual([5 * CW + CW / 2, 20 * CW + CW / 2]);   // ├──────┐
  });

  it("F8 decision diamond: 2 boxes, diagonals, heads 2×s 1×e, labels", () => {
    let m;
    expect(() => { m = model(F8); }).not.toThrow();
    expect(m.boxes).toHaveLength(2);
    expect(segs(m, "d").length).toBeGreaterThanOrEqual(4);
    expect([heads(m, "s"), heads(m, "e")]).toEqual([2, 1]);
    expect(m.heads).toHaveLength(3);
    expect(text(m, "no").label).toBe(true);
    expect(text(m, "yes").label).toBe(true);
    expect(text(m, "ok?").label).toBe(false);
    expect(texts(m)).toContain("Start");
    expect(texts(m)).toContain("Done");
  });

  it("F11 wide characters: the emoji counts 2 cells, so the box closes", () => {
    const m = model(F11);
    expect(m.boxes).toHaveLength(1);
    const t = text(m, "📁 docs");
    expect(t).toBeDefined();
    expect([t.c, t.w]).toEqual([2, 7]);
  });

  it("F12 prose stays prose: no graphic cells, no segments, no heads", () => {
    expect(graphic(F12)).toBe(0);
    const m = model(F12);
    expect([m.segs.length, m.heads.length, m.boxes.length]).toEqual([0, 0, 0]);
  });

  it("text runs: single spaces join words, two or more split them", () => {
    const m = model("+--+\n|  |  a b   c\n+--+");
    expect(texts(m)).toEqual(["a b", "c"]);
  });

  it("styles: heavy, double, dashed, rounded corners", () => {
    expect(segs(model("┏━━┓\n┃  ┃\n┗━━┛"), "h").every(s => s.style === "heavy")).toBe(true);
    expect(segs(model("╔══╗\n║  ║\n╚══╝"), "v").every(s => s.style === "double")).toBe(true);
    const dashed = model("┌┄┄┐\n┆  ┆\n└┄┄┘");
    expect(dashed.boxes[0].group).toBe(true);
    expect(segs(dashed, "h").every(s => s.style === "dashed")).toBe(true);
    const round = model("╭──╮\n│  │\n╰──╯");
    expect(segs(round, "curve")).toHaveLength(4);
    expect(round.boxes[0].round).toBe(true);
    expect(segs(model(".--.\n|  |\n'--'"), "curve")).toHaveLength(4);
  });

  it("junction dots and markers appear only where a line touches them", () => {
    expect(model("a --*-- b").dots).toHaveLength(1);
    expect(model("●──●  ○").dots).toHaveLength(2);
    expect(texts(model("●──●  ○"))).toEqual(["○"]);
  });

  it("never throws on odd input", () => {
    for (const t of ["", " ", "+", "|", "-", "v", "/\\", "<>", "┼┼┼", "+-+\n| \n+", "á‍📁\t|"])
      expect(() => { const g = app.call("dgGrid", app.call("dgNormalize", t)); app.call("dgModel", g, app.call("dgScan", g)); }).not.toThrow();
  });
});

describe("dgSvg", () => {
  const svg = t => { const g = grid(t), m = app.call("dgModel", g, app.call("dgScan", g)); return { m, g, el: app.call("dgSvg", m, g.rows, g.cols) }; };

  it("builds a sized, labelled SVG with the four layers in paint order", () => {
    const { el, g } = svg(F1);
    expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(el.getAttribute("class")).toBe("dg-svg");
    expect(el.getAttribute("viewBox")).toBe(`0 0 ${g.cols * CW} ${g.rows * CH}`);
    expect([el.getAttribute("width"), el.getAttribute("height")]).toEqual([String(g.cols * CW), String(g.rows * CH)]);
    expect([el.getAttribute("role"), el.getAttribute("aria-label")]).toEqual(["img", "Diagram"]);
    expect([...el.children].map(c => c.getAttribute("class"))).toEqual(["dg-boxes", "dg-lines", "dg-heads", "dg-text"]);
  });

  it("one rect per box, one polygon per head, one <text> per run locked to the grid", () => {
    const { el, m } = svg(F1);
    expect(el.querySelectorAll("rect.dg-box")).toHaveLength(4);
    expect(el.querySelectorAll("polygon.dg-head")).toHaveLength(3);
    expect(el.querySelectorAll("path.dg-line").length).toBe(m.segs.length);
    const ts = [...el.querySelectorAll("text.dg-t")];
    expect(ts).toHaveLength(m.texts.length);
    const client = ts.find(t => t.textContent === "Client");
    expect([client.getAttribute("x"), client.getAttribute("textLength"), client.getAttribute("lengthAdjust")]).toEqual([String(2 * CW), String(6 * CW), "spacingAndGlyphs"]);
    const r = el.querySelector("rect.dg-box");
    expect([r.getAttribute("x"), r.getAttribute("y"), r.getAttribute("width"), r.getAttribute("height")])
      .toEqual([String(CW / 2), String(CH / 2), String(9 * CW), String(2 * CH)]);
  });

  it("marks groups, depths, titles, headers, labels and line styles with classes", () => {
    const f2 = svg(F2).el;
    expect(f2.querySelectorAll("rect.dg-group")).toHaveLength(1);
    expect([...f2.querySelectorAll("rect.dg-box")].map(r => r.getAttribute("data-depth")).sort()).toEqual(["0", "1", "1"]);
    expect(f2.querySelector("text.dg-title").textContent).toBe("Backend");
    expect([...svg(F3).el.querySelectorAll("text.dg-hd")].map(t => t.textContent)).toEqual(["customers", "orders"]);
    expect([...svg(F8).el.querySelectorAll("text.dg-label")].map(t => t.textContent).sort()).toEqual(["no", "yes"]);
    expect(svg("┏━━┓\n┗━━┛").el.querySelector("path.dg-heavy")).not.toBeNull();
    expect(svg("╔══╗\n╚══╝").el.querySelector("path.dg-double")).not.toBeNull();
    expect(svg("┆\n┆").el.querySelector("path.dg-dashed")).not.toBeNull();
    expect(svg("--*--").el.querySelectorAll("circle.dg-dot")).toHaveLength(1);
  });

  it("crow's feet are path.dg-foot in the heads layer", () => {
    const { el } = svg(F13);
    expect(el.querySelectorAll("g.dg-heads path.dg-foot")).toHaveLength(2);
    expect(el.querySelectorAll("polygon.dg-head")).toHaveLength(0);
  });

  it("user text is set as text, never parsed as markup", () => {
    const { el } = svg("+-------------------+\n| <b>x</b> <img src=x onerror=alert(1)> |\n+-------------------+");
    expect(el.querySelector("b,img,script")).toBeNull();
    expect(el.textContent).toContain("<b>x</b>");
  });
});

describe("view mode (decorate)", () => {
  it("draws a diagram block: .dg next to the <pre>, dg-on, kind hint, still collapsed", () => {
    const [wrap] = show(block(F1));
    const dg = wrap.querySelector(":scope > .dg");
    expect(dg).not.toBeNull();
    expect(dg.previousElementSibling.matches("pre.code")).toBe(true);
    expect(dg.querySelector("svg.dg-svg")).not.toBeNull();
    expect(wrap.classList.contains("dg-on")).toBe(true);
    expect(wrap.classList.contains("collapsed")).toBe(true);
    expect(wrap.querySelector(".code-bar span").textContent).toBe("Diagram · grid");
    expect(wrap.querySelector(".code-bar .n").textContent).toBe("8 lines");
    expect(wrap.querySelector("pre.code").textContent).toBe(F1);
  });

  it("the kind hint follows the diagram kind", () => {
    const wraps = show(block(F4) + block(F9) + block(F10));
    expect(wraps.map(w => w.querySelector(".code-bar span").textContent)).toEqual(["Diagram · tree", "Diagram · table", "Diagram · outline"]);
    expect(wraps[0].querySelector(".dg ul.dg-tree")).not.toBeNull();
    expect(wraps[1].querySelector(".dg table")).not.toBeNull();
  });

  it("a Text / Diagram button before Copy switches between drawing and source", () => {
    const [wrap] = show(block(F1));
    const btns = [...wrap.querySelectorAll(".code-bar button")].map(b => b.className);
    expect(btns).toEqual(["tog", "view", "copy"]);
    const view = wrap.querySelector(".view");
    expect([view.textContent, view.title]).toEqual(["Text", "Show source text"]);
    click(view);
    expect(wrap.classList.contains("dg-on")).toBe(false);
    expect([view.textContent, view.title]).toEqual(["Diagram", "Show diagram"]);
    click(view);
    expect(wrap.classList.contains("dg-on")).toBe(true);
    expect([view.textContent, view.title]).toEqual(["Text", "Show source text"]);
  });

  it("the view state resets on every render", () => {
    const [wrap] = show(block(F1));
    click(wrap.querySelector(".view"));
    app.call("render");
    expect(app.q("#viewer .code-wrap").classList.contains("dg-on")).toBe(true);
  });

  it("CSS: dg-on hides the text, otherwise the drawing is hidden; collapsed hides both; .dg scrolls", () => {
    const s = css();
    expect(s).toContain(".code-wrap.dg-on pre.code{display:none}");
    expect(s).toContain(".code-wrap:not(.dg-on) .dg{display:none}");
    expect(s).toContain(".code-wrap.collapsed .dg{display:none}");
    expect(s).toMatch(/\.dg\{[^}]*overflow-x:auto/);
  });

  it("Copy copies the ASCII source", async () => {
    const [wrap] = show(block(F2));
    click(wrap.querySelector(".copy"));
    await tick();
    expect(app.clipboard.text).toBe(F2);
  });

  it("other languages get no drawing and no view button", () => {
    const [wrap] = show(block("const a = 1;", "javascript"));
    expect(wrap.querySelector(".dg,.view")).toBeNull();
    expect(wrap.classList.contains("dg-on")).toBe(false);
  });

  it("prose shows as text with a note", () => {
    const [wrap] = show(block(F12));
    expect(wrap.querySelector(".dg")).toBeNull();
    expect(wrap.querySelector(".view")).toBeNull();
    expect(wrap.querySelector(".dg-msg").textContent).toBe("No diagram shapes found");
    expect(wrap.querySelector("pre.code").textContent).toBe(F12);
  });

  it("a block that fails to draw falls back to text; the others still render", () => {
    app.set("dgModel", () => { throw new Error("boom"); });
    const wraps = show(block(F1) + block(F4) + block("let x;", "javascript"));
    expect(wraps).toHaveLength(3);
    expect(wraps[0].querySelector(".dg")).toBeNull();
    expect(wraps[0].classList.contains("dg-on")).toBe(false);
    expect(wraps[0].querySelector(".dg-msg").textContent).toBe("Couldn't draw this diagram — showing text");
    expect(wraps[0].querySelector("pre.code").textContent).toBe(F1);
    expect(wraps[1].querySelector(".dg .dg-tree")).not.toBeNull();
    expect(wraps[2].querySelector(".code-bar span").textContent).toBe("JavaScript");
  });

  it("blocks over 400 lines or 300 columns are not drawn", () => {
    const tall = Array(401).fill("|").join("\n"), wide = "+" + "-".repeat(300) + "+";
    for (const t of [tall, wide]) {
      const [wrap] = show(block(t));
      expect(wrap.querySelector(".dg")).toBeNull();
      expect(wrap.querySelector(".dg-msg").textContent).toBe("Too large to draw");
    }
    expect(show(block(Array(400).fill("|").join("\n")))[0].querySelector(".dg")).not.toBeNull();
  });

  it("the editor never sees the drawing", () => {
    app.call("open", "p1");
    show(block(F1));
    app.call("setMode", "edit");
    expect(app.q("#editor .dg,#editor svg,#editor .view")).toBeNull();
  });
});

describe("storage invariants", () => {
  it("raw, node.content, localStorage and exports keep only the ASCII text", async () => {
    const content = "<p>x</p>" + block(F2) + block(F4);
    app.close();
    app = loadApp({ stored: { tree: [{ id: "d1", type: "page", name: "Arch", content }], selected: "d1" } });
    const wraps = app.qa("#viewer .code-wrap");
    expect(wraps).toHaveLength(2);
    click(wraps[0].querySelector(".view"));
    click(wraps[0].querySelector(".tog"));
    app.call("setMode", "edit"); app.call("commit"); app.call("setMode", "view");
    app.flush();
    const saved = app.call("find", "d1").node.content;
    for (const s of [app.get("raw"), saved, JSON.stringify(app.stored())]) {
      expect(s).not.toContain("<svg");
      expect(s).not.toContain("dg-");
      expect(s).not.toContain("dg-on");
    }
    const div = app.document.createElement("div");
    div.innerHTML = saved;
    expect([...div.querySelectorAll("pre")].map(p => [p.dataset.lang, p.textContent])).toEqual([["diagram", F2], ["diagram", F4]]);

    click(app.$("btnExport"));
    await tick();
    click(app.q('#dialog [data-a="1"]'));
    await tick();
    const out = app.downloads[0].text;
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("dg-");
    const page = JSON.parse(out).tree[0];
    div.innerHTML = page.content;
    expect(div.querySelector("pre").textContent).toBe(F2);
  });

  it("old-shaped data (plain code blocks) loads, renders and saves unchanged", () => {
    const old = sampleTree();
    old[1].content = '<h2>Old</h2><pre class="code" data-lang="plain">+--+\n|  |\n+--+</pre><pre class="code" data-lang="sql">select 1</pre>';
    app.close();
    app = loadApp({ stored: { tree: old, selected: "p3" } });
    expect(app.q("#viewer .dg")).toBeNull();                       // a plain block is never drawn
    app.call("render");
    app.call("save"); app.flush();
    expect(app.stored().tree).toEqual(JSON.parse(JSON.stringify(old)));
    const imported = app.call("normalize", JSON.parse(JSON.stringify(old)));
    expect(imported[1].content).toBe(old[1].content);
  });
});

describe("Paste ▾ → From markdown", () => {
  function md(t) { const d = app.document.createElement("div"); d.innerHTML = app.call("mdToHtml", t); return d; }
  const lang = t => md(t).querySelector("pre").dataset.lang;

  it("maps ASCII-art info strings to diagram (but not mermaid)", () => {
    for (const k of ["ascii", "ascii-art", "asciiart", "tree", "svgbob", "bob", "goat", "ditaa", "diagram"])
      expect(lang("```" + k + "\na\n```"), k).toBe("diagram");
    expect(lang("```mermaid\ngraph TD\n```")).toBe("plain");
  });

  it("auto-detects diagrams in bare / text fences", () => {
    expect(lang("```text\n" + F2 + "\n```")).toBe("diagram");
    expect(lang("```\n" + F4 + "\n```")).toBe("diagram");
    expect(lang("```txt\n" + F1 + "\n```")).toBe("diagram");
    expect(lang("```plaintext\n" + F6 + "\n```")).toBe("diagram");
  });

  it("keeps ordinary code, prose and ASCII tables plain", () => {
    expect(lang("```\nfor (let i = 0; i < n; i++) {\n  p->next = a[i] - b;\n}\n```")).toBe("plain");
    expect(lang("```text\nhello world\n```")).toBe("plain");
    expect(lang("```\n" + F9 + "\n```")).toBe("plain");
    expect(lang("```js\n// --- x --->\n```")).toBe("javascript");
  });

  it("the pasted diagram keeps its text byte-for-byte", () => {
    expect(md("```\n" + F8 + "\n```").querySelector("pre").textContent).toBe(F8 + "\n");
  });
});
