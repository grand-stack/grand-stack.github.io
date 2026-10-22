// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
//
// Pure helpers for the site's analytics: no DOM access that matters, no network, no storage. They are unit tested
// (test/analytics-core.test.mjs) and used by analytics.js, which does the browser work. Works as a plain script
// (window.GSAnalyticsCore) and under Node (module.exports).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GSAnalyticsCore = factory();
})(this, function () {
  var SCROLL_STEPS = [25, 50, 75, 100];

  /** False when the browser asks not to be tracked: Global Privacy Control, or Do Not Track set to "1" or "yes". */
  function trackingAllowed(gpc, dnt) {
    return !(gpc === true || dnt === "1" || dnt === "yes");
  }

  /** Which part of the site a path belongs to. */
  function sectionFor(path) {
    if (path === "/" || path === "") return "home";
    var first = path.split("/")[1];
    return { quickstart: "quickstart", docs: "docs", examples: "examples", agents: "agents" }[first] || "other";
  }

  /** The repository a docs page belongs to (/docs/grandstack-server/mutations/ gives grandstack-server), or "". */
  function repoFor(path) {
    var m = path.match(/^\/docs\/([^/]+)\//);
    return m ? m[1] : "";
  }

  /** Describes a link to GitHub, or null if the URL is not on github.com. */
  function parseGithubUrl(href) {
    var u;
    try { u = new URL(href, "https://www.grandstack.ai/"); } catch (e) { return null; }
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    var parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return { orgRepo: "github.com", kind: "other" };
    if (parts.length === 1) return { orgRepo: parts[0], kind: "org" };
    var orgRepo = parts[0] + "/" + parts[1];
    var third = parts[2];
    var kind = "repo";
    if (third === "blob" || third === "tree" || third === "raw") kind = "file";
    else if (third === "issues" || third === "pull" || third === "pulls" || third === "discussions") kind = "issues";
    else if (third === "releases" || third === "tags") kind = "release";
    else if (third) kind = "other";
    return { orgRepo: orgRepo, kind: kind };
  }

  /**
   * Where on the page a link sits. `markers` is the list of the element's ancestors' data-placement values and class names,
   * nearest first, as strings like "placement:footer" or "class:site-header"; this keeps the function independent of the DOM.
   */
  function placementFrom(markers, section) {
    for (var i = 0; i < markers.length; i++) if (markers[i].indexOf("placement:") === 0) return markers[i].slice(10);
    function has(c) { return markers.indexOf("class:" + c) !== -1; }
    if (has("site-header")) return "header";
    if (has("site-footer")) return "footer";
    if (has("hero")) return "home-hero";
    if (has("source")) return "docs-source";
    if (has("card") && section === "home") return "home-card";
    if (has("prose")) return section === "docs" ? "docs-body" : section;
    return "other";
  }

  /** utm_* parameters from a query string, as {utm_source: "x"}. */
  function utmFrom(search) {
    var out = {};
    var p;
    try { p = new URLSearchParams(search); } catch (e) { return out; }
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      var v = p.get(k);
      if (v) out[k] = v.slice(0, 100);
    });
    return out;
  }

  /** The referring site's host, or "" when the visit came from our own pages or has no referrer. */
  function referrerDomain(referrer, ownHost) {
    if (!referrer) return "";
    try {
      var host = new URL(referrer).hostname.replace(/^www\./, "");
      return host === String(ownHost).replace(/^www\./, "") ? "" : host;
    } catch (e) { return ""; }
  }

  /** Scroll milestones newly reached: passed = percent already reported (array), current = percent scrolled now. */
  function newScrollSteps(passed, current) {
    return SCROLL_STEPS.filter(function (s) { return current >= s && passed.indexOf(s) === -1; });
  }

  /** Percent of the page scrolled, 0 to 100, from the scroll position, window height and document height. */
  function scrollPercent(scrollTop, viewport, docHeight) {
    var scrollable = docHeight - viewport;
    if (scrollable <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((scrollTop / scrollable) * 100)));
  }

  /** How a docs link was used, from markers like "class:sidebar", "class:pager" and "class:next". */
  function docsNavVia(markers) {
    function has(c) { return markers.indexOf("class:" + c) !== -1; }
    if (has("sidebar")) return "sidebar";
    if (has("pager")) return has("next") ? "next" : has("prev") ? "previous" : "pager";
    if (has("crumbs")) return "breadcrumb";
    return "";
  }

  return { trackingAllowed: trackingAllowed, sectionFor: sectionFor, repoFor: repoFor, parseGithubUrl: parseGithubUrl, placementFrom: placementFrom, utmFrom: utmFrom, referrerDomain: referrerDomain, newScrollSteps: newScrollSteps, scrollPercent: scrollPercent, docsNavVia: docsNavVia };
});
