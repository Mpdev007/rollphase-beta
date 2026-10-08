/**
 * RollShare — one share sheet for the app, a gym board, a session, and an official calendar.
 * The QR is drawn on the phone (vendored lean-qr, correction H) with the Rollphase mark in
 * the center. The link is this app: a phone without it gets the install, a phone with it
 * opens the same place. See docs/mat-board/DESIGN.md "The QR poster".
 */
const RollShare = (() => {
  const LOGO_SRC = "assets/logo.jpg";
  const CAL_HOSTS = new Set([
    "ibjjf.com",
    "ufc.com",
    "wako.sport",
    "ijf.org",
    "games.crossfit.com",
    "crossfit.com",
    "hyrox.com",
    "pickleballtournaments.com",
    "ussoccer.com",
    "usavolleyball.org",
    "usacycling.org",
    "ifsc-climbing.org",
    "smoothcomp.com",
  ]);

  let overlay = null;
  let lastFocused = null;
  let qrModule = null;
  let logoImage = null;
  let logoPromise = null;
  let activeDrawShareQr = null;
  let deferredInstall = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadQr() {
    if (qrModule) return qrModule;
    qrModule = await import("./vendor/lean-qr/index.mjs");
    return qrModule;
  }

  function loadLogo() {
    if (logoImage) return Promise.resolve(logoImage);
    if (logoPromise) return logoPromise;
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        logoImage = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error("logo"));
      img.src = LOGO_SRC;
    });
    return logoPromise;
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    if (activeDrawShareQr) {
      window.removeEventListener("afterprint", activeDrawShareQr);
      activeDrawShareQr = null;
    }
    document.removeEventListener("keydown", onKeydown, true);
    if (history.state?.view === "overlay" && history.state?.name === "share") {
      try {
        history.back();
      } catch {
        /* ignore */
      }
    }
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function onPopstate() {
    if (overlay && !(history.state?.view === "overlay" && history.state?.name === "share")) {
      overlay.remove();
      overlay = null;
      document.removeEventListener("keydown", onKeydown, true);
    }
  }
  if (typeof window !== "undefined") window.addEventListener("popstate", onPopstate);

  /** Swaps (or adds) the src= query param on a hash-routed URL like #/gym/<id>?src=share. */
  function withSrc(url, src) {
    const [base, hash] = url.split("#");
    if (!hash) return url;
    const [path, query] = hash.split("?");
    const params = new URLSearchParams(query || "");
    params.set("src", src);
    return `${base}#${path}?${params.toString()}`;
  }

  function buildHash(path, params) {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return `${location.origin}${location.pathname}#${path}${qs ? `?${qs}` : ""}`;
  }

  function gymParams(gym, src) {
    const params = { src };
    if (gym?.name) params.n = gym.name;
    if (gym?.lat != null && gym?.lng != null && gym.lat !== "" && gym.lng !== "") {
      params.lat = gym.lat;
      params.lng = gym.lng;
    }
    const sport = Array.isArray(gym?.sports) ? gym.sports.find(Boolean) : "";
    if (sport) params.sport = sport;
    return params;
  }

  function appUrl() {
    return buildHash("/home", { src: "invite" });
  }

  function gymUrl(gym, src = "share") {
    return buildHash(`/gym/${encodeURIComponent(gym.id)}`, gymParams(gym, src));
  }

  function sessionUrl(gym, slotId, dateIso) {
    return buildHash(`/gym/${encodeURIComponent(gym.id)}`, {
      ...gymParams(gym, "share"),
      slot: slotId,
      d: dateIso || "",
    });
  }

  function calendarUrl(sportId, href) {
    return buildHash("/home", { src: "share", sport: sportId || "", cal: href || "" });
  }

  function safeCal(raw) {
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw);
    } catch {
      return "";
    }
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!CAL_HOSTS.has(host)) return "";
    return url.toString();
  }

  function readArrival() {
    const hash = location.hash || "";
    const [pathPart, query] = hash.replace(/^#/, "").split("?");
    const params = new URLSearchParams(query || "");
    const path = pathPart.startsWith("/") ? pathPart.slice(1) : pathPart;
    const sport = params.get("sport") || "";
    return {
      src: params.get("src") || "",
      sport: /^[a-z0-9]+$/.test(sport) ? sport : "",
      slot: params.get("slot") || "",
      date: params.get("d") || "",
      cal: safeCal(params.get("cal")),
      name: params.get("n") || "",
      lat: params.get("lat") || "",
      lng: params.get("lng") || "",
      gymId: path.startsWith("gym/") ? decodeURIComponent(path.slice(4)) : "",
    };
  }

  function drawModules(canvas, code) {
    const scale = 10;
    const pad = 4;
    const n = code.size;
    const px = (n + pad * 2) * scale;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (code.get(x, y)) ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
      }
    }
  }

  function stampLogo(canvas, img) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    // 0.17 is the largest mark that still scans at correction H.
    // 0.175 covers the public app link and the scan fails.
    const radius = Math.round(w * 0.17);
    const ring = Math.round(w * 0.012);
    const cx = w / 2;
    const cy = w / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, radius + ring, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  async function paint(canvas, url) {
    if (!canvas) return;
    try {
      const { generate, correction } = await loadQr();
      const code = generate(String(url), { minCorrectionLevel: correction.H });
      drawModules(canvas, code);
      try {
        stampLogo(canvas, await loadLogo());
      } catch (e) {
        console.warn("RollShare: logo skipped", e);
      }
      canvas.dataset.ready = "1";
    } catch (e) {
      console.warn("RollShare: QR generation failed", e);
    }
  }

  function isInstalled() {
    return (
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
    );
  }

  function arrivalLine(a) {
    if (a.gymId && a.slot) {
      return a.name ? `This session is at ${a.name}.` : "This is the session that was shared.";
    }
    if (a.gymId) return a.name ? `This is ${a.name}.` : "This is the gym that was shared.";
    if (a.cal) return "This opens the official calendar.";
    return "This opens Rollphase.";
  }

  function mountArrival() {
    document.getElementById("installArrival")?.remove();
    const a = readArrival();
    if (a.src !== "share" && a.src !== "poster" && a.src !== "invite") return;
    if (isInstalled()) return;
    try {
      if (sessionStorage.getItem("rollphase.install.dismiss") === "1") return;
    } catch {
      /* ignore */
    }
    const screen = document.querySelector(".screen.active");
    if (!screen) return;

    const card = document.createElement("div");
    card.id = "installArrival";
    card.className = "install-arrival";

    const mark = document.createElement("img");
    mark.src = LOGO_SRC;
    mark.alt = "";

    const copy = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = "Install Rollphase";
    const p = document.createElement("p");
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    p.textContent = ios
      ? `${arrivalLine(a)} On iPhone, tap Share, then Add to Home Screen.`
      : `${arrivalLine(a)} Add it to your phone and this code keeps opening it.`;
    copy.append(strong, p);

    if (a.cal) {
      const link = document.createElement("a");
      link.className = "install-cal";
      link.href = a.cal;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open the calendar";
      copy.append(link);
    }

    const actions = document.createElement("div");
    actions.className = "install-arrival-actions";
    const installBtn = document.createElement("button");
    installBtn.type = "button";
    installBtn.className = "btn-primary";
    installBtn.id = "installArrivalBtn";
    installBtn.textContent = "Install";
    installBtn.hidden = !deferredInstall;
    installBtn.addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      try {
        await deferredInstall.userChoice;
      } catch {
        /* ignore */
      }
      deferredInstall = null;
      installBtn.hidden = true;
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "install-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => {
      try {
        sessionStorage.setItem("rollphase.install.dismiss", "1");
      } catch {
        /* ignore */
      }
      card.remove();
    });
    actions.append(installBtn, dismiss);

    card.append(mark, copy, actions);
    const back = screen.querySelector(".back-btn");
    if (back) back.insertAdjacentElement("afterend", card);
    else screen.insertBefore(card, screen.firstChild);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
      const src = new URLSearchParams((location.hash.split("?")[1] || "")).get("src");
      if (src !== "share" && src !== "poster" && src !== "invite") return;
      e.preventDefault();
      deferredInstall = e;
      const btn = document.getElementById("installArrivalBtn");
      if (btn) btn.hidden = false;
    });
  }

  async function open({ title, headline, text, url, note, poster = true }) {
    if (overlay) close();
    lastFocused = document.activeElement;
    const line =
      note || "Scan it. The phone installs Rollphase if needed, then opens this.";

    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "shareOverlay";
    overlay.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
        <div class="sheet-handle"></div>
        <h2 id="shareTitle">${esc(headline || "Share")}</h2>
        <p class="sheet-sub">${esc(title || "")}</p>
        <p class="share-note" id="shareNote">${esc(line)}</p>
        <div class="share-qr-frame">
          <canvas id="shareQrCanvas" role="img" aria-label="QR code"></canvas>
        </div>
        <div class="share-actions">
          <button type="button" class="btn-primary" id="shareNativeBtn">Share…</button>
          <button type="button" class="btn-ghost" id="shareCopyBtn">Copy link</button>
          <button type="button" class="btn-ghost" id="shareSaveQrBtn">Save QR image</button>
          <button type="button" class="btn-ghost" id="sharePrintBtn">Print poster</button>
          <button type="button" class="btn-ghost" id="shareCloseBtn">Close</button>
        </div>
        <div id="shareUrlFallback" class="muted small" style="word-break:break-all;text-align:center;display:none" tabindex="0"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const sheetEl = overlay.querySelector(".sheet");
    sheetEl?.setAttribute("tabindex", "-1");
    sheetEl?.focus();

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKeydown, true);
    if (history.state?.view !== "overlay" || history.state?.name !== "share") {
      try {
        history.pushState(
          { view: "overlay", name: "share", tab: typeof state !== "undefined" ? state.tab : undefined, rp: 1 },
          "",
          location.hash
        );
      } catch {
        /* ignore */
      }
    }

    const nativeBtn = overlay.querySelector("#shareNativeBtn");
    const shareData = { title: title || headline || "Rollphase", text: text || line, url };
    const canShareUrl = navigator.canShare ? navigator.canShare(shareData) : !!navigator.share;
    if (navigator.share && canShareUrl) {
      nativeBtn.addEventListener("click", async () => {
        const payload = { ...shareData };
        try {
          const canvas = overlay.querySelector("#shareQrCanvas");
          if (canvas?.dataset.ready === "1" && navigator.canShare) {
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            if (blob) {
              const file = new File([blob], "rollphase-qr.png", { type: "image/png" });
              const withFile = { ...payload, files: [file] };
              if (navigator.canShare(withFile)) {
                await navigator.share(withFile);
                return;
              }
            }
          }
          await navigator.share(payload);
        } catch {
          /* user dismissed the sheet */
        }
      });
    } else {
      nativeBtn.hidden = true;
    }

    overlay.querySelector("#shareCopyBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        window.RollToast?.show?.("Link copied");
      } catch {
        const fb = overlay.querySelector("#shareUrlFallback");
        fb.textContent = url;
        fb.style.display = "block";
        const range = document.createRange();
        range.selectNodeContents(fb);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    const drawShareQr = () => paint(overlay?.querySelector("#shareQrCanvas"), url);
    await drawShareQr();
    activeDrawShareQr = drawShareQr;
    window.addEventListener("afterprint", activeDrawShareQr);

    overlay.querySelector("#shareSaveQrBtn").addEventListener("click", () => {
      const canvas = overlay.querySelector("#shareQrCanvas");
      if (!canvas || canvas.dataset.ready !== "1") return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `rollphase-qr-${(title || "rollphase").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
    });

    const printBtn = overlay.querySelector("#sharePrintBtn");
    if (!poster) {
      printBtn.hidden = true;
    } else {
      printBtn.addEventListener("click", async () => {
        await paint(overlay.querySelector("#shareQrCanvas"), withSrc(url, "poster"));
        document.body.classList.add("poster");
        window.print();
      });
    }

    overlay.querySelector("#shareCloseBtn").addEventListener("click", close);
  }

  return {
    open,
    close,
    paint,
    readArrival,
    mountArrival,
    appUrl,
    gymUrl,
    sessionUrl,
    calendarUrl,
  };
})();

window.addEventListener("afterprint", () => document.body.classList.remove("poster"));

if (typeof window !== "undefined") window.RollShare = RollShare;
