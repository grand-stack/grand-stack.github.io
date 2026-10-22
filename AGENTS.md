# AGENTS.md: grand-stack.github.io

The GRANDstack website: a Hugo site with its own theme. Most of `content/` is a generated copy of the other repositories' docs.

## Commands

```sh
hugo server                         # preview
npm run build && npm run check      # build, then check links, anchors, alt text, SVGs, llms.txt
npm run sync                        # refresh the docs copy (repos must sit beside this one)
node scripts/verify-examples.mjs --stack default --write   # run the examples (stack must be up)
```

## Rules

- **Do not edit generated files** (`content/docs/`, `content/roadmap.md`, `static/diagrams/`, `data/docs.json`, `data/versions.json`). Change the doc in its repository, then `npm run sync`. New doc pages must be added to `docs-manifest.json`.
- Licence is Apache-2.0 for everything. Do not add a third-party Hugo theme, and do not load scripts, styles or fonts from other sites (`check` fails on them). New bundled assets need their licence listed in THIRD_PARTY.md.
- Keep the site working without JavaScript (content readable); JavaScript only adds the theme toggle, copy buttons, tabs and filters.
- Examples in `data/examples.json` must pass `verify-examples` against the matching stack before they are committed.
- Do not claim on the site what has not been run. Deployment (Pages, DNS) is not verified from here.
- Use the theme tokens in `assets/css/main.css`; check light and dark and a 390 px width after layout changes (no horizontal overflow).
