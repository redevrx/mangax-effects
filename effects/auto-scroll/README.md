# Auto scroll

Scrolls the page down at a steady pace while it is switched on.

- Touching the screen pauses it until you let go.
- When the page stops moving for a few seconds (the end, or a page still loading more) it says so
  once, and carries on by itself as soon as there is more to scroll.
- Speed can be changed from the effect's settings while it is running.

| Option | Default | Range |
|---|---|---|
| Speed | 60 px/s | 10–400 |
| Pause while touching | on | |

Install:

```
https://github.com/redevrx/mangax-effects/tree/main/effects/auto-scroll
```

## How it works

A `requestAnimationFrame` loop moves the page by `speed × elapsed` pixels. Fractions of a pixel are
carried over to the next frame, since some engines drop scrolls under one pixel — without that, slow
speeds would not move at all on high-refresh screens. The cleanup it returns cancels the loop; the
touch listeners are registered through `ctx.on`, so the app removes them.
