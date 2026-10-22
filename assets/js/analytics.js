// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
//
// Analytics (events, session replay and heatmaps). Does nothing at all unless the build contains a Mixpanel token (a <meta name="gs-analytics"> tag), the page is on the
// production host (or has ?analytics=debug), and the browser has not asked not to be tracked (Global Privacy Control or Do Not Track).
// Then the vendored Mixpanel library is loaded from this site and events are sent to Mixpanel's endpoint. The footer tells visitors
// that continuing means agreeing to the privacy policy.
// Event names and properties are listed in docs/analytics.md: keep that file in step with this one.
(function () {
  var core = window.GSAnalyticsCore;
  var meta = document.querySelector('meta[name="gs-analytics"]');
  if (!core || !meta) return;
  var cfg;
  try { cfg = JSON.parse(meta.getAttribute("content")); } catch (e) { return; }
  var debug = /[?&]analytics=debug(&|$)/.test(location.search);
  if (location.hostname !== cfg.prodHost && !debug) return;

  if (!core.trackingAllowed(navigator.globalPrivacyControl === true, navigator.doNotTrack || window.doNotTrack || null)) return;

  function read(k, area) { try { return (area || localStorage).getItem(k); } catch (e) { return null; } }
  function write(k, v, area) { try { (area || localStorage).setItem(k, v); } catch (e) { /* storage blocked: nothing to remember */ } }
  var path = location.pathname;
  var section = core.sectionFor(path);
  var started = false;
  var wired = false;

  // Every event name starts with "GS " so these events stay apart from other sites' events in a shared Mixpanel project.
  var PREFIX = "GS ";
  function track(name, props, beacon) {
    name = PREFIX + name;
    var all = props || {};
    all.page_path = all.page_path || path;
    // always go through window.mixpanel: it is the loader's queue until the library arrives, and the library itself after that
    try { window.mixpanel.track(name, all, beacon ? { transport: "sendBeacon" } : undefined); } catch (e) { /* analytics must never break the page */ }
  }

  function markers(el) {
    var out = [];
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 10; n = n.parentElement, i++) {
      if (n.getAttribute("data-placement")) out.push("placement:" + n.getAttribute("data-placement"));
      if (n.classList) for (var j = 0; j < n.classList.length; j++) out.push("class:" + n.classList[j]);
    }
    return out;
  }
  function viewport() { return window.matchMedia && window.matchMedia("(max-width: 52rem)").matches ? "mobile" : "desktop"; }
  function theme() { return document.documentElement.getAttribute("data-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }

  function pageView() {
    var visitPages = parseInt(read("gs-pages", sessionStorage) || "0", 10) + 1;
    write("gs-pages", String(visitPages), sessionStorage);
    var refDomain = core.referrerDomain(document.referrer, location.hostname);
    var utm = core.utmFrom(location.search);
    var first = {};
    first.initial_path = path;
    if (refDomain) first.initial_referrer_domain = refDomain;
    Object.keys(utm).forEach(function (k) { first["initial_" + k] = utm[k]; });
    window.mixpanel.register_once(first);
    var props = { title: document.title, section: section, repo: core.repoFor(path), referrer_domain: refDomain, theme: theme(), viewport: viewport(), page_in_visit: visitPages, env: debug ? "test" : "production" };
    Object.keys(utm).forEach(function (k) { props[k] = utm[k]; });
    track("Page View", props);
  }

  function onClick(event) {
    if (event.type === "click" && event.button !== 0) return;
    if (event.type === "auxclick" && event.button !== 1) return;
    var a = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!a) return;
    var gh = core.parseGithubUrl(a.href);
    if (gh) {
      track("GitHub Click", { destination_url: a.href.slice(0, 300), org_repo: gh.orgRepo, link_kind: gh.kind, link_text: (a.textContent || "").trim().slice(0, 80), placement: core.placementFrom(markers(a), section), env: debug ? "test" : "production" }, true);
      return;
    }
    if (a.origin === location.origin) {
      var via = core.docsNavVia(markers(a));
      if (via) track("Docs Navigation", { via: via, from_path: path, to_path: a.pathname }, true);
    }
  }

  var passed = [];
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var pct = core.scrollPercent(window.pageYOffset || document.documentElement.scrollTop, window.innerHeight, document.documentElement.scrollHeight);
      core.newScrollSteps(passed, pct).forEach(function (s) { passed.push(s); track("Scroll Depth", { percent: s }); });
    });
  }

  var visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  var visibleMs = 0;
  var timeSent = false;
  function sendTime() {
    if (timeSent) return;
    if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = null; }
    var seconds = Math.round(visibleMs / 1000);
    if (seconds >= 5) { timeSent = true; track("Time On Page", { seconds: seconds }, true); }
  }
  function onVisibility() {
    if (document.visibilityState === "hidden") sendTime();
    else if (!visibleSince) { visibleSince = Date.now(); timeSent = false; }
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendTime);
    document.addEventListener("gs:copy", function (e) { track("Copy Command", { command: e.detail.command, text_start: e.detail.text, placement: e.detail.placement }); });
    document.addEventListener("gs:tab", function (e) { track("Setup Tab", { tab: e.detail.tab }); });
    document.addEventListener("gs:filter", function (e) { track("Example Filter", { tag: e.detail.tag }); });
    document.addEventListener("gs:theme", function (e) { track("Theme Toggle", { theme: e.detail.theme }); });
    onScroll();
  }

  function start() {
    if (started) return;
    started = true;
    // Mixpanel's small loader (vendored) creates a queue, then fetches the library from MIXPANEL_CUSTOM_LIB_URL: our own copy, not their CDN.
    window.MIXPANEL_CUSTOM_LIB_URL = cfg.src;
    var s = document.createElement("script");
    s.src = cfg.snippet;
    s.async = true;
    s.onload = function () {
      if (!window.mixpanel || !window.mixpanel.init) return;
      window.mixpanel.init(cfg.token, {
        api_host: cfg.host, persistence: "localStorage", autocapture: false, track_pageview: false, ip: true, batch_flush_interval_ms: 1000, debug: debug,
        // Session replay and heatmaps: a share of visits is recorded (cfg.recordPercent). The recorder is our own vendored copy, fetched only for
        // visits that are sampled in. Inputs are masked and images, video and audio are blocked (Mixpanel's defaults, stated here on purpose);
        // console output, network calls, canvas and fonts are never recorded.
        record_sessions_percent: cfg.recordPercent, recorder_src: cfg.recorder, record_heatmap_data: true,
        record_mask_inputs: true, record_block_selector: "img, video, audio", record_console: false, record_network: false, record_canvas: false, record_collect_fonts: false
      });
      pageView(); // calls made now are queued by the loader and replayed when the library arrives
      wire();
    };
    s.onerror = function () { started = false; };
    document.head.appendChild(s);
  }

  start();
})();
