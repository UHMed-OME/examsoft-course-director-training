(function () {
  "use strict";

  var sidebar = document.getElementById("sidebar");
  var toggle = document.querySelector(".sidebar-toggle");
  var backdrop = document.querySelector(".sidebar-backdrop");

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      sidebar.classList.contains("is-open") ? closeSidebar() : openSidebar();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  if (sidebar) {
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeSidebar();
    });
  }
})();
