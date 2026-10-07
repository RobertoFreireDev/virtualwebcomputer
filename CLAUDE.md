# Virtual PC (Virtual-Web-Computer)

A personal wiki / notebook for Windows. The whole app is **one HTML file**
(no build step, no server, no web dependencies) hosted by a small WebView2
desktop program (`desktop/`) that embeds the file in its exe. Folders and pages
live in a sidebar tree, the open page is a rich-text document with
syntax-highlighted code blocks, and everything is persisted to `localStorage`
in the app's private WebView2 profile. Backups are plain JSON. The HTML refuses
to start in an ordinary browser.

## Repository layout

```
virtualwebpc.html   the whole application (CSS + markup + JS, ~2660 lines)
desktop/            Windows host (.NET 10 WinForms + WebView2), embeds the HTML
  VirtualPC.csproj  framework-dependent single-file exe, HTML as EmbeddedResource
  Program.cs        single instance, clears every WEBVIEW2_* env var in Release, Debug/Release names
  MainForm.cs       WebView2 setup: private origin, CSP, navigation/download/menu rules, memory switches
  app.ico           window/taskbar icon
README.md           how to build and run
CLAUDE.md           this file
test/               Vitest + JSDOM unit tests (see test/README.md)
  helpers/app.js    boots the HTML in JSDOM, stubs browser APIs, exposes internals
  helpers/dom.js    event helpers (click, key, drag, paste, chooseFile …)
  unit/*.test.js    one file per feature area
```

## Running

- **App:** `cd desktop && dotnet run` (dev, Debug) or
  `dotnet publish -c Release -o publish` → `desktop/publish/VirtualPC.exe`
  (~1.4 MB; needs the .NET 10 Desktop Runtime and the WebView2 Runtime, both
  standard on Windows 11). The HTML is compiled into the exe — rebuild after
  editing it. Opening `virtualwebpc.html` in a browser only shows a "runs only
  inside the desktop app" notice. Data is stored under the `localStorage` key
  `virtualpc.data.v1` of the origin `https://virtualpc.example/`, in the profile
  `%LOCALAPPDATA%\VirtualPC` (Debug builds: `%LOCALAPPDATA%\VirtualPC.Debug`, so
  a DevTools-enabled build never opens the real library). Libraries from the old browser version move over
  with Export (in the browser, from commit `f6609f7` or earlier) → Import (in the app).
- **Tests:** `cd test && npm install && npm test` (Node 18+; no browser needed).
  Run a single file with `npx vitest run unit/editor.test.js`.

## Architecture of `virtualwebpc.html`

The `<script>` is a classic (non-module) script in `"use strict"` mode. All
state and functions are top-level bindings, in this order:

| Section | Key names | Notes |
|---|---|---|
| host | `window.chrome.webview` check at the top of the script | First thing the script does: without the WebView2 bridge (any ordinary browser) it replaces the body with `#blocked` (`.blocked`) and throws, so nothing reads, writes or seeds storage. The test harness stubs `window.chrome.webview` (`loadApp({host:false})` omits it). Host side (`desktop/MainForm.cs`): the page is served from memory for `https://virtualpc.example/` (`.example` is reserved; stable origin = stable localStorage) with a CSP (`default-src 'none'`; `script-src 'sha256-…'` = the hash of the page's one inline `<script>`, computed at startup by `ScriptHash()` with CRLF→LF as the HTML parser does, so injected `<script>`, `on…=` handlers and `javascript:` URLs never run; `style-src 'unsafe-inline'`; `img-src data: blob: http(s):`; no connect/frames/forms) plus `Referrer-Policy: no-referrer`; the `AutoupgradeMixedContent` feature is off so `http://` images load as they did in the browser; any other navigation is cancelled and http/https/mailto links open in the default browser (relative links, which resolve to the app's own host, are ignored); frames and new windows are blocked; only clipboard-read permission is granted; downloads: Export's `blob:` goes through a Windows Save dialog that starts in Downloads (Documents is often OneDrive-synced), "Save image as" keeps WebView2's own Save dialog for `data:image/…` and http(s) `image/*`, anything else is refused; the status bar shows a link's address on hover; a hung page asks Wait/Reload instead of reloading by itself, a crashed one reloads; Release ignores every `WEBVIEW2_*` env var and has DevTools off; Debug (DevTools on, env vars honoured) uses its own profile `%LOCALAPPDATA%\VirtualPC.Debug` and single-instance names, never the real library; navigation/save-page/print/inspect context-menu entries removed; closing the window runs `commit()`+`flush()` before WebView2 shuts down; single instance (second launch focuses the first). Memory: `--in-process-gpu --renderer-process-limit=1 --js-flags=--optimize-for-size` + background services off, `MemoryUsageTargetLevel.Low` while minimised — ≈73 MB total private memory idle, ≈82 MB on a typical page. |
| state | `KEY`, `uid()`, `db`, `mode`, `raw`, `memoryOnly` | `db = { tree, selected, navWidth, navOpen }`. `db.selected` is only the *highlighted row* (can be a folder); the page shown in the panel is `openId` (document section). `mode` is `"view" \| "edit" \| "source"`. `raw` is the current page's HTML — the single source of truth while editing. |
| storage | `load()`, `save()`, `flush()`, `flag()`, `toast()` | `save()` is debounced 250 ms; `flush()` writes immediately (used by `beforeunload`, where a timer could never fire). A throwing `localStorage` sets `memoryOnly` and the app keeps working in memory. |
| tree model | `find`, `each`, `contains`, `chainOf`, `target`, `addPage`, `addFolder`, `remove`, `move` | Nodes: `{id, type:"page", name, content}` or `{id, type:"folder", name, open, children, icon?}`. `icon` is optional: absent (new folders, old data) = the default folder glyph. `target()` decides where new nodes go (inside a selected folder, beside a selected page). `move()` refuses cycles. |
| tree view | `renderTree`, `build`, `wire`, `renameInTree`, `matches`, `filter` | Rows are `.row[data-id]`. Search matches names **and** page text (tags stripped) and force-opens folders without changing `node.open`. A click on the tree outside any row (blank space below the rows, the gutter of a `.children` list) clears `db.selected` — the open page stays in the panel — so the next New page/folder lands at the root. |
| folder icons | `ICON`, `FOLDER_ICON_DEFS`, `FOLDER_ICONS`, `isFolderIcon`, `glyph(n)`, `iconBox(n)` | `ICON.folder`/`ICON.page` are the defaults and stay unchanged; page icons are never customisable. `FOLDER_ICON_DEFS` holds 27 extra folder glyphs (`pc trash book star clock config home music image code mail archive people search save upload download browser security cloud database chart calendar video map work idea`, each `{label, svg}` built by `ico()` in the same 14 px / `0 0 16 16` / `stroke="currentColor"` 1.4 style); `FOLDER_ICONS` maps key → svg. `glyph(n)` returns the folder's icon when `n.icon` is a known key (own property, string), else `ICON[n.type]` — used by tree rows, the delete dialog and `pickBox`. Clicking a folder row's `.gl` (title "Change icon"; does not toggle the folder) or the folder menu item "Change icon" selects the folder and opens `iconBox(n)`: a dialog with an `.icon-grid` of `[data-icon]` buttons (`""` = Default first, the current one `.on`/`aria-pressed`). Choosing sets `n.icon` — Default **deletes** the field so the data keeps its old shape — then `save()` + `renderTree()`. Cancel/Escape change nothing. Unknown/invalid keys render as the default and are dropped by `normalize()` on import; export carries `icon` through `prune()` as is (envelope still `version:1`). |
| context menu | `openMenu`, `showMenu`, `closeMenu`, `duplicate` | `showMenu(x, y, items)` renders `[label, fn, danger?]` / `["-"]` items into `#menu` (shared with the header's Paste dropdown). Right-click on a row selects it (persisted); a right-clicked page is also opened, unless an edit is in progress. Folder rows get "New page/folder here" and "Change icon". Deleting a folder (`remove()`) shows the item count **and** a read-only, indented `.pick-tree.ro` list of every nested folder/page in the confirm dialog. |
| sanitizing | `OK_TAGS`, `OK_ATTR`, `DROP_TAGS`, `okHref()`, `clean()`, `esc()`, `attr()` | `clean()` runs on every render, paste and import. `DROP_TAGS` (`script`, `style`, `iframe`, `template`, `svg` …) are removed with their content; any other unknown element is *unwrapped* (its sanitised children stay, so `<section><p>` keeps its paragraphs). HTML comments are dropped. A `<b>`/`<strong>` with `font-weight:normal|100–400` (Google Docs' clipboard wrapper) is unwrapped too. `href` must be scheme-less or `http(s):`/`mailto:`; `src` must be `http(s):` or `data:image/`. `<pre>` is normalised to `class="code" data-lang="…"` with unknown languages forced to `plain`. `esc()` escapes `& < >`; `attr()` additionally escapes `"` and is what goes inside `value="…"`/`href="…"`. |
| highlighting | `LANGS`, `highlight()` | Regex with named groups per language; output uses `.t-comment`, `.t-string`, `.t-number`, `.t-keyword`, `.t-type`, `.t-fn`, `.t-tag`, `.t-attr`. |
| code formatting | `LANGS[lang].fmt`, `fmtClike`, `fmtJson`, `fmtSql`, `fmtHtml`, `fmtPython`, `fmtBash`, `fmtPlain`, `preText` | Every language has `fmt(code) → string` (throw to refuse; the message is toasted as "Can't format: …"). They are small pretty-printers, not parsers: strings/comments are copied through. `fmtClike(code, unit, lineComment)` (C# = 4 spaces, JS/CSS = 2) breaks after `{`/`;`, before `}`, keeps `} else {`/`catch`/`finally`/`while` together and never re-breaks inside `( )`/`[ ]`. JSON = `JSON.parse` + `stringify(…, 2)`; text that is not valid JSON is retried once as the body of a string literal, so escaped JSON (`{\"a\":1}`) is unescaped first. SQL upper-cases keywords/functions, one clause per line, `AND`/`OR` indented one level under their clause (`BETWEEN x AND y` kept), sub-queries indented under the line that opened the parenthesis with `)` on its own line. HTML: one block tag per line, inline tags (`INLINE_TAGS`) stay with their text, `script/style/pre/textarea` verbatim. Python/Shell/plain only normalise indentation (every Python level → 4 spaces; Shell nests on `then/do/else/in/{/(`). `preText(pre)` reads a block's text with `<br>` → `\n` and zero-width spaces removed. |
| diagrams | `LANGS.diagram`, `fmtDiagram`, `dgWidth`, `dgNormalize`, `dgGrid`, `DG_GLYPH`/`dgDef`, `dgScan`, `dgModel`, `dgSvg`, `DG_BRANCH`, `dgItem`, `dgTree`, `dgTreeEl`, `dgTable`, `dgKind`, `dgLooks`, `dgRender` | The **Diagram** language (second in `LANGS`, no `re`) draws ASCII/Unicode art in view mode. **Stored data never changes shape**: only `<pre class="code" data-lang="diagram">text</pre>` reaches `raw`/`node.content`/storage/exports; the drawing is viewer-DOM only (like the collapsed state), `SVG` stays in `DROP_TAGS` and `clean()`/`OK_TAGS`/`OK_ATTR` are untouched. An older build shows such a block as plain text. Pipeline: `dgNormalize(text)` (CRLF, BOM, ZWSP, Unicode spaces → space, tabs to **4-column stops**, trailing space, outer blank lines, common indent — also the whole of `fmtDiagram`, which throws "empty diagram") → `dgGrid(lines)` (`{rows, cols, cells, at(r,c)}`; `dgWidth` = 2 for CJK/emoji, 0 for combining marks/ZWJ/VS16; a wide char is followed by a `""` continuation cell; `at()` is `" "` outside the text) → `dgKind(lines)` picks, in order, `tree` (≥2 `DG_BRANCH` lines `├── └── ┣━ \|-- +-- \`-- \\-- \|__`, the rest root/filler), `table` (`mdBorder` first+last, ≥2 `\|…\|` rows, and `dgTable`: one rectangle — borders with no gaps, every row's bars on exactly the border's corner/junction columns, no other box-drawing inside a row — so cards side by side or boxes nested in a frame are grids; or a GFM pipe table), `grid` (any line cell), `outline` (≥2 indent levels), `text`. **Tree/outline**: `dgTree` → `{name, note, folder, children}` (depth by a column stack, so 2/3/4-column steps work; trailing `/` or children = folder; `# // <-- <- ←` after 2 spaces = note) → `dgTreeEl` (`ul.dg-tree`, folders `<details open><summary>`, files `.dg-file`, notes `.dg-note`; `createElement` + `textContent`). **Table**: `mdCells` → `mdTableHtml` → `clean()` → innerHTML (the only innerHTML). **Grid**: `dgScan(grid)` → `cell[][]` of `null` or `{g:"line"\|"head"\|"dot", ch, dirs:Set, style, hs, vs, round?, low?, heads?, hollow?}`: `DG_GLYPH` box-drawing/arrow glyphs are always lines (`dgDef(chars, dirs, hs, vs, more)` — one line per family); ASCII is graphic only in context, iterated to a fixpoint (`-`/`=`/`_` runs ≥3 or touching `+ \| . ' * o` / a glyph / `>`,`<` — `->` yes, `=>` no, `p->next` no; `\|` next to a vertical candidate or a diamond diagonal; `:` in a vertical run, not `key:`; `+` with linked neighbours; `.`/`'` rounded corners; `/` `\` only in diagonal runs or touching `+ * < >`; `>`/`<` arrowhead after a line or a diamond vertex, or a **crow's foot** (`foot` = side it opens to) between an h-line and a box side (`───<│`, `│>───`, ER "many"); `^`, `v` heads; `* o # ● ○ …` dots only when a line enters them; letters/digits around protect words). Then `+`/dot links are recomputed, a line ending next to a straight perpendicular line **snaps** to it, and corners take the dashes of the edge they join. `dgModel(grid, cells)` → `{segs, boxes, heads, dots, texts, feet}`: half-cell stubs merged per row/column/diagonal into `segs` `{kind:"h"\|"v"\|"d"\|"curve", x1,y1,x2,y2, style}` (cell centre = `(c*8+4, r*17+8.5)`, `_` on the cell bottom, rounded corners = quadratic curves); `boxes` `{r1,c1,r2,c2,title,dividers,style,round,group,depth}` found from a top-left corner (`e`+`s`, no `n`), one text gap in the top edge = `title`, full-width rows that continue down = `dividers`, `group` = titled or dashed, `depth` = containing boxes; anything that doesn't close stays lines; `heads` `{r,c,dir,x,y,points}` (tip touches the line it points at); `feet` `{r,c,dir,points}` (vertex on the far edge of the cell, two prongs to the box side; the middle prong is the line itself); `texts` `{r,c,w,text,hd,label,title}` (one space joins words, 2+ split; `hd` = rows above the first divider, or the single own text row of a titled box; `label` = between h-line cells or in a gap of a vertical line). `dgSvg(model, rows, cols)` builds `svg.dg-svg` (viewBox = `cols*8 × rows*17`) with `g.dg-boxes` (`rect.dg-box[data-depth]` + `.dg-group`), `g.dg-lines` (`path.dg-line` + `.dg-heavy/.dg-double/.dg-dashed`), `g.dg-heads` (`polygon.dg-head`, `path.dg-foot`, `circle.dg-dot`), `g.dg-text` (`text.dg-t` + `.dg-hd/.dg-label/.dg-title`, `textLength = w*8`, `lengthAdjust="spacingAndGlyphs"`) — only `createElementNS` + `textContent`, nothing is measured. `dgRender(text)` → `{kind, el, note?}`: over 400 rows / 300 columns → no `el`, note "Too large to draw"; kind `text` → note "No diagram shapes found". `dgLooks(text)` (paste auto-detect) is true only for a tree, or a grid with a box, an arrowhead or ≥3 box-drawing characters. |
| document | `openId`, `openPage()`, `open`, `crumbs`, `render`, `decorate`, `commit`, `setMode`, `format`, `unformat`, `tail`, `caretTo` | `openId` is the page in the panel; `openPage()` returns its `find()` record or `null`. `commit()`, `crumbs()`, `render()`, the title input and `Ctrl+E` all go by `openId`, never by `db.selected`. `open()` called mid-edit first flushes the editor into the page it belongs to. `render()` with no open page hides the panel and drops back to view mode. `setMode()` moves `raw` between viewer / `#editor` (contenteditable) / `#source` (textarea); the textarea shows `format(raw)` (one tag per line) and everything read back from it passes through `unformat()` so the round trip is lossless (the added newlines would otherwise show inside `white-space:pre-wrap` blocks). `decorate()` wraps each code block in view mode in `.code-wrap` with a `.code-bar` (collapse toggle `.tog`, language label, `.n` line count, `.copy` button). Every block starts **collapsed** (`.code-wrap.collapsed` hides the `<pre>`; the chevron points down, `aria-expanded="false"`, title "Expand") on every render — i.e. whenever a page is opened or editing ends. The collapsed state is viewer-DOM only: it is never written to `raw`, `node.content`, storage or exports, and the editor never sees the chrome. For a `diagram` block `decorate()` also calls `dgRender(code)` inside a `try/catch`: the label becomes `Diagram · <kind>` (`i.dg-kind`), the drawing goes into a `.dg` container placed after the `<pre>` inside the wrap, the wrap gets `dg-on` (CSS hides the `<pre>`; without `dg-on` the `.dg` is hidden; `.collapsed` hides both), and a `.view` button before Copy toggles `dg-on` (text "Text"/title "Show source text" while the drawing shows, "Diagram"/"Show diagram" otherwise). Blocks still start collapsed; the view state resets on every render and is never stored; Copy copies the ASCII. When there is nothing to draw (failure → "Couldn't draw this diagram — showing text", too large, no shapes) a `.dg-msg` note is shown above the text and there is no `.dg`/`.view`; one failing block never stops the others. `pre.code[data-lang="diagram"]` never wraps (`white-space:pre`). `tail()` guarantees the page **always ends with an empty line** (`<p><br></p>`) — after text as well as after a block/image — so the caret can always move below the last thing on the page. It runs on `setMode("edit")` and inside every `commit()` in edit mode (appending at the end never moves the caret), so the empty line is part of the saved content; old pages gain it on their first edit. |
| editor commands | toolbar `data-cmd` buttons, `tbBlock`, `tbImage`, `tbLink`, `tbTable`, paste & keydown handlers, `currentPre`, `insertText`, `insertImage` | Formatting uses `document.execCommand`. `tbBlock` inserts `<pre>` + trailing `<p>`; if the new block ends up first in the editor or right after another `pre`/`table`/`hr`, an empty `<p><br></p>` is put before it so the caret can move above the block. Inside a `<pre>`: Enter = newline, Tab = two spaces, Shift/Ctrl+Enter = leave the block. `insertText()` goes through `document.execCommand("insertText")` so the browser's undo stack records it (Ctrl+Z works after a plain-text paste or Tab); the Range API is only a fallback when the command is unsupported. It and the hand-written keydown handlers mutate the DOM without an `input` event, so every such path sets `raw` and calls `commit()` itself. Images: a copied bitmap (screenshot) in `clipboardData.files` on paste, or the **Image** button via `navigator.clipboard.read()`, goes through `insertImage(blob)` → `FileReader.readAsDataURL` → `<img src="data:image/…">` embedded in the page (base64 lives in `localStorage` with everything else, so big screenshots eat the ~5 MB quota). Inside a code block a pasted image is ignored and the text falls back to plain paste. |
| paste from… | `#tbPaste`, `clipText`, `pasteAt`, `parseExcel`, `excelTable`, `pasteExcel`, `mdToHtml`, `mdBlocks`, `mdInline`, `mdCells`, `MD`, `MD_LANG`, `pasteMd` | **Paste ▾** in the editing toolbar (right after **Image**, so only visible in edit mode) opens a `showMenu` dropdown: "From table", "From markdown". Both read the clipboard via `clipText()` (toasts like the Image button when blocked/denied; `null` = stop) and place the caret via `pasteAt(keep)`. **From markdown**: `mdToHtml(text)` is a small line-based GFM converter (not full CommonMark) — ATX/setext headings, paragraphs (soft break → space, two spaces/`\` → `<br>`), `---`/`***` rules, nested `-*+`/`1.` lists (a line indented more than the marker belongs to the item; the first paragraph of an item is unwrapped), task boxes → ☐/☑ text, fenced (info string mapped through `MD_LANG` to a `LANGS` key, else `plain`; `ascii`, `ascii-art`, `asciiart`, `tree`, `svgbob`, `bob`, `goat`, `ditaa` → `diagram`, `mermaid` is not; a fence with no info string or `text`/`txt`/`plaintext`/`plain` becomes `diagram` when `dgLooks(body)`) and 4-space indented code, `>` quotes (recursive; `[!NOTE]` etc. → bold label), GFM pipe tables (psql `---+---` too) and ASCII tables with `+---+` or box-drawing borders (first row = header). `mdInline` does code spans, escapes, images, links, autolinks, bare URLs, `***`/`**`/`__`/`*`/`_`/`~~` — raw HTML is escaped, never parsed. The result passes through `clean()`. `pasteMd` appends `<p><br></p>` unless the output ends in a paragraph/heading and gives a pasted `pre`/`table`/`hr` at the top (or after another block) an empty line above it, then `commit()`. **From table**: `pasteExcel(keep)` reads the text, `parseExcel` splits Excel's text (CRLF rows, tab cells, `"…"` around cells with line breaks/tabs, trailing CRLF dropped, ragged rows padded) and `excelTable` builds the same `<thead><th>` + `<tbody>` shape as the Table button (first row = header), followed by `<p><br></p>`. It restores the caret captured when the menu opened (`keep`), since clicking a menu item blurs the editor, and inserts there. Ends with `commit()`. |
| code block headers | `makeHead`, `syncBlocks`, `scheduleSync`, `#blocks` layer | While editing, an absolutely-positioned header (language `<select>` + Format + delete) floats over each `<pre>`, re-synced via MutationObserver → rAF and on resize. Format runs `LANGS[lang].fmt` on `preText(pre)`, writes the result back as `textContent` with exactly one trailing `\n`, commits and puts the caret in the block; unchanged output toasts "Already formatted". `syncBlocks()` ends by calling `syncTable()`. |
| table tools | `#tbl` bar, `currentCell`, `isHeader`, `addRow`, `addCol`, `moveRow`, `moveCol`, `removeTable`, `TABLE_OPS`, `syncTable` | While editing, `#tbl` (insert row above/below, move row up/down, delete row, insert column left/right, move column left/right, delete column, delete table) floats 36 px above the table the caret is in; `.body[contenteditable] table` gets `margin-top:46px` to make room. `syncTable()` binds `tbl._cell`, and is scheduled on `selectionchange`, editor `click`/`keyup` and every `syncBlocks()`. Every op takes the current cell, mutates the table and returns the cell to put the caret in; cells are addressed by `cellIndex` (colspan/rowspan are not expanded). The header (`<thead>` row, or a first row of `<th>`) is never grown or removed: rows added from a header cell become the first body row, `− Row` from the header removes the first body row (toast when there is none). `↑ Row`/`↓ Row` (`moveRow`) swap the row with its sibling `<tr>` in the same section — the header never moves and no row moves above it; `← Col`/`→ Col` (`moveCol`) swap the column with its neighbour in every row, header included, skipping rows too short to have both cells. When there is nothing to swap with the table is left alone and a toast says why; the caret stays in the moved cell. Removing the only row/column, or `− Row` on the last row, replaces the table with `<p><br></p>`; delete table asks `confirmBox`. `Tab`/`Shift+Tab` in a cell move between cells; `Tab` in the last cell appends a row. |
| export / import | `btnExport`, `#file` onchange, `prune`, `normalize`, `pickBox` | Export: pick items → JSON `{app:"virtualpc", version:1, exportedAt, tree}` named `virtualpc-YYYY-MM-DD.json`. Import: parse → `normalize` (new ids, sanitised content) → pick → Merge or Replace. |
| dialogs | `openDialog`, `closeDialog`, `confirmBox`, `promptBox`, `linkBox`, `choiceBox`, `pickBox` | Promise-based, rendered into `#dialog` inside the `#veil`. Escape and a click on the veil call `veil._esc`. `confirmBox(title, msg, label, extra)` — `extra` is optional, already-escaped markup placed between the message and the buttons. `promptBox` is currently unused. |
| sidebar + shortcuts | `grip`, `toggleNav`, global `keydown` | Sidebar width clamped 190–520 px via the `--sw` CSS variable. |
| first run | `SEED` | A "Getting started" folder with a "How this wiki works" page when nothing is stored. |

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl/Cmd+E` | Toggle edit mode (needs an open page); leaving edit commits |
| `Ctrl/Cmd+S` | Save; leaves edit/source mode |
| `Ctrl/Cmd+\` | Toggle sidebar |
| `Ctrl/Cmd+F` | **Not intercepted** — left to the browser's find-in-page so the user can search a word inside the open page. The sidebar search box is reached by clicking it. |
| `Escape` | Close dialog → close menu → leave edit mode (in that priority) |
| `Enter`/`Tab` in title | Jump into the body (starts editing in view mode) |
| In code block: `Enter` / `Tab` / `Shift+Enter` | Newline / two spaces / new paragraph after the block |
| In table cell: `Tab` / `Shift+Tab` | Next / previous cell; `Tab` in the last cell adds a row |
| `Backspace` at the start of a quote | Unwraps the `<blockquote>` (`quoteStart`/`unquote`) — the browser can't when it is the first block |
| In text: `Tab` / `Shift+Tab` | Insert / remove a tab character (`white-space:pre-wrap; tab-size:4` on text containers makes it visible). In a list item they still `indent`/`outdent` (nest the item) |
| In quote: `Enter` / `Shift+Enter` | Ends the quote, text after the caret goes into a new `<p>` (`currentQuote`/`splitQuote`) / line break inside the quote. Inside a list item within the quote, Enter is left to the browser (new item) |

### Data flow while editing

1. `setMode("edit")` copies `raw` into `#editor`, calls `tail()`, focuses.
2. Typing → `input` event → 500 ms debounce → `raw = editor.innerHTML; commit()`.
3. `commit()` (in edit mode) first calls `tail()` and re-reads `raw` from the
   editor, writes `raw` into `openPage().node.content`, calls `save()`
   (250 ms debounce to `localStorage`) and flashes "Saved" in `#status`.
4. Toolbar buttons, header selects, block deletion, the table bar, paste and the
   custom keydown handlers (Tab, Enter in code blocks / quotes …) call `commit()` directly.
5. `Done` / `Ctrl+S` / `Ctrl+E` / `Escape` commit and return to view;
   `beforeunload` commits and then `flush()`es straight to `localStorage`.
6. Clicking or right-clicking another page while editing: `open()` writes the
   editor's HTML into the page that was being edited, then loads the new one.

## Conventions

- Keep the app in the single HTML file; there is no bundler. `desktop/` is only
  the host — app features go in the HTML, not in C#. The host is not unit-tested;
  check it by running the app. Keep total memory (host + WebView2 processes,
  Task Manager "Memory") under 100 MB on typical pages. Match the
  existing compact style (short helper names, `$()` for `getElementById`,
  section banners `/* ═══ name ═══ */`).
- The exe pins the hash of the one inline `<script>` in its CSP. Keep exactly
  one attribute-less `<script>`; wire events with `addEventListener`/`.onx =`,
  never `on…="…"` attributes (in the markup or in generated HTML), `javascript:`
  URLs, `eval`/`new Function` or a second script — JSDOM ignores CSP, so these
  would pass the tests and break only in the app. `host.test.js` pins the first
  two; check anything else by running the app.
- New HTML that ends up in page content must pass through `clean()`; new
  attributes need adding to `OK_ATTR`. Anything interpolated into `innerHTML`
  goes through `esc()` (text) or `attr()` (attribute values) — including values
  that came out of `clean()`, such as `data-lang`.
- Anything that changes `db` must call `save()` and, if the sidebar is affected,
  `renderTree()`; anything that changes the open page should go through `commit()`.
  If a handler edits the editor DOM itself (Range API, `insertText()`), it must
  also set `raw` and call `commit()` — no `input` event will fire for it.
- Use `openPage()` / `openId` for "the page being shown or edited";
  `db.selected` is only the sidebar highlight.
- **Every change must stay backwards-compatible with existing data**: what is
  already in `localStorage` (`virtualpc.data.v1`) and in old exported JSON
  backups must keep loading and importing unchanged. Prefer view-only state
  (kept in the DOM, like collapsed code blocks) over new stored fields; when a
  stored field is unavoidable, make it optional with a default that reproduces
  the old behaviour, tolerate its absence in `load()`/`normalize()`, and never
  rename `type`/`id`/`name`/`content`/`children`/`open` or the `{app, version,
  tree}` export envelope. Add a round-trip test with an old-shaped fixture.
- Adding a language: add an entry to `LANGS` (label + global regex with the
  named groups above) and assign a `fmt` (reuse `fmtClike` for brace
  languages, `fmtPlain` as a fallback — `format-code.test.js` asserts every
  language has one). The header `<select>` and `decorate()` pick it up
  automatically. (`highlight.test.js` pins the key order of `LANGS`.)
- Diagrams: add a glyph family with one `dgDef(...)` line; new ASCII rules go
  in `dgScan`'s `rule()`. Anything the renderer puts on the page is built with
  `createElement(NS)` + `textContent` and stays in the viewer DOM — never in
  `raw`. Fixtures F1–F14 in `diagram.test.js` are the acceptance corpus.
- When changing behaviour, update or add tests in `test/unit/` — the suite
  exercises every button and handler through the real markup.

## Workflow for new features (test-first, mandatory)

Every new feature or behaviour change the user asks for is built **test-first**,
in this order — no step may be skipped:

1. **Write the unit test(s)** in `test/unit/` (the existing file for that
   feature area, or a new `*.test.js`) that describe the requested behaviour
   through the real markup/handlers, before touching `virtualwebpc.html`.
2. **Run them and watch them fail** (`cd test && npx vitest run unit/<file>`).
   Confirm they fail for the expected reason (missing behaviour), not because of
   a typo or a broken test. A test that passes before the change proves nothing —
   fix the test.
3. **Implement the feature** in `virtualwebpc.html`.
4. **Run the new tests and the full suite** (`npm test`) — all must pass. Do not
   weaken or delete an assertion to make it pass.
5. Update this file (architecture table, shortcuts, notes) when the feature adds
   or changes names or behaviour.

When reporting back, state that the tests were seen failing first and passing
after, with the test names. Bug fixes follow the same loop: a test reproducing
the bug must fail before the fix.

## Known bugs

- **`clean()` unwraps `<svg>`/`<math>` instead of dropping them.** In an HTML
  document those elements keep a lower-case `tagName` (`"svg"`), so the
  upper-case `DROP_TAGS` lookup misses them; their (sanitised) text ends up in
  the page instead of being removed with the element. Nothing unsafe gets
  through — children still pass the whitelist. Pinned by the `it.fails` test
  "removes <svg> and <math> together with their content" in
  `sanitize.test.js`; the fix is to compare `child.tagName.toUpperCase()`.

When you find one you are not fixing right away, add a test that
asserts the correct behaviour as `it.fails` in `test/unit/` and describe it
here; flip it back to `it` when it is fixed (see `test/README.md`).

Fixed regressions worth knowing about (each is pinned by a test):
page switch mid-edit wrote the old body into the new page; `commit()` keyed on
`db.selected` lost edits when a folder was highlighted and could overwrite a
right-clicked page; `beforeunload` relied on the debounced save; the HTML view
added visible whitespace to quotes/lists; `esc()` in `value="…"`; `data-lang`
reached `innerHTML` unescaped; pasted Google Docs text came out bold; Word's
`<style>` block was pasted as text; plain-text pastes (and pastes into code
blocks) were inserted with the Range API and could not be undone with Ctrl+Z.

## Testing notes

- Tests never import from the HTML; `helpers/app.js` loads the file into JSDOM
  with `runScripts: "dangerously"` and reads internals via `window.eval`
  (`app.get("db")`, `app.call("setMode","edit")`).
- Timers are routed to Vitest fake timers: call `app.flush()` to fire the save
  debounce, autosave, toasts and rAF-based header sync.
- `document.execCommand` does not exist in JSDOM; the harness records calls and
  really applies `insertHTML`. Formatting commands are asserted by
  command/value, not by resulting DOM.
- See `test/README.md` for the file-by-file map and the harness API.
