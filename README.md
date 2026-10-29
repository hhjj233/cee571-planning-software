# Transportation Planning Software: interactive lecture companion

Companion web page for the CEE 571 (Fall 2026) lectures *Transportation Planning Software*, *Trip Distribution: Gravity Model* (Oct 27) and *Gravity Model and Growth Factor Model* (Oct 29).
Every demo uses one hypothetical city (the Eastfield development on Prairie Road) and is tied to the slides it supports.

| Section | Slides | What you can do |
|---|---|---|
| One development, two proposals | 1, 6, 23 | Compare today, new homes, a wider road and a frequent bus; open the calculation behind each number |
| The four steps, run once | 3, 8, 14, 15, 26 | Step through trip generation, distribution, mode choice and assignment; click a road for selected-link analysis |
| Near a stop is not a short walk | 10, 25, 28 | Straight-line buffer versus walking distance on the street network; add a footbridge |
| How big should a zone be? | 19–22 | Macrozones and microzones, intrazonal trips, access error, trip-table size |
| Nearest warehouse, cheapest system? | 27 | Capacity-constrained warehouse-to-store allocation |
| Solving the doubly constrained gravity model (Oct 27 lecture) | 23 | Step through the B<sub>i</sub> / D<sub>j</sub> iteration for a two-zone example; edit P, a and distances |
| Growing an old trip table: uniform, average, Fratar (Oct 29 lecture) | 13–18 | Grow a three-zone 2026 trip table to 2028 with each method; step through the passes, click a cell to see its calculation, edit the base table and the 2028 targets |

All numbers are hypothetical teaching values.

## View it

Open `index.html` in any modern browser. No build step, no server, no libraries.
Fonts load from Google Fonts; without internet the page falls back to system fonts and still works.

## Files

```
index.html            page text, section order, "pause and think" questions
assets/style.css      colors, type, layout (light and dark themes)
assets/js/common.js   shared helpers (SVG, formatting, animation loop)
assets/js/demo-*.js   one file per demo; model assumptions sit at the top of each file
```

To change wording, edit `index.html`. To change a demo's assumptions (trip rates, capacities, headways and so on), edit the constants at the top of its `demo-*.js` file. The site is served with GitHub Pages from the `main` branch, so a push to `main` updates it.
