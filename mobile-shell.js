/**
 * Phone-first shell: lock layout height to the visual viewport so the
 * bottom tab bar never sinks under browser chrome / home indicator.
 */
(function mobileShell() {
  const root = document.documentElement;

  function isPhoneShell() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function setAppHeight() {
    // visualViewport tracks browser UI show/hide without layout thrash
    const vv = window.visualViewport;
    let h;
    if (vv && isPhoneShell()) {
      h = Math.round(vv.height);
    } else {
      h = Math.round(window.innerHeight);
    }
    // Guard against 0 during orientation flicker
    if (!h || h < 200) h = Math.round(window.innerHeight) || 600;
    root.style.setProperty("--app-height", `${h}px`);

    // Offset for visualViewport.offsetTop when iOS toolbars push content
    if (vv && isPhoneShell()) {
      root.style.setProperty("--vv-offset-top", `${Math.round(vv.offsetTop || 0)}px`);
    } else {
      root.style.setProperty("--vv-offset-top", "0px");
    }
  }

  function applyMode() {
    if (isPhoneShell()) {
      root.classList.add("rp-mobile");
      document.body?.classList.add("rp-mobile");
    } else {
      root.classList.remove("rp-mobile");
      document.body?.classList.remove("rp-mobile");
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--vv-offset-top");
    }
    setAppHeight();
  }

  function onReady() {
    applyMode();
    // Measure tab bar and publish height for padding
    const tab = document.querySelector(".tab-bar");
    if (tab) {
      const h = Math.ceil(tab.getBoundingClientRect().height);
      if (h > 40) root.style.setProperty("--tab-bar-height", `${h}px`);
    }
  }

  applyMode();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  window.addEventListener("resize", applyMode, { passive: true });
  window.addEventListener("orientationchange", () => {
    // iOS needs a beat after rotate
    setTimeout(applyMode, 50);
    setTimeout(applyMode, 250);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setAppHeight, { passive: true });
    window.visualViewport.addEventListener("scroll", setAppHeight, { passive: true });
  }

  // Prevent body rubber-band on chrome; never block map / sheet / screen scroll
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isPhoneShell()) return;
      if (
        e.target.closest(
          ".screen, .live-map, .leaflet-container, .leaflet-pane, .beta-scroll, .feedback-panel, .overlay .sheet, .sport-grid, #betaGate, #profileSettings, .profile-settings"
        )
      ) {
        return;
      }
      if (e.target.closest(".tab-bar, .app-header, .status-bar, .location-bar")) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  window.RollPhaseShell = { setAppHeight, applyMode, isPhoneShell };
})();
