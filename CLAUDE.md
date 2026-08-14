# GEOGLOWS Project Gantt - developer guide

This repository is a single self-contained web page that renders the GEOGLOWS project
schedule as a live Gantt chart, published via GitHub Pages and fed by a Google Sheet.

- Live site: https://andrewsouth.github.io/geoglows-gantt/
- Repo: https://github.com/andrewsouth/geoglows-gantt
- Data source: a Google Sheet ("Project Schedule LIVE 3.0") published to the web as CSV.

## What is in this repo

- `index.html` - the entire application. Vanilla HTML/CSS/JS in one file, no build step,
  no framework. The only external dependency is PapaParse, loaded from cdnjs at runtime.
- `apps-script/Code.gs` - a copy of the Apps Script that is bound to the Google Sheet.
  It is NOT executed from this repo; it lives inside the Sheet. Edits here are only a
  version-controlled record until someone pastes them into Extensions > Apps Script.
  See "The Google Sheet side" below.

There is no package.json, no bundler, and nothing to install. To preview, open
`index.html` in a browser.

## How it works (data flow)

1. The Google Sheet holds the schedule. It is published to the web as CSV (one tab,
   "Project Schedule").
2. `index.html` fetches that CSV at load and every few minutes, parses it with PapaParse,
   and draws the Gantt client-side.
3. If the live fetch fails, it falls back to a CORS proxy, then to an embedded snapshot
   (`FALLBACK` array near the top of the script). The snapshot is only a safety net.

Key point: the page reads the Sheet's already-computed `Start Date` and `Finish Date`
columns. The scheduling math (dates from durations and dependencies) happens in the
Sheet's formulas, not in this code. This page only visualizes.

## Key constants (top of the `<script>` in index.html)

- `SHEET_URL` - the published CSV link. Change only if the Sheet is re-published.
- `PREVIEW` - `false` in production. Set to `true` to force the embedded `FALLBACK`
  data and skip the network (useful for offline local work on layout).
- `PROJECT_START` = 2026-01-05, `PROJECT_END` = 2028-12-31. The chart window. A task
  dated past `PROJECT_END` renders off the right edge; extend this if the project grows.
- `DAY_PX` = 2.8 (horizontal pixels per day), `ROW_H` = 26 (row height).
- `PROXY` - allorigins CORS proxy, used only if the direct fetch fails.

## Data model (the columns the page reads, BY HEADER NAME)

Parsing is keyed on header text, not column position, so columns may be reordered but
NOT renamed. Headers read: `ID`, `Task Name`, `Level`, `Lead`, `Support`,
`Depends On` (or `Predecessors`), `Start Date`, `Finish Date`, `% Complete`,
`Status`, `Notes / Updates`. `Duration (weeks)` is read if present but not required.

- `Level`: 1 = team lead (swimlane), 2 = project, 3 = sub-task. Drives grouping,
  indentation, collapse, and summary-bar color.
- `ID`: numbered in hundreds by lead - Jim 100s, Riley 200s, Angelica 300s,
  Michael 400s, Norm 500s, Andrew 600s (lead = X00, rows count up in that hundred).
- `Depends On`: a predecessor ID. Used ONLY to draw dependency arrows here; the actual
  auto-start math is a Sheet formula.
- `% Complete`: accepted as a fraction (`0.4`) or a percent string (`40%`).
- Dates: accepted as `YYYY-MM-DD` or `M/D/YYYY`.
- Rows with no `Task Name` are ignored (so half-filled rows never break the chart).

## Rendering logic (functions in index.html)

- `markSummaries` - a row is a "summary" if the next row is a deeper level.
- `computeRollups` - runs bottom-up over the summary rows.
  - **Percent: the children always win.** A summary's percent is the duration-weighted
    average of its IMMEDIATE children, and any value typed on that row in the Sheet is
    discarded. The reasoning: once a row is broken into sub-tasks, a number typed on the
    parent is stale by definition. Because it runs bottom-up, level 3 feeds level 2,
    which feeds level 1. Only a row with nothing under it keeps the Sheet's own value.
    A typed percent is therefore invisible on any row that has children - if a lead
    wants to assert a number, the row must have no sub-tasks.
  - **Start/Finish: the children win too.** A summary's dates are the min start and max
    finish of its immediate children, and dates typed on that row are discarded. A parent
    whose children are all undated keeps its own dates, since there is nothing to derive
    from. Consequence to remember: a summary bar now spans only as far as its PLANNED
    sub-tasks. If a long project has sub-tasks mapped out for just the first few months,
    its bar ends there and the project looks shorter than it is. The fix is data, not
    code - add or extend a sub-task.
- `getFilteredTasks` - applies collapse state (multi-level) and the View / Lead filters.
- `render` - builds the left task table and the right Gantt: month/year headers across
  2026-2028 (heavier line at each year), weekly/monthly gridlines, a red "today" line,
  bars, an SVG overlay of dependency arrows, tooltips, and the caret collapse handlers.
- Colors: `LEVEL_COLORS` sets summary-bar color by level (lead = deep navy `#1B3A5C`,
  project = mid-blue `#2d6a9f`); the row label and caret match. Task bars are colored
  by state: green `#27ae60` = 100%, blue `#3498db` = in progress, red `#e74c3c` =
  past finish and under 100%. These are computed here from Level, %, and dates - the
  Sheet's own cell colors do NOT come across (CSV carries values only).
- The table's `% Complete` column shows a right-aligned number plus a mini progress bar.
  The fill element must be `display:block` for its width to apply (an inline span is
  ignored - this was a past bug).

## Local development

- Open `index.html` directly, or serve the folder (`python3 -m http.server`) and open it.
- For layout/JS work without the network, set `PREVIEW = true` to render the embedded
  `FALLBACK` snapshot. Set it back to `false` before committing.
- There are no tests and no build. Verify changes by loading the page and, ideally,
  by rendering it headless (e.g. Playwright/Chromium) and screenshotting, since the
  layout is the product.
- Keep it a single self-contained file. Do not introduce a build step, a framework, or
  browser storage (localStorage/sessionStorage are intentionally unused).

## Deployment

GitHub Pages serves the default branch. Committing an updated `index.html` to the
default branch redeploys the live site automatically (about a minute). Prefer working
on a branch and opening a PR; merging to the default branch is what publishes.

## The Google Sheet side (context, not in this repo)

The Sheet "Project Schedule LIVE 3.0" is the source of truth and has a bound Apps
Script ("Schedule Tools" menu) providing:
- "Add task in this section" - inserts a row under the cursor's lead section with the
  next ID in that hundred and the Start/Finish formulas.
- "Clean up formatting" - applies self-maintaining conditional formatting (lead navy,
  project light-blue, completed sub-task green, input columns yellow) and a warning-only
  protection on the computed Start/Finish columns.
These affect only the Sheet, never this page, but changing the Sheet's structure can
affect the page. If you rename or remove a column the page reads, update `parseSheetRows`
accordingly. Keep a copy of the script under `apps-script/` here for reference.

## Gotchas / rules for changes

- Do NOT rename the Sheet header names listed above; the parser matches on them.
- Do NOT hardcode data into `index.html`; the `FALLBACK` snapshot is a fallback only and
  will go stale. Real data lives in the Sheet.
- Preserve the `PREVIEW` and `SHEET_URL` values in production (`PREVIEW=false`, real URL).
- Extending the timeline past 2028 means updating `PROJECT_END` and checking the header/
  gridline loops still read well at that width.
- No secrets belong in this repo; the Sheet is public read-only via its published CSV.

## Roadmap / open items

- Confirm two ownership overlaps in the data: GRACE (Riley vs Norm) and Landing Page
  (Angelica vs Michael). These are data decisions in the Sheet, not code.
- A "resequence a section's IDs" Sheet button is still unbuilt.

Done (see the git history): status-driven bar styling via `STATUS_COLORS`; the Dates
toggle and a corrected legend; duration-weighted percent rollups; and re-scoping the
Start/Finish protection to the used rows.

Note on the weighted rollups: a child with no dates carries no weight, so undated
placeholder rows no longer drag a section toward 0%, and a single long task can
dominate its section. That is what "duration-weighted" means, but it moved several
lead percentages sharply.
