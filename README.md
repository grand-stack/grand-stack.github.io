# grand-stack.github.io

The website for GRANDstack, published at **https://www.grandstack.ai**. A [Hugo](https://gohugo.io) site with its own hand-written theme: no third-party theme, no JavaScript framework, no external requests. Fonts (Public Sans, Fira Code) are bundled.

The site holds only the website. The documentation pages are a **generated copy** of the docs in the other repositories, which stay the source of truth.

## Work on it

You need Hugo extended 0.164 or later (`brew install hugo`) and Node 22 or later (for the scripts; they have no dependencies).

```sh
hugo server                 # http://localhost:1313
npm run build               # hugo --gc --minify, writes public/
npm run check               # checks the built site: links, anchors, alt text, no external scripts, SVG safety, llms.txt
```

## Update the docs copy

After changing a doc in any repository, with the repositories side by side (this one beside `grandstack`, `grandstack-server` and so on):

```sh
npm run sync                # copies docs and diagrams, rewrites links, refreshes data/docs.json and data/versions.json
npm run sync:check          # exits 1 if the copy is out of date (skips if the repos are not there)
```

The sync only writes inside this repo (`content/docs/`, `static/diagrams/`, `data/`); it never changes the other repos. It finds them through `"workspace": ".."` in the manifest (so they must sit beside this one), and reads version tags from their `.git` folders. Run it **before** `npm run build`; to see the result use `hugo server`, or `npm run build` and `npm run check`.

`docs-manifest.json` says which pages of which repo go where. A new doc does not appear until you add it: in the repo's `pages` list add `{ "file": "docs/your-doc.md", "section": "Guides" }` (optional `"slug"`; the section names are the sidebar headings, and the position in the list is the order). Adding a page renumbers the `weight` of the pages after it, so a few other generated files change too. Start each doc with a one-sentence lead: it becomes the page description. The script turns links between docs into site links, links to files the site does not hold into GitHub links (`https://github.com/grand-stack/<repo>`), and fails (exit 1) on a link to a file that does not exist. It does not check `#anchors`: `npm run check` does that on the built site. `sync:check` exits 1 when the copy is out of date or a link is broken, and exits 0 without doing anything when the repos are not beside this one. Never edit `content/docs/`, `static/diagrams/` or `data/docs.json` by hand.

## Examples

`data/examples.json` holds the example cards. They are run against real stacks:

```sh
node scripts/verify-examples.mjs --stack default --write      # also: agents, federation, auth (the matching compose setup must be running)
```

`--write` stores the real output in the file. An example that fails is not published until fixed.

## Layout

| Path | What |
| --- | --- |
| `docs-manifest.json`, `data/` | Which docs go where; data files (docs list, versions, examples). `docs.json` and `versions.json` are generated |
| `hugo.toml` | Site settings (`githubOrg`), output formats for `llms.txt` and `llms-full.txt` |
| `layouts/`, `assets/` | The theme: templates, CSS (light and dark tokens), JavaScript (theme toggle, copy buttons, tabs, filters; about 2 KB) |
| `content/quickstart.md`, `content/agents.md` | Hand-written pages |
| `content/docs/` | Generated copy |
| `scripts/` | `sync-docs.mjs`, `check-site.mjs`, `verify-examples.mjs` |
| `static/` | Fonts, favicon, `CNAME` (www.grandstack.ai), generated diagrams |

## Analytics

Anonymous usage analytics with Mixpanel (US region): page views, clicks to GitHub, copied commands and how visitors move through the docs, plus session replay and click/scroll heatmaps for half of the visits (images blocked, inputs masked). The footer tells visitors "By continuing, you agree to our Privacy Policies" (linking to Neo4j's privacy notice); there is no banner. Global Privacy Control and Do Not Track switch it off. Builds without the `MIXPANEL_TOKEN` repository variable have none of it. What is sent, how to test it and how to change it: [docs/analytics.md](docs/analytics.md).

## Deployment

`.github/workflows/pages.yml` builds with Hugo 0.164 and deploys to GitHub Pages on every push to `main`. In the repository settings, set Pages to **GitHub Actions** and the custom domain to `www.grandstack.ai`; the `CNAME` file is in `static/`. The workflow has not been run from here.

## Licence

Apache License 2.0 ([LICENSE](LICENSE), [NOTICE](NOTICE)), the same as every GRANDstack repository and as `@neo4j/graphql`. Bundled fonts are SIL OFL 1.1; see [THIRD_PARTY.md](THIRD_PARTY.md).
