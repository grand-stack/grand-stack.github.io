# Analytics

The site can send anonymous usage events to **Mixpanel** (EU region), **only after a visitor clicks Accept** on the cookie-style notice. This page is the catalogue of what is sent, how to test it, and how to turn it off. Keep it in step with `assets/js/analytics.js`; the unit tests (`test/analytics-core.test.mjs`) and the browser test (`npm run test:browser`) cover the same behaviour.

## How it works

1. **The build decides whether analytics exists.** With a Mixpanel project token in the build environment (`HUGO_PARAMS_MIXPANELTOKEN`), the pages get a `<meta name="gs-analytics">` config tag, the consent notice, a "Cookie settings" footer button and the analytics code. Without a token (local previews, pull requests, forks) none of that is in the output, and `npm run check` verifies it.
2. **Nothing happens before consent.** The notice is shown when the visitor has not chosen (or chose more than 12 months ago). Until they accept, no Mixpanel code is downloaded, nothing is stored and nothing is sent. **Global Privacy Control** and **Do Not Track** count as declined: no notice, no tracking, even if the visitor accepted earlier.
3. **After Accept**, Mixpanel's small loader (`mixpanel-jslib-snippet.min.js`) and library (`mixpanel.min.js`) are fetched **from this site** (`assets/js/vendor/`, version pinned in `package.json`), not from Mixpanel's CDN, and events go to `https://api-eu.mixpanel.com`. The anonymous id is kept in `localStorage`. Declining later clears it and reloads.
4. It only runs on the production host (the build's `baseURL`), or on any host with `?analytics=debug` in the URL (events then carry `env: "test"`).

The Mixpanel token is public by design (it is visible in the page source of any site that uses Mixpanel). It is kept out of git as the repository **variable** `MIXPANEL_TOKEN` and passed to the build in `.github/workflows/site.yml`.

## Events

Every event also carries `page_path` and Mixpanel's own properties (browser, operating system, referrer, and the location worked out from the IP address). Visitors are anonymous: there is no `identify` call and nothing the visitor types is sent.

| Event | When | Properties |
| --- | --- | --- |
| `Page View` | every page, after consent | `title`, `section` (home, quickstart, docs, examples, agents, privacy, other), `repo` (docs pages), `referrer_domain`, `utm_*`, `theme`, `viewport` (mobile, desktop), `page_in_visit`, `env` |
| `GitHub Click` | a click, middle-click or Ctrl/Cmd-click on any link to github.com | `destination_url`, `org_repo` (`grand-stack/grandstack-server`, or `grand-stack` for the organisation), `link_kind` (org, repo, file, issues, release, other), `link_text`, `placement`, `env` |
| `Copy Command` | the copy button on a command or code block | `command` (the home page tab id such as `p-default`, or `code-block`), `text_start` (first 60 characters), `placement` |
| `Setup Tab` | a setup tab on the home page | `tab` |
| `Example Filter` | a tag on the examples page | `tag` |
| `Theme Toggle` | the light/dark button | `theme` |
| `Docs Navigation` | a link in the docs sidebar, the previous/next links or the breadcrumb | `via` (sidebar, next, previous, breadcrumb), `from_path`, `to_path` |
| `Scroll Depth` | 25, 50, 75 and 100 percent of the page, once each per page view | `percent` |
| `Time On Page` | when the page is left or hidden, if the visitor was on it 5 seconds or more | `seconds` (visible time) |

`GitHub Click` and `Docs Navigation` and `Time On Page` use `sendBeacon`, so they are delivered even as the page unloads.

**Placement values** for `GitHub Click`: `header`, `footer`, `home-hero`, `home-card`, `docs-source` (the "Source" link at the bottom of a docs page), `docs-body`, `quickstart`, `agents`, `other`; an element can set its own with `data-placement="..."`.

**Where the visit came from.** On the first page view the site registers `initial_path`, `initial_referrer_domain` and `initial_utm_*` as super properties, so every later event in the visit, including the GitHub click, carries them.

## Setting it up

1. Create the repository variable (not a secret): **Settings, Secrets and variables, Actions, Variables, New repository variable** named `MIXPANEL_TOKEN` in `grand-stack/grand-stack.github.io` with the project token. The EU project is assumed: a token from another region needs `mixpanelHost` in `hugo.toml` changed too, or events are dropped.
2. Run the **site** workflow (or push). The next deploy has the notice.
3. Open the live site, accept, and look in Mixpanel's *Live view* / *Events*.

## Testing

```sh
npm ci
npm test                    # unit tests, including the analytics helpers
npm run test:browser        # builds with a dummy token and drives Chrome with Mixpanel requests intercepted (CHROME_PATH to point at Chrome)
npm run vendor -- --check   # the vendored Mixpanel files match the pinned package
HUGO_PARAMS_MIXPANELTOKEN=your-token hugo server   # then open http://localhost:1313/?analytics=debug
```

The browser test proves: before consent and after Decline or Global Privacy Control there is no request to Mixpanel and the library is not downloaded; after Accept each event above arrives with the expected properties; the choice survives a reload; declining later clears the identifier and stops sending.

## Adding or changing an event

1. Send it from `assets/js/analytics.js` with `track(name, props)` (or `track(name, props, true)` for `sendBeacon`). Page-level user actions in `main.js` use `announce("gs:...", detail)` and a listener in `wire()`.
2. Put any logic that does not need the browser in `assets/js/analytics-core.js` and test it in `test/analytics-core.test.mjs`.
3. Add it to the table above and a check to `scripts/test-analytics-browser.mjs`.
4. Do not add personal data, free text typed by a visitor, or anything sent before consent.

## Updating Mixpanel's library

`npm install --save-exact mixpanel-browser@<version>`, then `npm run vendor`, run the browser test, and commit the new files in `assets/js/vendor/`. Dependabot proposes the version bump; CI fails if the committed files and the package disagree.

## Turning it off

Remove the repository variable `MIXPANEL_TOKEN` and deploy: the next build has no analytics code, notice or footer button. Visitors' stored choice then does nothing.

## Dashboards

The dashboard and funnel definitions that go with these events are recorded here once they exist, so they can be recreated.
