# AGENTS.md: grand-stack.github.io

The GRANDstack website: a Hugo site with its own theme. Most of `content/` is a generated copy of the other repositories' docs.

## Commands

```sh
hugo server                         # preview
npm run build && npm run check      # build, then check links, anchors, alt text, SVGs, llms.txt
npm run sync                        # refresh the docs copy (repos must sit beside this one); writes content/docs, static/diagrams, data/docs.json, data/versions.json
npm run sync:check                  # exit 1 if the copy is out of date
node scripts/verify-examples.mjs --stack default --write   # run the examples (stack must be up)
```

## Rules

- **Do not edit generated files** (`content/docs/`, `static/diagrams/`, `data/docs.json`, `data/versions.json`). Change the doc in its repository, then `npm run sync`. New doc pages must be added to `docs-manifest.json`.
- Licence is Apache-2.0 for everything. Do not add a third-party Hugo theme, and do not load scripts, styles or fonts from other sites (`check` fails on them). New bundled assets need their licence listed in THIRD_PARTY.md.
- **Analytics**: the footer notice ("By continuing, you agree to our Privacy Policies", linking to Neo4j's privacy notice) is part of it and must stay on every page whenever analytics is built in. Global Privacy Control and Do Not Track must keep switching it off, and no personal data or typed text is ever sent. Every event is listed in `docs/analytics.md`; update that file, the unit tests and `scripts/test-analytics-browser.mjs` when you change one. Mixpanel's library is vendored (`npm run vendor`); never load it from a CDN.
- Keep the site working without JavaScript (content readable); JavaScript only adds the theme toggle, copy buttons, tabs and filters.
- Examples in `data/examples.json` must pass `verify-examples` against the matching stack before they are committed.
- Do not claim on the site what has not been run. Deployment (Pages, DNS) is not verified from here.
- Use the theme tokens in `assets/css/main.css`; check light and dark and a 390 px width after layout changes (no horizontal overflow).
- New code files need the copyright header (two lines: `Copyright (c) "Neo4j"` and `Neo4j Sweden AB [http://neo4j.com]`, in the file's comment syntax). Run `node ../grandstack/scripts/add-headers.mjs` to add it everywhere; `--check` lists what is missing. Generated files are exempt.
