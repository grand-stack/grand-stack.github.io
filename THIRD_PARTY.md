# Third-party material

The site's code (layouts, CSS, JavaScript, scripts) is Apache-2.0 (see LICENSE). It uses no third-party Hugo theme and loads nothing from other websites.

## Fonts (bundled in `static/fonts/`)

| Font | Files | Licence |
| --- | --- | --- |
| Public Sans | `public-sans-latin-{400,600,700}-normal.woff2` | SIL Open Font License 1.1: `static/fonts/PublicSans-OFL.txt` |
| Fira Code | `fira-code-latin-{400,500}-normal.woff2` | SIL Open Font License 1.1: `static/fonts/FiraCode-OFL.txt` |

The font files come unchanged from the `@fontsource/public-sans` and `@fontsource/fira-code` packages (5.3.0), Latin subset. The OFL permits bundling and redistribution with software under another licence; the fonts themselves stay under the OFL and may not be sold on their own.

## Analytics library (bundled in `assets/js/vendor/`)

| Library | Files | Licence |
| --- | --- | --- |
| mixpanel-browser 2.84.0 | `mixpanel.min.js`, `mixpanel-jslib-snippet.min.js`, `mixpanel-recorder.min.js` | Apache License 2.0 |

Copied unchanged from the npm package by `npm run vendor`. They are served from this site, not from Mixpanel's CDN, and only loaded when analytics is built in and the visitor's browser sends no Global Privacy Control or Do Not Track signal (see `docs/analytics.md`). The session recorder bundles the open-source rrweb recorder (rrweb, rrdom, rrweb-snapshot, rrweb-types, rrweb-utils, rrweb-plugin-console-record 2.0.0-alpha.18), mitt, nanoid, base64-arraybuffer, fsm, json-logic-js and css-font-loading-module (MIT), picocolors (ISC), postcss (MIT) and source-map-js (BSD-3-Clause), as listed in the package's `mixpanel-browser.cdx.json`.

## Design

The look follows https://neo4j.sh (palette, type and layout ideas). No files, images or logos are copied from that site, and the site does not use the Neo4j logo.

## Content

The documentation pages are copies of the documentation in the GRANDstack repositories (Apache-2.0). The examples and the federation docs mention Wikipedia; Wikipedia text is available under CC BY-SA 4.0 and is shown by the demo, not stored by this site.
