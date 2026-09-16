# Writing MangaX effects

Instructions for AI coding assistants (Claude Code, Codex, Cursor, Copilot, opencode…) working in
this repository. People can read it too: it is the exact contract the app implements. When
something here and a guess disagree, this file wins — the app has no other API.

## What an effect is

A folder `effects/<name>/` with:

- `effect.json` — the manifest (schema below)
- `main.js` — the script, for `type` `action` or `toggle`
- `style.css` — the stylesheet, for `type` `style` (a `toggle` may have one as well)

The app downloads **only** `effect.json` and the files named by `entry` and `style`. Anything else
in the folder (a `README.md`, a test page) stays on GitHub.

The script runs inside the MangaX in-app browser (Android WebView, iOS WKWebView) on a web page
the reader opened, in **both** manga and novel mode. It is not a browser extension, not a
userscript manager and not Node: there is no `GM_*`, no `chrome.*`, no `require`/`import`, no
network API of the app's own.

## Workflow — do all of it

1. Look at a similar effect in `effects/` first and copy its shape.
2. Write `effect.json` and `main.js` / `style.css`.
3. Run `node tools/check.mjs --fix`. It must print ✓ for the effect. It also rewrites
   `index.json` — never edit `index.json` by hand.
4. Try the script on the real site in desktop Chrome with `tools/devtools-runner.js` (for app events: `mangaxTest.emit(name, data)`; set `engine`, `auto`, `permissions` with `mangaxTest.setup`)
   (instructions at the top of that file). It implements the same `ctx` as the app.
5. When changing an existing effect, bump `version` (semver) in the same commit, then run step 3
   again so `index.json` carries the new version. The market only offers **Update** when the
   version in `index.json` is higher than the installed one.

## `effect.json`

```json
{
  "$schema": "../../schema/effect.schema.json",
  "schema": 1,
  "id": "redevrx.<name>",
  "version": "1.0.0",
  "name": { "en": "Auto scroll", "th": "เลื่อนอัตโนมัติ" },
  "description": { "en": "One line: what the reader gets.", "th": "..." },
  "author": { "name": "redevrx", "url": "https://github.com/redevrx" },
  "type": "toggle",
  "category": "reading",
  "icon": "speed",
  "entry": "main.js",
  "matches": ["*://*/*"],
  "engines": ["any"],
  "permissions": [],
  "keywords": ["scroll", "เลื่อน"],
  "options": []
}
```

| Field | Rules |
|---|---|
| `id` | `<owner>.<folder-name>`, lowercase. The last part must equal the folder name. `redevrx.` only in repositories owned by redevrx |
| `version` | semver `x.y.z` |
| `name`, `description` | a string, or `{ "en": ..., "th": ... }` |
| `type` | `style` (CSS only, switch) · `action` (runs once, Run button) · `toggle` (runs until switched off) |
| `category` | exactly one of `reading`, `cleanup`, `appearance`, `navigation`, `utility` |
| `icon` | one of `swap_vert`, `block`, `visibility_off`, `dark_mode`, `light_mode`, `contrast`, `palette`, `speed`, `timer`, `text_fields`, `format_size`, `close`, `bolt`, `touch_app`, `skip_next`, `auto_fix_high`, `menu_book`, `auto_stories`, `translate`, `record_voice_over`, `volume_up`, `bookmark`, `zoom_in`, `fit_screen`, `cleaning_services`, `hide_image`, `filter_alt`, `delete_sweep`, `do_not_disturb`, `brightness_6`, `invert_colors`, `format_color_fill`, `blur_on`, `crop`, `image`, `wallpaper`, `keyboard_double_arrow_down`, `vertical_align_top`, `arrow_downward`, `swipe`, `open_in_new`, `link`, `notifications`, `download`, `content_copy`, `refresh`, `settings`, `pets`, `emoji_emotions`, `star`, `favorite`. Any other name shows a generic icon |
| `matches` | URL patterns `scheme://host/path`. `*://*/*` = every site. `*.example.com` covers `example.com` **and** `www.example.com`; `example.com` alone does not cover `www.` |
| `excludes` | same format; sites to skip |
| `engines` | `["any"]` unless the effect truly only makes sense in one mode (`manga` or `novel`) |
| `permissions` | Only what the script calls: `toast` for `ctx.toast`, `menu` for `menu.*` commands, `engine` for `engine.set`; otherwise `[]` |
| `runAt` | leave it out (`manual`) unless the effect should start by itself: `pageLoad` starts it whenever a matching page finishes loading, for any type including `action`. The reader can still run it by hand and can turn auto-start off. `documentStart` behaves like `pageLoad` for now |
| `options` | settings the app draws; see below |

### Options

```json
{ "key": "speed", "type": "slider", "label": { "en": "Speed", "th": "ความเร็ว" },
  "min": 10, "max": 300, "step": 10, "default": 60, "unit": "px/s" }
```

| `type` | Fields | Value in `ctx.options[key]` |
|---|---|---|
| `boolean` | `default` | `true` / `false` |
| `slider` | `min`, `max`, `step`, `default`, `unit` | number, already clamped to min..max |
| `select` | `choices: [{ "value", "label" }]`, `default` | one of the `value` strings |
| `text` | `default`, `placeholder`, `maxLength` | string |

`key`: letters, digits, `_`; starts with a letter.

## `main.js`

Exactly one call to `mangax.effect`, nothing else at the top level:

```js
mangax.effect(function (ctx) {
  ctx.addStyle('.site-banner { display: none !important; }');

  ctx.observe('.chapter-lock-overlay', function (el) {
    el.setAttribute('data-mx-hidden', '');
  });

  // toggle only: undo everything that was NOT done through ctx
  return function () {
    document.querySelectorAll('[data-mx-hidden]').forEach(function (el) {
      el.removeAttribute('data-mx-hidden');
    });
  };
});
```

### `ctx` — the complete API

| Member | Signature | Notes |
|---|---|---|
| `ctx.options` | object | Current settings. Read it again inside `onOptions` |
| `ctx.onOptions` | `(fn(options))` | The reader changed a setting while the effect runs |
| `ctx.on` | `(target, type, fn, options?)` | `target.addEventListener(type, …)`. `target` must be an element, `document` or `window` — **not a string**. Removed on stop |
| `ctx.observe` | `(selector, fn(element))` | `selector` is **one CSS selector string** (use commas for several). `fn` runs once per matching element, now and for elements added later. Disconnected on stop |
| `ctx.addStyle` | `(css) → <style>` | Removed on stop. Change `.textContent` of the returned element to update it |
| `ctx.onUrlChange` | `(fn(href))` | Single-page sites changing URL without a reload |
| `ctx.onEvent` | `(name, fn(data, name))` | App events: `translate:start`, `translate:done`, `translate:failed` (`data.message`), `translate:stop` (`data.reason`: `user` \| `auto`) — these carry `data.type` (`manga` \| `novel`) and `data.mode` (`realtime` \| `full`); `engine:change` (`data.type`); `menu:open` / `menu:close` (`data.key`, `null` when dismissed) for the app's own menu; `menu:change` (same data as `menu.items`) when the buttons change; `"*"` for all. Realtime `translate:done` fires once per batch; a full scan (`mode: "full"`) sends `translate:start` on press and ends with one of done / failed / stop. Removed on stop. No permission needed |
| `ctx.toast` | `(text) → Promise` | Needs `"permissions": ["toast"]`. Add `.catch(function () {})` |
| `ctx.call` | `(cmd, args) → Promise` | Always `.catch`. `toast` `{text}` (perm `toast`); `menu.items` → `{engine, items:[{key,label,icon,active}]}` (`icon` = Material icon name), `menu.press` `{key}` runs what the app's button runs, `menu.replace` `{on}` hides the app's menu button while the effect runs — the effect must then draw its own menu from `menu.items` and redraw on `menu:change` (perm `menu`); `engine.get` → `"manga"`\|`"novel"` (no perm); `engine.set` `{type}` (perm `engine`). Menu keys: `scan`, `effects`, `read_aloud`, `full_context_scan`, `bubble_edit`, `export_chapter`, `settings` — ask `menu.items`, they depend on engine and page. Anything else rejects |
| `ctx.stop` | `()` | Turns the effect off from inside (runs all cleanups) |
| `ctx.id` | string | The effect id |
| `ctx.engine` | `'manga'` \| `'novel'` | The reader's mode when the effect started; listen to `engine:change` for switches |
| `ctx.site` | string | `location.host` — a plain string, not an element or a query function |
| `ctx.auto` | boolean | `true` when the app started it on page load, `false` when the reader switched it on or ran it |

There is **nothing else**: no `ctx.on('stop')`, no `ctx.storage`, no `ctx.fetch`, no `ctx.$`, no
`ctx.log`, no `ctx.wait`. Do not invent members. For cleanup, **return a function** from the
effect (toggle), or register work through `ctx.on` / `ctx.observe` / `ctx.addStyle`, which clean up
by themselves.

### Rules

- **Toggle = reversible.** After the switch goes off the page must look and behave as before:
  disconnect your own `MutationObserver`s, clear timers, `cancelAnimationFrame`, remove classes
  and attributes you added, show what you hid.
- **Mark with your own attribute**, e.g. `data-mx-<name>`, and style it through `ctx.addStyle`.
  Never add or remove the site's class names (`hidden`, `active`…) — the site uses them too, and
  undoing them breaks the page.
- **Narrow selectors.** Use the site's real, specific selectors. `[class*='modal']`,
  `[class*='login']`, `[class*='coin']`, `body *`, `*` hit far more than intended. Never hide or
  remove `html`, `body`, or large containers because of a computed style like `overflow: hidden`.
- **Both modes.** Manga pages are mostly images, often inside a scrolling `div` rather than the
  page; novel pages are mostly text. Scroll the element that actually scrolls.
- **Never touch the app's own markup:** elements with `data-tl-*` or `data-manga-*` attributes, and
  `<style data-mangax-effect>`.
- **No page globals.** On iOS the script runs in a separate JavaScript world: it shares the DOM
  but not the page's variables (`window.jQuery`, `window.__NUXT__`…) and page scripts cannot see it.
- **Errors:** an exception in the effect body or in a `ctx` callback stops the effect and shows
  the reader an error. Callbacks you schedule yourself (`setTimeout`, `requestAnimationFrame`,
  `new MutationObserver`, promises) are not guarded — wrap them in `try/catch` and call
  `ctx.stop()` on failure.
- The script may run before the page finishes loading: prefer `ctx.observe` over one
  `querySelector` at start.
- ES2017 is fine (`const`, arrow functions, `async`). One file, no imports, 1 MB at most.
- Do not send data anywhere (`fetch`, `XMLHttpRequest`, beacons) and do not read or store login
  details, cookies or tokens.
- Do not write effects that get around a site's payment, subscription or login requirements.

### Before you say it is done

- [ ] `node tools/check.mjs --fix` prints ✓ for the effect
- [ ] every `ctx` member used is in the table above, with the right arguments
- [ ] ran it with `tools/devtools-runner.js` on the real site; toggled it off and the page was back
      to normal
- [ ] `version` bumped if the effect already existed; `index.json` regenerated
- [ ] `matches` covers the host the site really uses (`www.` or not)

---

# Context Management

When the context window is getting full:

1. Compact the conversation before reaching the context limit.
2. Preserve:
    - Current task and objective
    - Files modified
    - Important implementation decisions
    - Bugs discovered and their causes
    - Commands already executed
    - Test/build results
    - Remaining TODOs
    - Important constraints
3. After compaction, continue the task from the compacted summary.
4. Do not restart the task from scratch.
5. Do not repeat investigation that has already been completed.
6. Before making changes, inspect the current state of the files rather than relying only on conversation history.

For long-running tasks, maintain a concise progress summary in:
`.opencode/progress.md`

Update it whenever a major implementation step is completed.