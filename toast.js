/**
 * A small, accessible toast — replaces the plain alert() the venue-share button used.
 * RollToast.show("message") shows it above the tab bar for 2.5s.
 */
const RollToast = (() => {
  let el = null;
  let hideTimer = null;

  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "rollToast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:absolute",
      "left:50%",
      "bottom:78px",
      "transform:translateX(-50%) translateY(8px)",
      "background:rgba(18,22,30,0.96)",
      "color:#f3f5f7",
      "border:1px solid rgba(255,255,255,0.12)",
      "border-radius:999px",
      "padding:10px 18px",
      "font:600 0.82rem/1.3 Inter, system-ui, sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "z-index:60",
      "opacity:0",
      "transition:opacity 0.15s ease, transform 0.15s ease",
      "pointer-events:none",
      "max-width:86%",
      "text-align:center",
    ].join(";");
    (document.querySelector(".stage") || document.body).appendChild(el);
    return el;
  }

  function show(message, ms = 2500) {
    const node = ensure();
    node.textContent = message;
    clearTimeout(hideTimer);
    // restart the transition even if a toast is already showing
    node.style.opacity = "0";
    node.style.transform = "translateX(-50%) translateY(8px)";
    requestAnimationFrame(() => {
      node.style.opacity = "1";
      node.style.transform = "translateX(-50%) translateY(0)";
    });
    hideTimer = setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateX(-50%) translateY(8px)";
    }, ms);
  }

  return { show };
})();

if (typeof window !== "undefined") window.RollToast = RollToast;
