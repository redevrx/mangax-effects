# mangax-effects

Official effects for the **MangaX** reader. An effect is a small script or stylesheet that runs on
the page you are reading — auto scroll, hiding ads, anything that makes a site nicer to read.

Effects installed from this repository show the **Official** badge in the app. The badge comes from
where the files were downloaded (a repository owned by `redevrx`), never from what `effect.json` says.

| Effect | Category | Type | What it does |
|---|---|---|---|
| [Auto scroll](effects/auto-scroll) | reading | toggle | Scrolls at a steady pace; touch to pause |
| [Tap to turn](effects/tap-scroll) | navigation | toggle | Tap the bottom or top of the screen to move a screen |
| [Dark page](effects/dark-page) | appearance | toggle | Dark or dimmed pages for night reading |
| [Hide ads](effects/hide-ads) | cleanup | style | Hides common ad slots with CSS only |
| [Kill pop-ups](effects/kill-popups) | cleanup | action | Removes overlays and cookie walls covering the page |

## Install in the app

**Effects** (in the floating menu) → **Browse effect market**. Search, pick a category, tap
**Install**. The market lists every effect in this repository and in every repository listed in
[`registry.json`](registry.json).

An effect can also be installed from its folder link (market → link icon):

```
https://github.com/redevrx/mangax-effects/tree/main/effects/auto-scroll
```

The app pins the commit that link points at. Pushing to `main` never changes an effect someone
already installed; the market shows **Update** once the `version` in `index.json` is higher.

## List your own effects in the market

Anyone can publish effects from their own repository:

1. Make a public GitHub repository with the same layout as this one — `effects/<name>/effect.json`
   plus its script or stylesheet. Ids use your own prefix, e.g. `yourname.<name>`.
2. Copy [`tools/check.mjs`](tools/check.mjs) and [`schema/`](schema) into it and run
   `node tools/check.mjs --fix`. That writes the `index.json` the market reads.
3. Push. You can try it straight away: market → repositories icon → paste
   `https://github.com/<you>/<repo>`. It shows on your device only.
4. To list it for everyone, open a pull request here adding it to [`registry.json`](registry.json):

   ```json
   { "repo": "<you>/<repo>", "ref": "main" }
   ```

Effects from other repositories show a **Community** badge and a warning before install. Only
repositories owned by `redevrx` are **Official** — being in the registry does not change that.

## Repository layout

```
mangax-effects/
├── index.json                  what the market lists (generated — do not edit by hand)
├── registry.json               other repositories the market reads
├── schema/effect.schema.json   editor help for effect.json
├── AGENTS.md                   the full effect API and rules — for AI assistants and people
├── tools/check.mjs             checks every effect the way the app will
├── tools/devtools-runner.js    runs an effect in desktop Chrome with the app's ctx
└── effects/
    ├── auto-scroll/
    │   ├── effect.json
    │   ├── main.js
    │   └── README.md
    └── hide-ads/
        ├── effect.json
        └── style.css
```

One folder per effect. The folder name is the effect's id without the `redevrx.` prefix.

## Adding an effect

1. Create `effects/<name>/` with an `effect.json` and its `main.js` or `style.css`.
2. Run the checker. It also brings `index.json` up to date:

   ```sh
   node tools/check.mjs --fix
   ```

3. Try it on the real site in desktop Chrome: paste [`tools/devtools-runner.js`](tools/devtools-runner.js)
   into the DevTools console, then paste your `main.js`. `mangaxTest.stop()` switches it off.
4. Try it on a phone by installing from your branch:
   `https://github.com/redevrx/mangax-effects/tree/<branch>/effects/<name>`
5. Commit, push, merge.

When changing an existing effect, bump its `version` — the app shows it on the install screen.

### Types

| `type` | In the app | Needs |
|---|---|---|
| `style` | switch | `style` only. The app adds and removes the stylesheet; no script runs |
| `action` | Run button | `entry`. Runs once; nothing to switch off |
| `toggle` | switch | `entry`. Runs until switched off; return a cleanup function |

### Template

`effects/<name>/effect.json`

```json
{
  "$schema": "../../schema/effect.schema.json",
  "schema": 1,
  "id": "redevrx.<name>",
  "version": "1.0.0",
  "name": { "en": "My effect", "th": "เอฟเฟกต์ของฉัน" },
  "description": { "en": "What it does, in one line.", "th": "ทำอะไร สั้น ๆ หนึ่งบรรทัด" },
  "author": { "name": "redevrx", "url": "https://github.com/redevrx" },
  "type": "toggle",
  "category": "reading",
  "icon": "auto_fix_high",
  "entry": "main.js",
  "matches": ["*://*/*"],
  "engines": ["any"],
  "permissions": [],
  "keywords": [],
  "options": []
}
```

`effects/<name>/main.js`

```js
mangax.effect(function (ctx) {
  ctx.addStyle('body { letter-spacing: .02em; }');
  ctx.observe('.popup-overlay', function (el) { el.remove(); });

  return function () {
    // Undo anything not registered through ctx. Listeners, observers and styles added
    // through ctx are removed by the app.
  };
});
```

### Icons

`icon` takes one of these names. Any other name shows the default icon for the effect's `type`.

| Category | Names |
|---|---|
| General | `swap_vert` `block` `visibility_off` `dark_mode` `light_mode` `contrast` `palette` `speed` `timer` `text_fields` `format_size` `close` `bolt` `touch_app` `skip_next` `auto_fix_high` |
| Reading | `menu_book` `auto_stories` `translate` `record_voice_over` `volume_up` `bookmark` `zoom_in` `fit_screen` |
| Cleanup | `cleaning_services` `hide_image` `filter_alt` `delete_sweep` `do_not_disturb` |
| Appearance | `brightness_6` `invert_colors` `format_color_fill` `blur_on` `crop` `image` `wallpaper` |
| Navigation | `keyboard_double_arrow_down` `vertical_align_top` `arrow_downward` `swipe` `open_in_new` `link` |
| Utility | `notifications` `download` `content_copy` `refresh` `settings` `pets` `emoji_emotions` `star` `favorite` |

### `ctx`

| | |
|---|---|
| `ctx.options` | The reader's settings for the options declared in `effect.json` |
| `ctx.onOptions(fn)` | Called when the reader changes a setting while the effect runs |
| `ctx.on(target, type, fn, opts)` | `addEventListener`, removed when the effect stops |
| `ctx.observe(selector, fn)` | `fn(element)` once for every match, now and as the page adds more |
| `ctx.addStyle(css)` | Adds a `<style>`, removed when the effect stops |
| `ctx.onUrlChange(fn)` | The page changed its URL without reloading |
| `ctx.onEvent(name, fn)` | `fn(data, name)` on app events (below); `"*"` hears all of them |
| `ctx.toast(text)` | Shows a message in the app. Needs `"permissions": ["toast"]` |
| `ctx.call(cmd, args)` | Sends a command to the app (below); returns a Promise |
| `ctx.stop()` | Switches the effect off from inside |
| `ctx.id` · `ctx.engine` · `ctx.site` | This effect, `manga` / `novel`, the page's host |
| `ctx.auto` | `true` when the app started it on page load, `false` when the reader switched it on or ran it |

### App events

Listen with `ctx.onEvent`. The `translate:*` events' `data` has `type` (`manga` / `novel`) and
`mode` (`realtime` for the scan button, `full` for a whole-chapter scan).

| Event | When | `data` |
|---|---|---|
| `translate:start` | The reader starts a translation | `type`, `mode` |
| `translate:done` | A batch (or the whole chapter) is translated | `type`, `mode` |
| `translate:failed` | A batch or the chapter could not be translated | `type`, `mode`, `message` |
| `translate:stop` | The translation stopped | `type`, `mode`, `reason`: `user` (pressed stop) or `auto` (page or chapter changed) |
| `engine:change` | The reader switched between manga and novel | `type` |
| `menu:open` | The browser menu opened | `byEffect`: `true` when a script opened it with `menu.open` |
| `menu:close` | The browser menu closed | `key`: the button pressed, or `null` when dismissed |

- Treat them as signals, not a count: two changes in quick succession can arrive as one.
- A toggle's listeners are removed when it stops; an action's stay until the page changes.
- No permission is needed.

```js
mangax.effect(function (ctx) {
  ctx.onEvent('translate:done', function (data) {
    if (data.type === 'manga') ctx.toast('Chapter ready').catch(function () {});
  });
  return function () {};
});
```

### App commands

`ctx.call(cmd, args)` returns a Promise. It rejects with a message when the command is unknown
(an older app), the permission is missing, or the command cannot run right now — always add
`.catch`.

| Command | Permission | `args` | Resolves to |
|---|---|---|---|
| `toast` | `toast` | `{ text }` | `null` (same as `ctx.toast`) |
| `menu.items` | `menu` | | `{ engine, items: [{ key, label, active }] }`, in the menu's order |
| `menu.press` | `menu` | `{ key }` | `null`; rejects when that button is not in the menu right now |
| `menu.open` | `menu` | `{ x, y }`, 0–1 of the screen | `null`; the menu opens next to that point |
| `menu.replace` | `menu` | `{ on }` | `true` when the menu button is now hidden |
| `engine.get` | none | | `"manga"` or `"novel"` |
| `engine.set` | `engine` | `{ type: "manga" \| "novel" }` | the engine now in use |

Menu keys: `scan` (start / stop the scan), `effects`, `read_aloud` (novel), `full_context_scan`
(manga), `bubble_edit` and `export_chapter` (manga, once the page has translations), `settings`.
Buttons come and go with the engine and the page, so ask `menu.items` rather than assuming.

`menu.replace` hides the app's floating menu button **only while the effect runs**. Stopping
the effect, an error, or leaving the page brings the button back, so the reader is never left
without a way into the menu. An effect that hides it must give the reader another way to open
it (`menu.open`).

```js
mangax.effect(function (ctx) {
  var button = document.createElement('button');
  button.textContent = '☰';
  button.style.cssText = 'position:fixed;right:16px;bottom:96px;z-index:999999';
  document.body.appendChild(button);

  ctx.call('menu.replace', { on: true }).catch(function () {});
  ctx.on(button, 'click', function () {
    var r = button.getBoundingClientRect();
    ctx.call('menu.open', {
      x: (r.left + r.width / 2) / innerWidth,
      y: (r.top + r.height / 2) / innerHeight,
    }).catch(function () {});
  });

  return function () { button.remove(); };
});
```

`effect.json`: `"permissions": ["menu"]`. MangaX Pet (`effects/mangax-pet`) does the same with
its `replaceMenu` option and a long-press.

### Starting on page load

`"runAt": "pageLoad"` starts the effect whenever a page it matches finishes loading — any type,
actions included. The reader can switch that off per effect (or on for a `manual` one) in the
Effects sheet, and can always still switch it on or run it by hand. `documentStart` currently
behaves like `pageLoad`.

### Options

Declared in `effect.json`; the app draws the settings and passes the values in `ctx.options`.

| `type` | Fields |
|---|---|
| `boolean` | `default` |
| `slider` | `min`, `max`, `step`, `default`, `unit` |
| `select` | `choices: [{ "value", "label" }]`, `default` |
| `text` | `default`, `placeholder`, `maxLength` |

### Rules

- **Do not use the page's own globals.** On iOS effects run in a separate script world: they share
  the page's DOM, not its variables.
- Leave elements with `data-tl-*` or `data-manga-*` attributes alone — they belong to the MangaX
  translation scan.
- Pick the one `category` people would look in: `reading`, `cleanup`, `appearance`, `navigation`,
  `utility`. Add `keywords` (any language) for words the name does not contain.
- One script file per effect, no imports, 1 MB at most; `effect.json` 128 KB at most.
- An error thrown inside `ctx` callbacks stops the effect and tells the reader. Errors in callbacks
  you schedule yourself (`requestAnimationFrame`, `setTimeout`) are not caught — guard them.
- Match only the sites an effect is for when it is site-specific: `https://*.example.com/read/*`.

## Writing an effect with AI

AI assistants write effects well — once they know the API. Left to guess, they invent members
that do not exist (`ctx.on('stop')`, `ctx.storage`, `GM_addStyle`), use selectors that hide half
the page, or forget to undo what they changed. The script then fails the moment it is switched on.

[`AGENTS.md`](AGENTS.md) is the complete contract — every `ctx` member, the manifest fields, the
rules and a checklist. Claude Code, Codex, Cursor, Copilot and opencode read it automatically when
they work in this repository (Claude Code through [`CLAUDE.md`](CLAUDE.md)). With a chat assistant
(ChatGPT, Claude.ai, Gemini) paste `AGENTS.md` into the conversation first.

### What to give it

The AI cannot see the site. Give it what you would give a person:

- the site URL, and whether you read it in **manga** or **novel** mode
- what should happen, and what must **not** break (the reader, images, chapter buttons)
- the real HTML of the part to change: DevTools → right-click the element → **Copy → Copy
  outerHTML**. Screenshots alone lead to guessed selectors
- for a fix: the error the app showed, and what the page looked like

### A prompt that works

```text
Read AGENTS.md. Write a MangaX effect in effects/<name>/.

Site: https://example.com/novel/123/chapter-4  (novel mode; the site also uses www.example.com)
Goal: hide the "download our app" bar pinned to the bottom of the chapter. Toggle, off by default.
Must keep: the chapter text, the next/previous chapter buttons.
HTML of the bar:
<div class="app-promo sticky-bottom">...</div>

Use only the ctx API in AGENTS.md. When done, run `node tools/check.mjs --fix` and show me
how to test it with tools/devtools-runner.js.
```

### Check what it wrote

Before you commit, even when it "works":

- `node tools/check.mjs --fix` prints ✓ for the effect
- every `ctx.…` in `main.js` is listed in the `ctx` table in [`AGENTS.md`](AGENTS.md#ctx--the-complete-api)
- run it with `tools/devtools-runner.js`, then `mangaxTest.stop()` — the page must look exactly as
  before. The runner reports wrong `ctx` calls the way the app would
- no broad selectors (`*`, `body *`, `[class*='modal']`), no `fetch`, nothing reading cookies or
  login data
- `version` bumped if the effect already existed

When something fails on the phone, give the AI the error text from the app and the HTML, not only
"it doesn't work".

## ภาษาไทยสั้น ๆ

- ติดตั้งในแอพ: **Effects → เลือกดูในตลาดเอฟเฟกต์** ค้นหาหรือเลือกหมวด แล้วกดติดตั้ง
- ลง repo ของตัวเอง: ทำโครงเดียวกับ repo นี้ → รัน `node tools/check.mjs --fix` → ลองเพิ่มในแอพ (ไอคอน repository) → เปิด PR เพิ่มชื่อ repo ลง `registry.json` ให้ทุกคนเห็น
- เพิ่ม effect ใหม่: สร้างโฟลเดอร์ใน `effects/` → รัน `node tools/check.mjs --fix` → ลองติดตั้งจาก branch → merge
- effect จาก repo นี้ได้ป้าย **Official** เพราะมาจาก `github.com/redevrx` เท่านั้น
- เขียนด้วย AI: ให้ AI อ่าน [`AGENTS.md`](AGENTS.md) ก่อน (Claude Code / Codex / Cursor อ่านเองอัตโนมัติ ส่วน ChatGPT หรือ Claude.ai ให้แปะไฟล์นี้ให้) บอก URL เว็บ, โหมด manga หรือ novel, สิ่งที่อยากให้เกิดและสิ่งที่ห้ามพัง แล้ว **copy outerHTML** ส่วนที่จะแก้จาก DevTools ไปให้ด้วย อย่าส่งแค่ภาพหน้าจอ
- ก่อน commit งานที่ AI เขียน: รัน `node tools/check.mjs --fix` → ลองบน Chrome ด้วย `tools/devtools-runner.js` แล้ว `mangaxTest.stop()` หน้าเว็บต้องกลับเหมือนเดิม → เช็กว่า `ctx` ที่ใช้มีอยู่จริงในตารางของ AGENTS.md → ถ้าแก้ effect เดิมให้ขึ้น `version`
