// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Theme toggle, copy buttons, install tabs, example filters, mobile docs menu. No dependencies.
(function () {
  var root = document.documentElement;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // Small page events that the optional analytics script (analytics.js) can listen for. Nothing happens if it is not there.
  function announce(name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* ignore */ } }

  var toggle = document.querySelector(".theme-toggle");
  if (toggle) toggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("theme", next);
    announce("gs:theme", { theme: next });
  });

  function copyText(text, button) {
    var done = function () { var old = button.textContent; button.textContent = "copied"; setTimeout(function () { button.textContent = old; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }
  document.querySelectorAll("pre").forEach(function (pre) {
    if (pre.closest(".cmd") || pre.querySelector(".copy")) return;
    var b = document.createElement("button");
    b.className = "copy"; b.type = "button"; b.textContent = "copy"; b.setAttribute("aria-label", "Copy code");
    b.addEventListener("click", function () {
      var text = pre.innerText.replace(/\ncopy$/, "").replace(/copy$/, "");
      copyText(text, b);
      announce("gs:copy", { command: "code-block", text: text.trim().slice(0, 60), placement: "code-block" });
    });
    pre.appendChild(b);
  });
  document.querySelectorAll(".cmd .copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.closest(".cmd").querySelector("pre").innerText.trim();
      var panel = b.closest(".tab-panel");
      copyText(text, b);
      announce("gs:copy", { command: panel ? panel.id : "cmd", text: text.slice(0, 60), placement: "home-hero" });
    });
  });

  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var tabs = group.querySelectorAll('[role="tab"]');
    var scope = group.parentElement;
    function select(tab) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
      scope.querySelectorAll(".tab-panel").forEach(function (p) { p.hidden = p.id !== tab.getAttribute("aria-controls"); });
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { select(t); announce("gs:tab", { tab: t.id }); }); });
  });

  var chips = document.querySelectorAll(".chip");
  if (chips.length) {
    var cards = document.querySelectorAll("[data-example]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var tag = chip.getAttribute("data-tag");
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        announce("gs:filter", { tag: tag });
        cards.forEach(function (card) {
          var tags = (card.getAttribute("data-tags") || "").split(" ");
          card.hidden = tag !== "all" && tags.indexOf(tag) === -1;
        });
      });
    });
  }

  var menu = document.querySelector(".menu-btn"), side = document.querySelector(".sidebar");
  if (menu && side) menu.addEventListener("click", function () {
    var open = side.classList.toggle("open");
    menu.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
