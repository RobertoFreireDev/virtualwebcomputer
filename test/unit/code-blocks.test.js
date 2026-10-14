import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadApp, sampleTree, tick } from "../helpers/app.js";
import { click, change, rect, mousedown, caret, input } from "../helpers/dom.js";

/* The floating language/delete header that sits over every <pre> while editing */
let app, editor, layer;
beforeEach(() => {
  app = loadApp({ stored: { tree: sampleTree(), selected: "p3" } });
  editor = app.$("editor"); layer = app.$("blocks");
});
afterEach(() => app.close());

const heads = () => [...layer.children];

describe("makeHead()", () => {
  it("builds a header with every language option and a delete button", () => {
    const h = app.call("makeHead");
    expect(h.className).toBe("blk");
    const opts = [...h.querySelectorAll("option")].map(o => [o.value, o.textContent]);
    expect(opts).toEqual(Object.entries(app.get("LANGS")).map(([k, v]) => [k, v.label]));
    expect(h.querySelector("select").title).toBe("Code language");
    expect(h.querySelector(".fmt").textContent).toBe("Format");
    expect(h.querySelector(".x").title).toBe("Delete this code block");
    expect(h.querySelector(".x svg")).not.toBeNull();
  });

  it("ignores events before it is bound to a block", async () => {
    const h = app.call("makeHead");
    expect(() => change(h.querySelector("select"))).not.toThrow();
    expect(() => click(h.querySelector(".fmt"))).not.toThrow();
    expect(() => click(h.querySelector(".tog"))).not.toThrow();
    await h.querySelector(".x").onclick();
    expect(app.dialogOpen()).toBe(false);
  });
});

describe("format button", () => {
  const pre = () => editor.querySelector("pre.code");
  const setCode = (lang, html) => { pre().dataset.lang = lang; pre().innerHTML = html; app.call("syncBlocks"); };

  it("rewrites the block with the language's formatter, saves and puts the caret in the block", () => {
    app.call("setMode", "edit");
    setCode("json", '{"a":[1,2]}');
    click(heads()[0].querySelector(".fmt"));
    expect(pre().textContent).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}\n');
    expect(app.call("find", "p3").node.content).toContain('"a": [');
    expect(app.$("status").textContent).toBe("Saved");
    expect(pre().contains(app.window.getSelection().anchorNode)).toBe(true);
  });

  it("uses the block's current language", () => {
    app.call("setMode", "edit");
    setCode("sql", "select a from b");
    click(heads()[0].querySelector(".fmt"));
    expect(pre().textContent).toBe("SELECT a\nFROM b\n");
  });

  it("treats <br> in pasted code as line breaks", () => {
    app.call("setMode", "edit");
    setCode("python", "def f():<br>\treturn 1");
    click(heads()[0].querySelector(".fmt"));
    expect(pre().textContent).toBe("def f():\n    return 1\n");
    expect(pre().querySelector("br")).toBeNull();
  });

  it("toasts instead of changing anything when the code cannot be formatted", () => {
    app.call("setMode", "edit");
    setCode("json", "{oops");
    click(heads()[0].querySelector(".fmt"));
    expect(pre().textContent).toBe("{oops");
    expect(app.$("toast").textContent).toBe("Can't format: not valid JSON");
    expect(app.$("status").textContent).not.toBe("Saved");
  });

  it("says so when the code is already formatted", () => {
    app.call("setMode", "edit");
    setCode("plain", "a\nb\n");
    click(heads()[0].querySelector(".fmt"));
    expect(app.$("toast").textContent).toBe("Already formatted");
    expect(pre().textContent).toBe("a\nb\n");
  });

  it("does not steal focus from the editor on mousedown", () => {
    app.call("setMode", "edit");
    const ev = new app.window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
    heads()[0].querySelector(".fmt").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("syncBlocks()", () => {
  it("creates one header per code block in edit mode and none otherwise", () => {
    expect(heads()).toHaveLength(0);
    app.call("setMode", "edit");
    expect(heads()).toHaveLength(1);
    expect(heads()[0]._pre).toBe(editor.querySelector("pre.code"));
    app.call("setMode", "view");
    expect(heads()).toHaveLength(0);
  });

  it("positions headers over their block relative to the page", () => {
    app.call("setMode", "edit");
    rect(app.$("page"), { top: 100, left: 50 });
    rect(editor.querySelector("pre.code"), { top: 300, left: 90, width: 500 });
    app.call("syncBlocks");
    const h = heads()[0];
    expect(h.style.left).toBe("42px");    // 90 - 50 + 2
    expect(h.style.top).toBe("201px");    // 300 - 100 + 1
    expect(h.style.width).toBe("497px");  // 500 - 3
  });

  it("reflects the block language in the select and repairs unknown languages", () => {
    app.call("setMode", "edit");
    expect(heads()[0].querySelector("select").value).toBe("javascript");
    editor.querySelector("pre.code").dataset.lang = "brainfuck";
    app.call("syncBlocks");
    expect(editor.querySelector("pre.code").dataset.lang).toBe("plain");
    expect(heads()[0].querySelector("select").value).toBe("plain");
  });

  it("does not overwrite the select while the user is choosing", () => {
    app.call("setMode", "edit");
    const sel = heads()[0].querySelector("select");
    sel.focus();
    sel.value = "sql";
    app.call("syncBlocks");
    expect(sel.value).toBe("sql");
  });

  it("adds and removes headers as blocks come and go", () => {
    app.call("setMode", "edit");
    editor.insertAdjacentHTML("beforeend", '<pre class="code" data-lang="css">a{}</pre><pre class="code" data-lang="sql">x</pre>');
    app.call("syncBlocks");
    expect(heads()).toHaveLength(3);
    expect(heads().map(h => h._pre.dataset.lang)).toEqual(["javascript", "css", "sql"]);
    editor.querySelectorAll("pre.code").forEach(p => p.remove());
    app.call("syncBlocks");
    expect(heads()).toHaveLength(0);
  });

  it("is scheduled automatically when the editor changes (MutationObserver + rAF)", async () => {
    app.call("setMode", "edit");
    editor.insertAdjacentHTML("beforeend", '<pre class="code" data-lang="css">a{}</pre>');
    await tick();               // observer callback
    expect(heads()).toHaveLength(1);
    app.flush();                // rAF
    expect(heads()).toHaveLength(2);
  });

  it("scheduleSync coalesces several requests into one frame", () => {
    app.call("setMode", "edit");
    app.call("scheduleSync"); app.call("scheduleSync"); app.call("scheduleSync");
    expect(app.get("syncQueued")).toBe(true);
    app.flush();
    expect(app.get("syncQueued")).toBe(false);
  });

  it("re-syncs on window resize", () => {
    app.call("setMode", "edit");
    app.window.dispatchEvent(new app.window.Event("resize"));
    expect(app.get("syncQueued")).toBe(true);
  });
});

describe("language select", () => {
  it("changes the block's data-lang and saves", () => {
    app.call("setMode", "edit");
    const sel = heads()[0].querySelector("select");
    sel.value = "python";
    change(sel);
    expect(editor.querySelector("pre.code").dataset.lang).toBe("python");
    expect(app.call("find", "p3").node.content).toContain('data-lang="python"');
    expect(app.$("status").textContent).toBe("Saved");
  });

  it("the new language is used for highlighting in view mode", () => {
    app.call("setMode", "edit");
    const sel = heads()[0].querySelector("select");
    sel.value = "plain"; change(sel);
    app.call("setMode", "view");
    expect(app.q("#viewer .code-bar span").textContent).toBe("Plain text");
    expect(app.q("#viewer pre.code .t-keyword")).toBeNull();
  });
});

/* While editing, a collapsed block is marked data-collapsed on its <pre>: view state only,
   like the viewer's .code-wrap.collapsed — it never reaches raw, the page, storage or the HTML view. */
describe("collapse toggle (edit mode)", () => {
  const pre = () => editor.querySelector("pre.code");
  const tog = (i = 0) => heads()[i].querySelector(".tog");
  const shut = p => p.hasAttribute("data-collapsed");
  const selectionchange = () => app.document.dispatchEvent(new app.window.Event("selectionchange"));
  const saved = sampleTree()[1].content + "<p><br></p>";        // p3 as stored after a round of editing

  it("every header starts with a collapse toggle", () => {
    app.call("setMode", "edit");
    expect(heads()[0].firstElementChild).toBe(tog());
    expect(tog().tagName).toBe("BUTTON");
    expect(tog().querySelector("svg")).not.toBeNull();
  });

  it("a block collapsed in view mode is still collapsed when editing starts", () => {
    expect(app.q("#viewer .code-wrap").classList.contains("collapsed")).toBe(true);
    app.call("setMode", "edit");
    expect(shut(pre())).toBe(true);
    expect(heads()[0].classList.contains("collapsed")).toBe(true);
    expect(tog().getAttribute("aria-expanded")).toBe("false");
    expect(tog().title).toBe("Expand");
  });

  it("a block expanded in view mode is still expanded", () => {
    click(app.q("#viewer .code-wrap .tog"));
    app.call("setMode", "edit");
    expect(shut(pre())).toBe(false);
    expect(heads()[0].classList.contains("collapsed")).toBe(false);
    expect(tog().getAttribute("aria-expanded")).toBe("true");
    expect(tog().title).toBe("Collapse");
  });

  it("each block keeps its own state", () => {
    app.set("raw", '<pre class="code" data-lang="plain">a</pre><p>x</p><pre class="code" data-lang="sql">b</pre><p>y</p><pre class="code" data-lang="css">c</pre>');
    app.call("render");
    click(app.qa("#viewer .code-wrap .tog")[1]);
    app.call("setMode", "edit");
    expect([...editor.querySelectorAll("pre.code")].map(shut)).toEqual([true, false, true]);
    expect(heads().map(h => h.querySelector(".tog").getAttribute("aria-expanded"))).toEqual(["false", "true", "false"]);
  });

  it("matches blocks by position even when one <pre> has no header (not a .code block yet)", () => {
    app.set("raw", '<pre>bare</pre><pre class="code" data-lang="plain">x</pre>');
    app.call("render");                              // the viewer shows both as code blocks
    click(app.qa("#viewer .code-wrap .tog")[0]);     // first open, second collapsed
    app.call("setMode", "edit");
    expect(heads()).toHaveLength(1);
    expect(shut(pre())).toBe(true);                  // the second block's state, not the first's
    expect(shut(editor.querySelector("pre:not(.code)"))).toBe(false);
  });

  it("the toggle expands and collapses the block", () => {
    app.call("setMode", "edit");
    click(tog());
    expect(shut(pre())).toBe(false);
    expect(heads()[0].classList.contains("collapsed")).toBe(false);
    expect(tog().getAttribute("aria-expanded")).toBe("true");
    expect(tog().title).toBe("Collapse");
    click(tog());
    expect(shut(pre())).toBe(true);
    expect(heads()[0].classList.contains("collapsed")).toBe(true);
    expect(tog().getAttribute("aria-expanded")).toBe("false");
    expect(tog().title).toBe("Expand");
  });

  it("blocks added while editing start expanded and can be collapsed", () => {
    app.call("setMode", "edit");
    click(app.$("tbBlock"));
    app.call("syncBlocks");
    const pres = [...editor.querySelectorAll("pre.code")];
    expect(pres).toHaveLength(2);
    expect(shut(pres[1])).toBe(false);
    expect(tog(1).getAttribute("aria-expanded")).toBe("true");
    click(tog(1));
    expect(shut(pres[1])).toBe(true);
    expect(shut(pres[0])).toBe(true);                // the other block is untouched
  });

  it("shows the line count only while collapsed", () => {
    app.set("raw", '<pre class="code" data-lang="plain">a\nb\nc\n</pre>');
    app.call("render");
    app.call("setMode", "edit");
    expect(heads()[0].querySelector(".n").textContent).toBe("3 lines");
    click(tog());
    expect(heads()[0].querySelector(".n").textContent).toBe("");
    pre().innerHTML = "one<br>two";                   // pasted code may use <br>
    click(tog());
    expect(heads()[0].querySelector(".n").textContent).toBe("2 lines");
  });

  it("does not steal focus from the editor on mousedown", () => {
    app.call("setMode", "edit");
    expect(mousedown(tog()).defaultPrevented).toBe(true);
  });

  it("collapsing the block that holds the caret moves the caret below it", () => {
    click(app.q("#viewer .code-wrap .tog"));
    app.call("setMode", "edit");
    caret(pre().firstChild, 3);
    click(tog());
    expect(shut(pre())).toBe(true);
    const s = app.window.getSelection(), below = pre().nextElementSibling;
    expect(pre().contains(s.anchorNode)).toBe(false);
    expect(below.contains(s.anchorNode)).toBe(true);
    selectionchange();
    expect(shut(pre())).toBe(true);                  // and it stays collapsed
  });

  it("moving the caret into a collapsed block expands it", () => {
    app.call("setMode", "edit");
    expect(shut(pre())).toBe(true);
    caret(pre().firstChild, 2);
    selectionchange();
    expect(shut(pre())).toBe(false);
    app.flush();                                     // header re-synced
    expect(tog().getAttribute("aria-expanded")).toBe("true");
  });

  it("a caret anywhere else leaves collapsed blocks alone", () => {
    app.call("setMode", "edit");
    caret(editor.querySelector("h2").firstChild, 1);
    selectionchange();
    expect(shut(pre())).toBe(true);
  });

  it("is never saved: autosave and Done store the page without it", () => {
    app.call("setMode", "edit");
    expect(shut(pre())).toBe(true);
    input(editor);
    app.flush();                                     // 500 ms autosave + save debounce
    expect(app.get("raw")).toBe(saved);
    expect(app.call("find", "p3").node.content).toBe(saved);
    expect(app.stored().tree[1].content).toBe(saved);
    click(app.$("btnMode"));                         // Done
    expect(app.call("find", "p3").node.content).toBe(saved);
  });

  it("is never saved: not by switching pages mid-edit, nor shown in the HTML view", () => {
    app.call("setMode", "edit");
    expect(shut(pre())).toBe(true);
    app.call("setMode", "source");
    expect(app.$("source").value).not.toContain("data-collapsed");
    app.call("setMode", "edit");                     // from the HTML view nothing is collapsed
    click(tog());
    expect(shut(pre())).toBe(true);
    click(app.row("p1"));                            // open another page while editing
    expect(app.call("find", "p3").node.content).toBe(saved);
  });

  it("CSS: a collapsed block shows only its header strip", () => {
    const css = [...app.document.querySelectorAll("style")].map(s => s.textContent).join("\n");
    expect(css).toMatch(/\.body\[contenteditable="true"\] pre\.code\[data-collapsed\]\{[^}]*overflow:hidden/);
    expect(css).toContain(".blk.collapsed .tog svg{transform:none}");   // chevron points down, as in view mode
  });
});

describe("delete block button", () => {
  it("asks for confirmation and removes the block on Delete", async () => {
    app.call("setMode", "edit");
    click(heads()[0].querySelector(".x"));
    await tick();
    expect(app.dialogOpen()).toBe(true);
    expect(app.q("#dialog h3").textContent).toBe("Delete code block?");
    expect(app.q("#dialog p").textContent).toBe("The code inside it will be removed from this page.");
    click(app.q('#dialog [data-a="1"]'));
    await tick();
    expect(editor.querySelector("pre.code")).toBeNull();
    expect(heads()).toHaveLength(0);
    expect(app.call("find", "p3").node.content).not.toContain("<pre");
  });

  it("keeps the block when cancelled", async () => {
    app.call("setMode", "edit");
    click(heads()[0].querySelector(".x"));
    await tick();
    click(app.q('#dialog [data-a="0"]'));
    await tick();
    expect(editor.querySelector("pre.code")).not.toBeNull();
    expect(heads()).toHaveLength(1);
  });
});
