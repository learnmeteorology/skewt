# Skew-T Explorer

An interactive, educational Skew-T log-P diagram that runs entirely in the browser.

- Sounding levels every 50 mb from 1000 to 100 mb
- Hover or tap a line to see its name, value and meaning
- A data table of pressure, temperature and dewpoint below the chart, linked to it; type in it to change values without dragging
- On small screens, Explore, Practice and Test have a button that zooms in on the chart
- Drag temperature and dewpoint dots; parcel path, CAPE, CIN, LCL, LFC and EL update
- "Guide to the lines" with a drawn sample of each line; in the Full chart view each line has a Learn more with its theory and LaTeX equations. The displayed equations come only from Wallace and Hobbs (2006; full reference at the end), with equation and page numbers; lessons say in plain words where the calculations differ. The CAPE lesson has a table of guide values with its sources. The CIN lesson's sources are listed in a comment in js/guide.js. KaTeX from jsDelivr typesets them, which needs an internet connection; plain-text equations are shown without it
- Close-up pictures of the wind barb marks on Learn, and in Explore's guide: on the wind barb card in the Basic chart view and under its Learn more in the Full chart view
- Three made-up teaching soundings
- Light mode by default, with a dark mode toggle
- Slider that warms or cools the whole temperature profile
- Practice page: identify chart features (lines, the LCL, LFC and EL, and the CAPE and CIN areas) and plot data in shuffled rounds, using any of the three soundings, with instant feedback, hints, retries and "Show me"
- Test page: a self-check with all 12 questions, all 13 features to identify and 6 plotting points in one mixed set. No feedback until the end, then results by topic with links back to study, and every item marked correct, wrong or skipped. Right answers are not shown. Skipped items are not marked wrong. The right choices are not written out in the page code, but marking happens in the browser, so a determined person could still work them out: it is not suitable for graded exams. Identifying features and plotting need a mouse or touch; keyboard users can skip them
- A second page, `build.html`, that builds a Skew-T step by step and, further down, explains what each line shows and what it is used for. It has Back and Next buttons, progress dots (a jump-to-step menu on small screens) or arrow keys
- Calibri text, with Carlito from Google Fonts as the fallback (needs an internet connection)

## Pages

- `index.html`: start page
- `build.html`: Learn, a step-by-step builder followed by what each line is for
- `explore.html`: interactive explorer, with Basic and Full chart views
- `practice.html`: practice identifying chart features and plotting data
- `test.html`: self-check test. On your own computer, `test.html?debug` adds a button that previews the results screen with made-up results
- `quiz.html`: forwards the old quiz address to Practice

## Run it

No build step. Open `index.html`, or serve the folder:

    python3 -m http.server 8000

## Files

- `js/quiz-data.js`: questions, tasks and test topics, shared by Practice and Test
- `js/quiz-chart.js`: their shared chart: drawing, picking lines and checking plotted points
- `js/practice.js`: Practice page flow
- `js/exam.js`: Test page flow (`test.js` is the project's checks, not this page)
- `js/thermo.js`: thermodynamics. The LCL is the crossing of the dry adiabat and mixing ratio line (p. 83 of Wallace and Hobbs, 2006), and moist ascent solves equation (3.68), p. 85, in small steps. Saturation vapor pressure is from Bolton (1980)
- `js/soundings.js`: example data
- `js/chart.js`: chart drawing shared by all pages with a chart
- `js/app.js`: explorer page interaction
- `js/guide.js`: the guide to the lines, with its lessons and equations
- `js/zoom.js`: small-screen chart zoom button (Explore, Practice and Test)
- `js/start.js`: start page preview chart
- `js/build.js`: step-by-step how-it's-built page
- `test.js`: checks, run with `node test.js`

## Limits

Only a surface-based parcel is calculated. The Full chart in Explore uses the virtual temperature (moisture) correction for CAPE, CIN, LFC and EL, and draws both virtual temperature curves. Learn, Practice and Test leave the correction out to stay introductory, so their values and shading differ. In the Full chart, every buoyant layer of more than 1 J/kg has its own LFC, including one below the LCL, and only the highest EL is shown; CAPE adds all positive area, and CIN all negative area, from the surface to the highest EL (to the top of the data if there is no EL). Counting CIN above the lowest LFC differs from the usual definition. Learn, Practice and Test keep one LFC and EL, spanning the lowest to the highest buoyant layer that reaches above the LCL. With no LFC, no CIN is given. There is no hodograph yet. Compared with MetPy 1.7.1 on the three examples, each also warmed and cooled by 6 °C: the LCL agreed within 1 mb, parcel temperatures within 0.8 °C and the EL within 3 mb. The temperature gap comes from the different moist adiabat formulas; the site's matches an independent solution of Wallace and Hobbs equation (3.68). In the Full chart, the upper LFC agreed within 5 mb, except in two cooled cases where the site puts its only LFC at 1000 mb and MetPy puts it at 946 and 927 mb. Full chart CAPE ran up to about 9% higher than MetPy's, and CIN agreed within 15 J/kg. The comparison did not include SounderPy. Not for forecasting.

## Reference

Wallace, J. M., and P. V. Hobbs, 2006: *Atmospheric Science: An Introductory Survey*. 2nd ed. International Geophysics Series, Vol. 92, Academic Press (Elsevier). ISBN 978-0-12-732951-2.
