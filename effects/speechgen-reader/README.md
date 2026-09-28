# Read aloud with SpeechGen

Reads a novel chapter aloud with the voices of [SpeechGen.io](https://speechgen.io/th/), starting from
the paragraph on screen. The paragraph being read is highlighted and the page follows it down.

- Switch it on from the effects sheet in novel mode. SpeechGen opens as a hidden companion page; it
  only comes on screen when the site needs you (out of credits, sign in, a check).
- It reads the translation the app put on the page (scanned paragraphs); on a page not translated
  yet, the page's own paragraphs. Menus, headers and footers are skipped.
- Switch it off, or close SpeechGen from its bar, to stop. At the end of the page it stops by itself.
- Settings (tune icon): speed and voice. The voice list comes from SpeechGen itself — Thai voices,
  with what each costs.

| Option | Default | Range |
|---|---|---|
| Voice | the site's default (Achara) | any SpeechGen voice name |
| Speed | 1.0x | 0.5 – 2.0 |

Install:

```
https://github.com/redevrx/mangax-effects/tree/main/effects/speechgen-reader
```

## Credits

SpeechGen charges per character read: Standard voices ×0.5, PRO ×1, HD ×2. A new visitor gets about
2,000 free credits (a few thousand characters — part of one chapter); after that, sign in or buy
credits on the site, in the companion page. The effect never gets around that and never reads or
sends your SpeechGen account details.

## How it works

The page being read joins paragraphs into pieces of about 250–900 characters (a longer paragraph is
cut at a sentence or a space) and sends one at a time; the next goes when SpeechGen says the last one
ended. There is no read-ahead, since every generation costs credits, so there is a short pause
(2–4 s) between pieces while SpeechGen makes the next one.

On speechgen.io the companion code types the piece into the site's editor (through the native
`value` setter plus `input`/`change` events), picks the voice from the site's voice picker and the
speed from its speed marker, presses **สร้างเสียง** and waits for the new result in
`#result_area`. The site plays it by itself; `play` / `ended` on that result's `<audio>` become
`started` / `ended` messages.

| page → companion | companion → page |
|---|---|
| `{type:'speak', id, text}` | `{type:'ready', credits}` — after every page load |
| `{type:'stop'}` | `{type:'started' \| 'ended', id, credits}` |
| `{type:'setVoice', voice}` · `{type:'setRate', rate}` | `{type:'error', id, message, needsUser}` |
| `{type:'voices'}` | `{type:'voices', voices:[{value,name,tier,sex}], current, lang}` |
| | `{type:'resumed', id}` · `{type:'notice', message}` |

`needsUser` errors show the site full screen and pause reading; it carries on with the same piece
when the reader has dealt with it (the result shows up, or the site reloads after signing in);
otherwise switch the effect off and on again.

## Limits

- Stops when the screen is off or the app is in the background (the companion page does not play
  then).
- Does not follow into the next chapter: switch it on again there.
- Tied to speechgen.io's page as it is (`#mytextarea`, `#start`, `#result_area`, the voice picker);
  a redesign of the site can break it.
