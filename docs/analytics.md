# Analytics

The site sends anonymous usage events to **Mixpanel** (EU region). Visitors are told in the footer of every page: "By continuing, you agree to our Privacy Policies", linking to Neo4j's privacy notice (https://neo4j.com/legal-terms/privacy-notice/); there is no banner and no Accept button. This page is the catalogue of what is sent, how to test it, and how to turn it off. Keep it in step with `assets/js/analytics.js`; the unit tests (`test/analytics-core.test.mjs`) and the browser test (`npm run test:browser`) cover the same behaviour.

## How it works

1. **The build decides whether analytics exists.** With a Mixpanel project token in the build environment (`HUGO_PARAMS_MIXPANELTOKEN`), the pages get a `<meta name="gs-analytics">` config tag, the footer notice and the analytics code. Without a token (local previews, pull requests, forks) none of that is in the output, and `npm run check` verifies it.
2. **Tracking starts on page load**, on the production host only (the build's `baseURL`), or on any host with `?analytics=debug` in the URL (events then carry `env: "test"`). Continuing to use the site is the agreement, as the footer says.
3. **The browser's privacy signals are still honoured.** If the browser sends **Global Privacy Control** or **Do Not Track**, nothing is loaded, stored or sent.
4. Mixpanel's small loader (`mixpanel-jslib-snippet.min.js`) and library (`mixpanel.min.js`) are fetched **from this site** (`assets/js/vendor/`, version pinned in `package.json`), not from Mixpanel's CDN, and events go to `https://api-eu.mixpanel.com` (with IP geolocation). The anonymous id is kept in `localStorage`.

The Mixpanel token is public by design (it is visible in the page source of any site that uses Mixpanel). It is kept out of git as the repository **variable** `MIXPANEL_TOKEN` and passed to the build in `.github/workflows/site.yml`.

## Events

Every event name starts with **`GS `** so the site's events stay apart from other sites' events in a shared Mixpanel project (the prefix is added in one place, `track()` in `assets/js/analytics.js`). Every event also carries `page_path` and Mixpanel's own properties (browser, operating system, referrer, and the location worked out from the IP address). Visitors are anonymous: there is no `identify` call and nothing the visitor types is sent.

| Event | When | Properties |
| --- | --- | --- |
| `GS Page View` | every page | `title`, `section` (home, quickstart, docs, examples, agents, other), `repo` (docs pages), `referrer_domain`, `utm_*`, `theme`, `viewport` (mobile, desktop), `page_in_visit`, `env` |
| `GS GitHub Click` | a click, middle-click or Ctrl/Cmd-click on any link to github.com | `destination_url`, `org_repo` (`grand-stack/grandstack-server`, or `grand-stack` for the organisation), `link_kind` (org, repo, file, issues, release, other), `link_text`, `placement`, `env` |
| `GS Copy Command` | the copy button on a command or code block | `command` (the home page tab id such as `p-default`, or `code-block`), `text_start` (first 60 characters), `placement` |
| `GS Setup Tab` | a setup tab on the home page | `tab` |
| `GS Example Filter` | a tag on the examples page | `tag` |
| `GS Theme Toggle` | the light/dark button | `theme` |
| `GS Docs Navigation` | a link in the docs sidebar, the previous/next links or the breadcrumb | `via` (sidebar, next, previous, breadcrumb), `from_path`, `to_path` |
| `GS Scroll Depth` | 25, 50, 75 and 100 percent of the page, once each per page view | `percent` |
| `GS Time On Page` | when the page is left or hidden, if the visitor was on it 5 seconds or more | `seconds` (visible time) |

`GS GitHub Click`, `GS Docs Navigation` and `GS Time On Page` use `sendBeacon`, so they are delivered even as the page unloads.

**Placement values** for `GS GitHub Click`: `header`, `footer`, `home-hero`, `home-card`, `docs-source` (the "Source" link at the bottom of a docs page), `docs-body`, `quickstart`, `agents`, `other`; an element can set its own with `data-placement="..."`.

**Where the visit came from.** On the first page view the site registers `initial_path`, `initial_referrer_domain` and `initial_utm_*` as super properties, so every later event in the visit, including the GitHub click, carries them.

## Setting it up

1. Create the repository variable (not a secret): **Settings, Secrets and variables, Actions, Variables, New repository variable** named `MIXPANEL_TOKEN` in `grand-stack/grand-stack.github.io` with the project token. The EU project is assumed: a token from another region needs `mixpanelHost` in `hugo.toml` changed too, or events are dropped.
2. Run the **site** workflow (or push). The next deploy has the notice.
3. Open the live site and look in Mixpanel's *Live view* / *Events*.

## Testing

```sh
npm ci
npm test                    # unit tests, including the analytics helpers
npm run test:browser        # builds with a dummy token and drives Chrome with Mixpanel requests intercepted (CHROME_PATH to point at Chrome)
npm run vendor -- --check   # the vendored Mixpanel files match the pinned package
HUGO_PARAMS_MIXPANELTOKEN=your-token hugo server   # then open http://localhost:1313/?analytics=debug
```

The browser test proves: a normal visit sends a Page View with the project token and the first-touch source without any click; the footer notice and its link are on every page; each event above arrives with the expected properties; with Global Privacy Control or Do Not Track nothing is loaded or sent.

## Adding or changing an event

1. Send it from `assets/js/analytics.js` with `track(name, props)` (or `track(name, props, true)` for `sendBeacon`). Page-level user actions in `main.js` use `announce("gs:...", detail)` and a listener in `wire()`.
2. Put any logic that does not need the browser in `assets/js/analytics-core.js` and test it in `test/analytics-core.test.mjs`.
3. Add it to the table above and a check to `scripts/test-analytics-browser.mjs`.
4. Do not add personal data or free text typed by a visitor.

## Updating Mixpanel's library

`npm install --save-exact mixpanel-browser@<version>`, then `npm run vendor`, run the browser test, and commit the new files in `assets/js/vendor/`. Dependabot proposes the version bump; CI fails if the committed files and the package disagree.

## Turning it off

Remove the repository variable `MIXPANEL_TOKEN` and deploy: the next build has no analytics code and no footer notice.

## Dashboards

The dashboard and funnel definitions that go with these events are recorded here once they exist, so they can be recreated.
