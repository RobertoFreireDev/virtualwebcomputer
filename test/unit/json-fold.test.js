import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp, sampleTree, tick } from "../helpers/app.js";
import { click } from "../helpers/dom.js";

let app;
beforeEach(() => { app = loadApp({ stored: { tree: sampleTree(), selected: "p1" } }); });
afterEach(() => app.close());

const db = () => app.get("db");
const css = () => app.document.querySelector("style").textContent.replace(/\s+/g, " ");

/* a formatted document the way the Format button writes it, plus a few hand-written bits */
const DOC = [
  "{",
  '  "name": "x",',
  '  "items": [',
  '    { "id": 1 },',
  '    { "id": 2, "tags": [] }',
  "  ],",
  '  "empty": {}',
  "}"
].join("\n");

/* shows `code` as a block of `lang` in the viewer and returns its <pre> */
const show = (code, lang = "json") => {
  const pre = app.document.createElement("pre");
  pre.className = "code"; pre.dataset.lang = lang; pre.textContent = code;
  app.set("raw", pre.outerHTML);
  app.call("render");
  return app.q("#viewer pre.code");
};
const togs = pre => [...pre.querySelectorAll(".j-tog")];
/* the j-node whose text (key + bracket) starts with `start` */
const node = (pre, start) => [...pre.querySelectorAll(".j-node")].find(n => n.textContent.startsWith(start));
const shut = n => n.classList.contains("j-shut");
const own = (n, sel) => [...n.children].find(c => c.matches(sel));

describe("JSON node toggles (view mode)", () => {
  it("puts a toggle on every non-empty object and array, all expanded to start with", () => {
    const pre = show(DOC);
    const t = togs(pre);
    expect(t).toHaveLength(4);                                    // root, items, and the two item objects; [] and {} have nothing to fold
    expect(t.every(b => b.tagName === "BUTTON")).toBe(true);
    expect(t.every(b => b.getAttribute("aria-expanded") === "true" && b.title === "Collapse")).toBe(true);
    expect(pre.querySelectorAll(".j-shut")).toHaveLength(0);
  });

  it("only JSON blocks get them", () => {
    expect(togs(show("const a = { b: [1, 2] };", "javascript"))).toHaveLength(0);
    expect(togs(show('{"a": [1, 2]}', "plain"))).toHaveLength(0);
    expect(togs(show("SELECT '{[1]}'", "sql"))).toHaveLength(0);
  });

  it("keeps the text exactly as written, still highlighted", () => {
    const pre = show(DOC);
    expect(pre.textContent).toBe(DOC);                             // toggles and summaries carry no text
    expect([...pre.querySelectorAll(".t-attr")].map(s => s.textContent)).toEqual(['"name"', '"items"', '"id"', '"id"', '"tags"', '"empty"']);
    expect([...pre.querySelectorAll(".t-number")].map(s => s.textContent)).toEqual(["1", "2"]);
    expect(pre.querySelector(".t-string").textContent).toBe('"x"');
  });

  it("Copy copies the code, whatever is folded", async () => {
    const pre = show(DOC);
    click(own(node(pre, '"items"'), ".j-tog"));
    click(app.q("#viewer .code-bar .copy"));
    await tick();
    expect(app.clipboard.text).toBe(DOC);
  });

  it("places the toggle before the key of a keyed value, before the bracket otherwise", () => {
    const pre = show(DOC);
    const items = node(pre, '"items"');
    expect(items.firstChild).toBe(own(items, ".j-tog"));
    expect(items.textContent.startsWith('"items": [')).toBe(true);
    expect(items.textContent.endsWith("]")).toBe(true);
    const root = pre.querySelector(".j-node");
    expect(root.textContent).toBe(DOC);
    const first = node(pre, '{ "id": 1');
    expect(first.textContent).toBe('{ "id": 1 }');
  });

  it("clicking a toggle folds that node: its content hides and a summary shows the count", () => {
    const pre = show(DOC);
    const items = node(pre, '"items"'), tog = own(items, ".j-tog");
    click(tog);
    expect(shut(items)).toBe(true);
    expect(tog.getAttribute("aria-expanded")).toBe("false");
    expect(tog.title).toBe("Expand");
    expect(own(items, ".j-body").textContent).toBe('\n    { "id": 1 },\n    { "id": 2, "tags": [] }\n  ');
    expect(own(items, ".j-more").dataset.n).toBe("2 items");
    expect(shut(pre.querySelector(".j-node"))).toBe(false);       // the root stays open
    click(tog);
    expect(shut(items)).toBe(false);
    expect(tog.getAttribute("aria-expanded")).toBe("true");
    expect(tog.title).toBe("Collapse");
  });

  it("counts keys for objects and items for arrays, singular for one", () => {
    const pre = show('{"a": {"x": 1}, "b": [1, 2, 3], "c": {"y": 1, "z": [2]}, "d": [[]]}');
    const n = start => own(node(pre, start), ".j-more").dataset.n;
    expect(n("{\"a\"")).toBe("4 keys");
    expect(n('"a"')).toBe("1 key");
    expect(n('"b"')).toBe("3 items");
    expect(n('"c"')).toBe("2 keys");
    expect(n('"z"')).toBe("1 item");
    expect(n('"d"')).toBe("1 item");
  });

  it("commas inside strings and nested nodes don't count", () => {
    const pre = show('[ "a,b", [1, 2], {"k": "v, w"} ]');
    expect(own(pre.querySelector(".j-node"), ".j-more").dataset.n).toBe("3 items");
  });

  it("clicking the summary of a folded node opens it again", () => {
    const pre = show(DOC);
    const items = node(pre, '"items"');
    click(own(items, ".j-tog"));
    click(own(items, ".j-more"));
    expect(shut(items)).toBe(false);
    expect(own(items, ".j-tog").getAttribute("aria-expanded")).toBe("true");
  });

  it("nodes fold independently: a parent keeps its children's state", () => {
    const pre = show(DOC);
    const items = node(pre, '"items"'), first = node(pre, '{ "id": 1'), second = node(pre, '{ "id": 2');
    click(own(first, ".j-tog"));
    click(own(items, ".j-tog"));
    expect(shut(items) && shut(first)).toBe(true);
    click(own(items, ".j-tog"));
    expect(shut(items)).toBe(false);
    expect(shut(first)).toBe(true);
    expect(shut(second)).toBe(false);
  });

  it("each block folds on its own", () => {
    app.set("raw", '<pre class="code" data-lang="json">[1, [2]]</pre><p>x</p><pre class="code" data-lang="json">[1, [2]]</pre>');
    app.call("render");
    const [a, b] = app.qa("#viewer pre.code");
    click(a.querySelector(".j-tog"));
    expect(shut(a.querySelector(".j-node"))).toBe(true);
    expect(shut(b.querySelector(".j-node"))).toBe(false);
  });

  it("hangs the toggle in the indentation when the node starts its line, inline otherwise", () => {
    const pretty = show(DOC);
    expect(own(node(pretty, '"items"'), ".j-tog").classList.contains("j-in")).toBe(false);
    expect(own(pretty.querySelector(".j-node"), ".j-tog").classList.contains("j-in")).toBe(false);
    const min = show('{"a":[1,{"b":2}],"c":{"d":[3]}}');
    expect(togs(min).map(b => b.classList.contains("j-in"))).toEqual([false, true, true, true, true]);
  });

  it("works on JSON that doesn't parse: brackets in strings are skipped, unmatched ones get no toggle", () => {
    const code = '{"s": "a [ b { \\" ]", "ok": [1], "bad": [1, 2}';
    const pre = show(code);
    expect(pre.textContent).toBe(code);
    expect(togs(pre)).toHaveLength(1);
    expect(node(pre, '"ok"').textContent).toBe('"ok": [1]');
    expect(pre.querySelector(".t-string").textContent).toBe('"a [ b { \\" ]"');
  });

  it("only a quoted key carries the toggle: JS-style keys leave it on the bracket", () => {
    const pre = show("{abs: [1], 's': {\"k\": 2}}");
    expect(node(pre, "[").textContent).toBe("[1]");
    expect(node(pre, "{\"k\"").textContent).toBe('{"k": 2}');
    expect(pre.textContent).toBe("{abs: [1], 's': {\"k\": 2}}");
  });

  it("copes with deep nesting", () => {
    const code = "[".repeat(300) + "1" + "]".repeat(300);
    const pre = show(code);
    expect(togs(pre)).toHaveLength(300);
    expect(pre.textContent).toBe(code);
  });

  it("CSS draws −/+ and the summary, hides a folded body, and gives the toggle no width when it hangs", () => {
    const s = css();
    expect(s).toContain(".j-tog::before{content:\"\\2212\"}");
    expect(s).toContain(".j-shut>.j-tog::before{content:\"+\"}");
    expect(s).toContain(".j-shut>.j-body,.j-node:not(.j-shut)>.j-more{display:none}");
    expect(s).toMatch(/\.j-more::before\{content:[^}]*attr\(data-n\)/);
    expect(s).toMatch(/\.j-tog\{[^}]*width:11px[^}]*margin:0 3px 0 -14px/);   // 11 + 3 − 14 = 0
    expect(s).toContain(".j-tog.j-in{margin-left:0}");
  });
});

describe("JSON toggles are view state only", () => {
  const STORED = `<pre class="code" data-lang="json">${DOC}</pre>`;
  beforeEach(() => {
    app.call("find", "p3").node.content = STORED;
    db().selected = "p3"; app.call("open", "p3");
  });

  it("folding is never saved and leaves the page content untouched", () => {
    click(own(node(app.q("#viewer pre.code"), '"items"'), ".j-tog"));
    app.flush();
    expect(app.get("raw")).toBe(STORED);
    expect(app.call("find", "p3").node.content).toBe(STORED);
    expect(app.get("raw")).not.toMatch(/j-|aria-expanded/);
  });

  it("nothing of it reaches the editor or the HTML view", () => {
    click(own(node(app.q("#viewer pre.code"), '"items"'), ".j-tog"));
    app.call("setMode", "edit");
    expect(app.q("#editor .j-tog, #editor .j-node, #editor .j-more")).toBeNull();
    expect(app.q("#editor pre.code").textContent).toBe(DOC);
    app.call("setMode", "source");
    expect(app.$("source").value).not.toMatch(/j-|aria-expanded/);
  });

  it("every node is open again after the page is re-rendered", () => {
    click(own(node(app.q("#viewer pre.code"), '"items"'), ".j-tog"));
    app.call("open", "p1"); app.call("open", "p3");
    expect(app.qa("#viewer .j-shut")).toHaveLength(0);
    click(own(node(app.q("#viewer pre.code"), '"items"'), ".j-tog"));
    app.call("setMode", "edit"); app.call("setMode", "view");
    expect(app.qa("#viewer .j-shut")).toHaveLength(0);
  });
});
