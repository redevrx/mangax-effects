# mangax-effects

Official effects for the **MangaX** reader. An effect is a small script or stylesheet that runs on
the page you are reading — auto scroll, hiding ads, anything that makes a site nicer to read.

Effects installed from this repository show the **Official** badge in the app. The badge comes from
where the files were downloaded (a repository owned by `redevrx`), never from what `effect.json` says.

| Effect | Type | What it does |
|---|---|---|
| [Auto scroll](effects/auto-scroll) | toggle | Scrolls at a steady pace; touch to pause |
| [Hide ads](effects/hide-ads) | style | Hides common ad slots with CSS only |

## Install in the app

**Effects** (in the floating menu) → **Add effect from URL**, then paste an effect's folder link:

```
https://github.com/redevrx/mangax-effects/tree/main/effects/auto-scroll
```

The app pins the commit that link points at. Pushing to `main` never changes an effect someone
already installed; they get the new code when they install it again.

A tag works too, and is the better link to share once an effect is stable:

```
https://github.com/redevrx/mangax-effects/tree/v1.0.0/effects/auto-scroll
```

## Repository layout

```
mangax-effects/
├── index.json                  list of every effect (generated — do not edit by hand)
├── schema/effect.schema.json   editor help for effect.json
├── tools/check.mjs             checks every effect the way the app will
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

3. Try it on a phone by installing from your branch:
   `https://github.com/redevrx/mangax-effects/tree/<branch>/effects/<name>`
4. Commit, push, merge.

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

### `ctx`

| | |
|---|---|
| `ctx.options` | The reader's settings for the options declared in `effect.json` |
| `ctx.onOptions(fn)` | Called when the reader changes a setting while the effect runs |
| `ctx.on(target, type, fn, opts)` | `addEventListener`, removed when the effect stops |
| `ctx.observe(selector, fn)` | `fn(element)` once for every match, now and as the page adds more |
| `ctx.addStyle(css)` | Adds a `<style>`, removed when the effect stops |
| `ctx.onUrlChange(fn)` | The page changed its URL without reloading |
| `ctx.toast(text)` | Shows a message in the app. Needs `"permissions": ["toast"]` |
| `ctx.call(cmd, args)` | Sends a command to the app; returns a Promise |
| `ctx.stop()` | Switches the effect off from inside |
| `ctx.id` · `ctx.engine` · `ctx.site` | This effect, `manga` / `novel`, the page's host |

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
- Leave elements with `data-tl-*` attributes alone — they belong to the MangaX translation scan.
- One script file per effect, no imports, 256 KB at most.
- An error thrown inside `ctx` callbacks stops the effect and tells the reader. Errors in callbacks
  you schedule yourself (`requestAnimationFrame`, `setTimeout`) are not caught — guard them.
- Match only the sites an effect is for when it is site-specific: `https://*.example.com/read/*`.

## ภาษาไทยสั้น ๆ

- ติดตั้งในแอพ: **Effects → เพิ่มเอฟเฟกต์จาก URL** แล้ววางลิงก์โฟลเดอร์ของ effect
- เพิ่ม effect ใหม่: สร้างโฟลเดอร์ใน `effects/` → รัน `node tools/check.mjs --fix` → ลองติดตั้งจาก branch → merge
- effect จาก repo นี้ได้ป้าย **Official** เพราะมาจาก `github.com/redevrx` เท่านั้น
