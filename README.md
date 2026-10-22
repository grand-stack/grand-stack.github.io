# grand-stack.github.io

The website for GRANDstack, published at **https://grandstack.ai**. A [Hugo](https://gohugo.io) site with its own hand-written theme: no third-party theme, no JavaScript framework, no external requests. Fonts (Public Sans, Fira Code) are bundled.

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

`docs-manifest.json` says which pages of which repo go where. Add a page there when a repo gets a new doc. The script turns links between docs into site links, links to files the site does not hold into GitHub links (`https://github.com/grand-stack/<repo>`), and fails on a broken link. Never edit `content/docs/`, `content/roadmap.md`, `static/diagrams/` or `data/docs.json` by hand.

## Examples

`data/examples.json` holds the example cards. They are run against real stacks:

```sh
node scripts/verify-examples.mjs --stack default --write      # also: agents, federation, auth (the matching compose setup must be running)
```

`--write` stores the real output in the file. An example that fails is not published until fixed.

## Layout

| Path | What |
| --- | --- |
| `hugo.toml` | Site settings (`githubOrg`), output formats for `llms.txt` and `llms-full.txt` |
| `layouts/`, `assets/` | The theme: templates, CSS (light and dark tokens), JavaScript (theme toggle, copy buttons, tabs, filters; about 2 KB) |
| `content/quickstart.md`, `content/agents.md` | Hand-written pages |
| `content/docs/`, `content/roadmap.md` | Generated copies |
| `scripts/` | `sync-docs.mjs`, `check-site.mjs`, `verify-examples.mjs` |
| `static/` | Fonts, favicon, `CNAME` (grandstack.ai), generated diagrams |

## Deployment

`.github/workflows/pages.yml` builds with Hugo 0.164 and deploys to GitHub Pages on every push to `main`. In the repository settings, set Pages to **GitHub Actions** and the custom domain to `grandstack.ai`; the `CNAME` file is in `static/`. The workflow has not been run from here.

## Licence

Apache License 2.0 ([LICENSE](LICENSE), [NOTICE](NOTICE)), the same as every GRANDstack repository and as `@neo4j/graphql`. Bundled fonts are SIL OFL 1.1; see [THIRD_PARTY.md](THIRD_PARTY.md).
