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
| `icon` | one of `swap_vert`, `block`, `visibility_off`, `dark_mode`, `light_mode`, `contrast`, `palette`, `speed`, `timer`, `text_fields`, `format_size`, `close`, `bolt`, `touch_app`, `skip_next`, `auto_fix_high`, `menu_book`, `auto_stories`, `translate`, `record_voice_over`, `volume_up`, `bookmark`, `zoom_in`, `fit_screen`, `cleaning_services`, `hide_image`, `filter_alt`, `delete_sweep`, `do_not_disturb`, `brightness_6`, `invert_colors`, `format_color_fill`, `blur_on`, `crop`, `image`, `wallpaper`, `keyboard_double_arrow_down`, `vertical_align_top`, `arrow_downward`, `swipe`, `open_in_new`, `link`, `notifications`, `download`, `content_copy`, `refresh`, `settings`, `pets`, `emoji_emotions`, `star`, `favorite`. Any other name shows a generic icon. Or draw one: `{ "viewBox": "0 0 24 24", "paths": ["M…"], "fillRule": "evenodd" }` — see "Drawn icons" |
| `matches` | URL patterns `scheme://host/path`. `*://*/*` = every site. `*.example.com` covers `example.com` **and** `www.example.com`; `example.com` alone does not cover `www.` |
| `excludes` | same format; sites to skip |
| `engines` | `["any"]` unless the effect truly only makes sense in one mode (`manga` or `novel`) |
| `permissions` | Only what the script calls: `toast` for `ctx.toast`, `menu` for `menu.*` commands, `engine` for `engine.set`, `companion` for `ctx.companion`; otherwise `[]` |
| `runAt` | leave it out (`manual`) unless the effect should start by itself: `pageLoad` starts it whenever a matching page finishes loading, for any type including `action`. The reader can still run it by hand and can turn auto-start off. `documentStart` behaves like `pageLoad` for now |
| `options` | settings the app draws; see below |
| `settingsUi` | `true` when the script also draws its own settings on the page with `mangax.settings(fn)`; the sheet then shows a settings button. Needs `entry`. See "Settings on the page" |
| `companion` | `{ "url": "https://…", "matches": ["https://*.site.com/*"] }` — a second page the effect opens beside the one being read and runs `mangax.companion(fn)` in. Needs the `companion` permission and `entry`. `matches` defaults to the site of `url`, must name sites (not `*://*/*`) and must cover `url`. See "Companion pages" |

### Drawn icons

When no name fits, draw the icon from SVG path data. The app draws it itself, in one colour it picks
(the category's or the badge's), so nothing is fetched and every effect still matches the list.

```json
"icon": {
  "viewBox": "0 0 24 24",
  "paths": ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10l-4.5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"],
  "fillRule": "evenodd"
}
```

- `paths` (required): the `d` of each `<path>`, 1–8 of them, at most 4096 characters together. Each
  starts with `M`/`m` and holds only path commands and numbers.
- `viewBox`: SVG's `"x y width height"`, or one number for a square from 0,0. Default `24`.
  Material Symbols' `"0 -960 960 960"` works as is.
- `fillRule`: `nonzero` (default) or `evenodd`, for holes cut into a shape.
- Colours in the SVG are ignored. Strokes are not drawn: convert them to fills first.
- Apps from before drawn icons cannot read the object and refuse the manifest. Use one only in an
  effect that needs a current app anyway (for example one using `companion`).
- `node tools/check.mjs` checks all of this.

### Options

```json
{ "key": "speed", "type": "slider", "label": { "en": "Speed", "th": "ความเร็ว" },
  "min": 10, "max": 300, "step": 10, "default": 60, "unit": "px/s" }
```

| `type` | Fields | Value in `ctx.options[key]` |
|---|---|---|
| `boolean` | `default` | `true` / `false` |
| `slider` | `min`, `max`, `step`, `default`, `unit` | number, already clamped to min..max |
| `select` | `choices: [{ "value", "label" }]`, `default`, `dynamic` | one of the `value` strings; with `"dynamic": true` any string up to 200 characters |
| `text` | `default`, `placeholder`, `maxLength` | string |

`key`: letters, digits, `_`; starts with a letter.

`"dynamic": true` is for choices only the page knows — the voices a text-to-speech site offers.
`choices` may then be empty and `default` need not be one of them; the value is saved from the
page with `ctx.setOption`, and the sheet shows it as it is.

## `main.js`

Exactly one call to `mangax.effect` at the top level — and, with `settingsUi`, one to
`mangax.settings` (see "Settings on the page"):

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
| `ctx.onEvent` | `(name, fn(data, name))` | App events: `translate:start`, `translate:done`, `translate:failed` (`data.message`), `translate:stop` (`data.reason`: `user` \| `auto`) — these carry `data.type` (`manga` \| `novel`) and `data.mode` (`realtime` \| `full`); `engine:change` (`data.type`); `menu:open` / `menu:close` (`data.key`, `null` when dismissed) for the app's own menu; `menu:change` (same data as `menu.items`) when the buttons change; `page:overlay` when a pinned box comes up on the page (see "Pop-ups and floating ads" below); `"*"` for all. Realtime `translate:done` fires once per batch; a full scan (`mode: "full"`) sends `translate:start` on press and ends with one of done / failed / stop. Removed on stop. No permission needed |
| `ctx.toast` | `(text) → Promise` | Needs `"permissions": ["toast"]`. Add `.catch(function () {})` |
| `ctx.call` | `(cmd, args) → Promise` | Always `.catch`. `toast` `{text}` (perm `toast`); `menu.items` → `{engine, items:[{key,label,icon,active}]}` (`icon` = Material icon name), `menu.press` `{key}` runs what the app's button runs, `menu.replace` `{on}` hides the app's menu button while the effect runs — the effect must then draw its own menu from `menu.items` and redraw on `menu:change` (perm `menu`); `engine.get` → `"manga"`\|`"novel"` (no perm); `engine.set` `{type}` (perm `engine`). Menu keys: `scan`, `effects`, `read_aloud`, `full_context_scan`, `bubble_edit`, `export_chapter`, `settings` — ask `menu.items`, they depend on engine and page. Anything else rejects |
| `ctx.setOption` | `(key, value) → Promise` | Saves one of the effect's own options, as if the reader set it in the sheet; resolves to the value kept (a slider value is clamped). `key` must be declared in `options` and `value` of its type, or it rejects. The running effect and an open settings panel both get it through `onOptions`. No permission needed. Always `.catch` |
| `ctx.stop` | `()` | Turns the effect off from inside (runs all cleanups) |
| `ctx.id` | string | The effect id |
| `ctx.engine` | `'manga'` \| `'novel'` | The reader's mode when the effect started; listen to `engine:change` for switches |
| `ctx.site` | string | `location.host` — a plain string, not an element or a query function |
| `ctx.auto` | boolean | `true` when the app started it on page load, `false` when the reader switched it on or ran it |

Settings panels add `ctx.panel`, `ctx.theme`, `ctx.lang` and `ctx.close` (see "Settings on the
page"); `ctx.companion` and the companion page's own `ctx` are in "Companion pages". There is
**nothing else**: no `ctx.on('stop')`, no `ctx.storage`, no `ctx.fetch`, no `ctx.$`, no
`ctx.log`, no `ctx.wait`. Do not invent members. For cleanup, **return a function** from the
effect (toggle), or register work through `ctx.on` / `ctx.observe` / `ctx.addStyle`, which clean up
by themselves.

### Settings on the page: `mangax.settings`

With `"settingsUi": true` an effect draws its own settings screen over the page the reader is on,
the way a browser extension has an options page. The app only adds a settings button (tune
icon) to the effect's row in the sheet, hands over its colours and language, and saves what the
screen saves. What the screen looks like and does is up to the effect.

```js
mangax.effect(function (ctx) { /* the effect itself, as always */ });

// Same file. Guarded: apps from before settings panels have no mangax.settings.
if (mangax.settings) mangax.settings(function (ctx) {
  var box = ctx.panel();                        // floating box: backdrop + card, in a shadow root
  box.css('button { background: var(--mx-primary); color: #fff; }');
  box.card.innerHTML = '<button>OK</button>';
  ctx.on(box.card.querySelector('button'), 'click', function () {
    ctx.setOption('speed', 120).catch(function () {});
    ctx.close();
  });
  ctx.onOptions(function (options) { /* changed elsewhere — the sheet, the effect */ });
});
```

- Pressing the button closes the sheet and runs the function given to `mangax.settings` on the
  page as a **panel run**, apart from the effect itself: it opens whether the effect is on or off,
  starting or stopping neither, and does not count as running. Opening it again closes the old
  one first; leaving the page takes it away.
- Its `ctx` has every member in the table above (cleaned up when the panel closes), plus:

| Member | Notes |
|---|---|
| `ctx.panel(opts?)` | Makes the floating box and returns `{ host, root, card, css(text), close() }`; calling it again returns the same one. Put your UI in `card`, add CSS with `css(text)`. `opts`: `position` `'bottom'` (default) or `'center'`, `dim` backdrop 0–1 (0.45), `dismissible` tap the backdrop to close (`true`) |
| `ctx.theme` | The app's colours, `#rrggbb`: `dark` (boolean), `background`, `surface`, `surface2`, `primary`, `secondary`, `text`, `textBody`, `textMuted` |
| `ctx.lang` | The app's language: `'th'` or `'en'` |
| `ctx.close` | `()` closes the settings (same as `ctx.stop`) |

- The box is `position: fixed` at the highest z-index, and everything in it lives in a shadow
  root, so the site's CSS does not reach it. Its styles are set through the CSSOM and `css()` uses
  a constructed stylesheet, so it also looks right on sites whose CSP forbids inline `<style>`.
  The app's colours are CSS variables on it: `--mx-background`, `--mx-surface`, `--mx-surface2`,
  `--mx-primary`, `--mx-secondary`, `--mx-text`, `--mx-text-body`, `--mx-text-muted`.
- You may build your own box instead of `ctx.panel()`; mark it with a `data-mangax-ui` attribute
  and remove it in the returned cleanup. Boxes marked `data-mangax-ui` (and anything inside) are
  never reported as `page:overlay`, so pop-up killers leave settings screens alone.
- Save with `ctx.setOption`; declare every key in `options` (use `"dynamic": true` for a `select`
  whose choices come from the page). `effects/auto-scroll` is a complete example.
- Try it with `tools/devtools-runner.js`: paste the script, then `mangaxTest.settings()`.

### Companion pages: `ctx.companion` and `mangax.companion`

An effect can open a **second page** beside the one being read — a text-to-speech site, a
dictionary, a translator — and run its own code there, much like a browser extension's
background page. The two sides talk by messages; the app carries them and draws the page. Nothing
about it is specific to one site or one use: what the page is for is up to the effect.

```json
"permissions": ["companion"],
"companion": { "url": "https://tts.example.com/app", "matches": ["https://*.tts.example.com/*"] }
```

```js
// main.js — one file, three parts. Top-level code runs on BOTH pages, so keep it to these calls.
mangax.effect(function (ctx) {                       // on the page being read
  ctx.companion.onMessage(function (msg) { /* from the companion page */ });
  ctx.companion.onState(function (s) {               // { open, url, view, loading, ready } or { open: false, reason }
    if (!s.open) { /* closed: s.reason */ }
  });
  ctx.companion.open({ view: 'hidden' })             // loads companion.url (or opts.url, within matches)
    .then(function () { return ctx.companion.send({ type: 'speak', text: 'hello' }); })
    .catch(function () {});
  return function () {};                            // toggle: switching it off closes the companion too
});

if (mangax.companion) mangax.companion(function (ctx) {   // on the companion page
  ctx.onMessage(function (msg) {
    if (msg.type === 'speak') { /* drive the site */ ctx.send({ type: 'started' }); }
  });
});
```

On the page being read (`ctx.companion`, permission `companion`; every call returns a Promise — always `.catch`):

| Member | Notes |
|---|---|
| `open({ url?, view? })` | Opens the companion page, or re-shows it when already open. `url` defaults to `companion.url` and must be covered by `companion.matches`. Resolves to the state |
| `show(view)` | `'hidden'` (not on screen, still running), `'mini'` (small window), `'sheet'` (half screen), `'full'` |
| `send(data)` | Any JSON value. Resolves `true` when handed over, `false` when queued because the companion code has not started yet (it gets it once it has, up to 50 messages) |
| `onMessage(fn(data))` | What the companion code sends with `ctx.send` |
| `onState(fn(state))` | `{ open: true, url, view, loading, ready }` whenever it changes (`ready` = the companion code runs), `{ open: false, reason }` when it closes |
| `state()` | The current state |
| `close()` | Closes it |

On the companion page, `mangax.companion(fn)` gets a `ctx` with `on`, `observe`, `addStyle`,
`onUrlChange`, `options`, `onOptions`, `setOption`, `toast`, `id`, `site`, plus:

| Member | Notes |
|---|---|
| `ctx.role` | `'companion'` |
| `ctx.send(data)` | To the effect on the page being read (`ctx.companion.onMessage`) |
| `ctx.onMessage(fn(data))` | What the page being read sends |
| `ctx.show(view)` | Asks to be shown — e.g. `'full'` when the site needs the reader to sign in or pass a check |
| `ctx.close()` | Closes the companion page |

It runs whenever a page covered by `matches` finishes loading in the companion view (again after
each navigation). It cannot use `menu.*`, `engine.*` or `ctx.companion` — the companion is someone
else's site, so its side gets nothing of the page being read except what the effect sends.

**Lifecycle — when a companion page closes.** There is one at a time. It closes, and is destroyed
completely (page, audio, timers, scripts), when:

| `reason` | When |
|---|---|
| `effect` | `ctx.companion.close()` or the companion code's `ctx.close()` |
| `user` | The reader closed it from its bar — the reader can always close it, hidden ones too |
| `stopped` | The reader switched the effect off, or it failed |
| `replaced` | Another effect opened its companion |
| `removed` | The effect was removed or updated |
| `orphaned` | A toggle stopped running with its page (a navigation) and did not run again within 20 seconds |
| `crashed` | The companion page's renderer died |

A toggle keeps its companion across chapters when it starts on page load (`runAt: pageLoad`) —
it is running again within the grace period, and the companion is still there. An `action` owns it
until it is closed, but receives no messages (actions keep nothing running), so use a `toggle` for
two-way work.

Rules: only open a companion when the reader asked for what it does; keep it `hidden` unless the
reader must see it; send only what the site needs (the text to read, not the page); never read or
send the site's cookies, tokens or account details. The install screen lists the companion sites.

### Pop-ups and floating ads: `page:overlay`

Ads are different on every site, so the app does not decide what an ad is. It reports every box
the site pins over the page, and your effect picks out the ones it knows are ads. Listening for
the event is what turns the watch on; nothing is watched on a page where nobody listens (a `"*"`
listener hears it but does not turn it on).

`ctx.onEvent('page:overlay', fn(data))` fires once each time an element with `position: fixed` or
`sticky` becomes visible — when it is added, or when the site flips it visible again after hiding
it. Boxes already on screen when you start listening are reported too. A pinned element inside
another is part of the outer one and is not reported separately. Tiny ones (under 400 px²) are
skipped.

| `data` | Meaning |
|---|---|
| `selector` | Finds the element: `document.querySelector(data.selector)`. It may be gone already |
| `id` | The same, as the value of `data-mangax-overlay` |
| `position` | `fixed` or `sticky` |
| `cover` | Share of the screen it covers, 0–1 (0.3 = 30%) |
| `left`, `top`, `width`, `height` | The visible part, in viewport CSS pixels |
| `z` | Its `z-index` as a number, 0 for `auto` |
| `sinceTap` | ms since the reader last touched the page, `-1` if never. A box that comes up within about a second of a tap is usually one the reader opened (a menu, a chapter list) — leave it |

The app filters nothing, so filter well: a site's own header, bottom bar and reader
are pinned boxes too. Check what is inside before removing, and prefer a site-specific
`matches` with the site's own selectors when you can.

```js
// A floating ad on one site: a pinned box in the bottom corner holding an iframe.
mangax.effect(function (ctx) {
  ctx.onEvent('page:overlay', function (data) {
    if (data.sinceTap >= 0 && data.sinceTap < 1000) return;
    var el = document.querySelector(data.selector);
    if (!el || !el.querySelector('iframe, a[target="_blank"]')) return;
    if (data.cover > 0.25) return;   // not the small floating kind this effect is for
    el.setAttribute('data-mx-float-ad', '');
  });
  ctx.addStyle('[data-mx-float-ad] { display: none !important; }');
  return function () {
    document.querySelectorAll('[data-mx-float-ad]').forEach(function (el) {
      el.removeAttribute('data-mx-float-ad');
    });
  };
});
```

Use `"type": "toggle"` with `"runAt": "pageLoad"` for an effect like this, so it starts on every
matching page and switching it off shows everything again. An `action` works too — its
listeners stay until the page changes — but it cannot be undone. `effects/kill-popups` is the
official one for big pop-ups on every site; write your own for a site's floating ads.
`tools/devtools-runner.js` raises `page:overlay` the same way.

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
- [ ] with `settingsUi`: `mangax.settings` is guarded (`if (mangax.settings)`), every key it saves is
      in `options`, and `mangaxTest.settings()` opens and closes it cleanly
- [ ] with `companion`: `mangax.companion` is guarded, top-level code is only the `mangax.*` calls,
      `matches` names only the sites needed, and both sides were tried with the devtools runner
      (`mangaxTest.fromCompanion`, and `mangaxTest.companion()` on the companion site)
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