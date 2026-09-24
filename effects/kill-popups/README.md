# Kill pop-ups

Starts by itself on every page (switch off "start on page load" in the Effects sheet to keep it
to the **Run** button). It removes fixed or sticky elements that cover at least 30% of the screen
above the page (z-index 10 or more), then lifts the scroll lock such boxes put on the page.

It then stays on the page and removes each new pop-up as it comes up — the ads that return every
so often — using the app's `page:overlay` event. A box that opens within a second of a tap is left
alone, since the reader opened it.

Small floating buttons are kept, and so is anything holding text or images the MangaX scan has
picked up. Run by hand, it says how many it removed.
