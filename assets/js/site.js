/* ==========================================================================
   Progressive enhancement only.
   The page is complete and navigable with JavaScript disabled: the table of
   contents is real anchor links, every section is in the document, and the
   theme follows the OS. Nothing here is required to read the training.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Theme ------------------------------------------------------------ */
  var STORAGE_KEY = "examsoft-cd-theme";
  var root = document.documentElement;

  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;        // private window, blocked storage, or no storage
    }
  }

  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* Non-fatal. The choice simply will not persist. */
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || (systemPrefersDark() ? "dark" : "light");
  }

  function applyTheme(theme, button) {
    root.setAttribute("data-theme", theme);
    if (button) {
      button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      var label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
    }
  }

  var stored = readStored();
  if (stored === "dark" || stored === "light") {
    root.setAttribute("data-theme", stored);
  }

  var themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.hidden = false;
    applyTheme(currentTheme(), themeBtn);
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next, themeBtn);
      writeStored(next);
    });
  }

  /* --- Mobile navigation ------------------------------------------------ */
  var navBtn = document.querySelector("[data-nav-toggle]");
  var sidebar = document.getElementById("sidebar");

  function isNarrow() {
    return window.matchMedia("(max-width: 62rem)").matches;
  }

  function setNav(open) {
    if (!sidebar || !navBtn) return;
    sidebar.hidden = !open;
    navBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (navBtn && sidebar) {
    if (isNarrow()) setNav(false);

    navBtn.addEventListener("click", function () {
      setNav(sidebar.hidden);
    });

    /* Collapse after choosing a destination on a phone. */
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest("a") && isNarrow()) setNav(false);
    });

    window.addEventListener("resize", function () {
      if (!isNarrow()) sidebar.hidden = false;
    });
  }

  /* --- Active section in the table of contents -------------------------- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var visible = new Set();

    function refresh() {
      var best = null;
      sections.forEach(function (section) {
        if (!visible.has(section.id)) return;
        if (!best || section.offsetTop < best.offsetTop) best = section;
      });

      links.forEach(function (a) {
        var on = best && a.getAttribute("href") === "#" + best.id;
        if (on) {
          a.setAttribute("aria-current", "true");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visible.add(entry.target.id);
        } else {
          visible.delete(entry.target.id);
        }
      });
      refresh();
    }, { rootMargin: "-15% 0px -70% 0px", threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
  }
})();
