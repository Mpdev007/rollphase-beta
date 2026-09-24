/**
 * RollPhase update check + manual refresh.
 * - Auto-polls version.json after every Git deploy
 * - Always-available "Get latest" forces a clean reload (dev-friendly)
 */
const UpdateCheck = (() => {
  const STORAGE_BOOT = "rollphase.bootBuildId";
  const STORAGE_DISMISS = "rollphase.updateDismissed";
  const POLL_MS = 20 * 1000; // 20s while building — catch deploys fast
  let boot = null;
  let timer = null;
  let checking = false;
  let bannerShown = false;

  function versionUrl() {
    const base = document.querySelector("base")?.href || location.href;
    const u = new URL("version.json", base);
    u.searchParams.set("_", String(Date.now()));
    return u.toString();
  }

  async function fetchVersion() {
    const res = await fetch(versionUrl(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) throw new Error(`version ${res.status}`);
    return res.json();
  }

  function buildKey(v) {
    if (!v) return "";
    return String(v.buildId || v.version || "");
  }

  function setStatus(text) {
    const el = document.getElementById("appRefreshStatus");
    if (el) el.textContent = text || "";
    const chip = document.getElementById("btnRefreshApp");
    if (chip && text) chip.setAttribute("data-status", text);
  }

  function paintBuildLabel() {
    const v = window.ROLLPHASE_BUILD || boot;
    const label = document.getElementById("appBuildLabel");
    // Product-facing only — never show raw build hashes / deploy IDs
    if (label && v) {
      label.textContent = v.version ? `Version ${v.version}` : "You’re up to date";
    }
    const about = document.getElementById("appBuildLabelAbout");
    if (about && v) {
      about.textContent = v.version ? `Version ${v.version}` : "";
    }
  }

  /** Nuclear clear — caches + service workers — then hard navigate */
  async function hardReload(reason) {
    setStatus(reason || "Updating…");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (r) => {
            try {
              if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
            } catch {
              /* ignore */
            }
            try {
              await r.unregister();
            } catch {
              /* ignore */
            }
          })
        );
      }
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(STORAGE_DISMISS);
      localStorage.removeItem(STORAGE_BOOT);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem("rollphase.swReloaded");
    } catch {
      /* ignore */
    }

    // Fresh HTML document (bust query) — keeps path/hash for deep links
    const url = new URL(location.href);
    url.searchParams.set("_rp", Date.now().toString(36));
    location.replace(url.toString());
  }

  function hideBanner() {
    document.getElementById("updateBanner")?.remove();
    bannerShown = false;
  }

  function showBanner(remote) {
    if (bannerShown) {
      const msg = document.querySelector("#updateBanner .update-msg");
      if (msg && remote?.message) msg.textContent = remote.message;
      return;
    }
    bannerShown = true;
    document.getElementById("updateBanner")?.remove();

    const el = document.createElement("div");
    el.id = "updateBanner";
    el.setAttribute("role", "status");
    el.innerHTML = `
      <div class="update-banner-inner">
        <div class="update-banner-text">
          <strong>Update available</strong>
          <span class="update-msg">${escapeHtml(
            remote?.message || "A newer version of RollPhase is ready."
          )}</span>
        </div>
        <div class="update-banner-actions">
          <button type="button" class="update-btn-primary" id="updateRestart">Restart</button>
          <button type="button" class="update-btn-ghost" id="updateLater">Later</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector("#updateRestart")?.addEventListener("click", () => {
      el.querySelector("#updateRestart").textContent = "Updating…";
      el.querySelector("#updateRestart").disabled = true;
      hardReload("Installing update…");
    });
    el.querySelector("#updateLater")?.addEventListener("click", () => {
      try {
        localStorage.setItem(
          STORAGE_DISMISS,
          JSON.stringify({ buildId: buildKey(remote), at: Date.now() })
        );
      } catch {
        /* ignore */
      }
      hideBanner();
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wasDismissed(remoteKey) {
    try {
      const raw = localStorage.getItem(STORAGE_DISMISS);
      if (!raw) return false;
      const d = JSON.parse(raw);
      return d?.buildId === remoteKey;
    } catch {
      return false;
    }
  }

  function adoptRemote(remote) {
    boot = remote;
    window.ROLLPHASE_BUILD = remote;
    if (typeof BETA !== "undefined" && remote.version) {
      BETA.version = remote.version;
      BETA.buildId = remote.buildId;
      BETA.buildLabel = `Closed beta · ${remote.version}`;
    }
    paintBuildLabel();
    try {
      localStorage.setItem(STORAGE_BOOT, buildKey(remote));
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {{ silent?: boolean, forceBanner?: boolean }} [opts]
   * @returns {Promise<'update'|'current'|'error'>}
   */
  async function check(opts = {}) {
    if (checking) return "error";
    checking = true;
    try {
      // Nudge service worker to look for new sw.js
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) await reg.update();
        } catch {
          /* ignore */
        }
      }

      const remote = await fetchVersion();
      const remoteKey = buildKey(remote);
      if (!remoteKey) return "error";

      if (!boot) {
        let previous = null;
        try {
          previous = localStorage.getItem(STORAGE_BOOT);
        } catch {
          previous = null;
        }
        adoptRemote(remote);
        if (previous && previous !== remoteKey && !wasDismissed(remoteKey)) {
          showBanner(remote);
          return "update";
        }
        return "current";
      }

      const bootKey = buildKey(boot);
      if (remoteKey !== bootKey) {
        // Server is ahead of this running tab
        window.ROLLPHASE_BUILD = remote;
        paintBuildLabel();
        if (!wasDismissed(remoteKey) || opts.forceBanner) {
          showBanner(remote);
        }
        return "update";
      }
      return "current";
    } catch (e) {
      console.debug("update-check", e);
      return "error";
    } finally {
      checking = false;
    }
  }

  /**
   * Manual "Get latest" — always reloads clean if server differs OR user forces.
   * @param {{ force?: boolean }} [opts] force=true always reloads (dev “I need it now”)
   */
  async function getLatest(opts = {}) {
    const force = opts.force !== false; // default true for button
    const btn = document.getElementById("btnRefreshApp");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking…";
    }
    setStatus("Checking for latest…");

    try {
      const remote = await fetchVersion();
      const remoteKey = buildKey(remote);
      const bootKey = buildKey(boot || window.ROLLPHASE_BUILD);
      const previous = (() => {
        try {
          return localStorage.getItem(STORAGE_BOOT);
        } catch {
          return null;
        }
      })();

      if (force || (remoteKey && remoteKey !== bootKey) || (remoteKey && previous && previous !== remoteKey)) {
        setStatus("Downloading latest…");
        if (btn) btn.textContent = "Updating…";
        // Clear dismiss so user isn't stuck on "later"
        try {
          localStorage.removeItem(STORAGE_DISMISS);
        } catch {
          /* ignore */
        }
        await hardReload("Loading latest…");
        return;
      }

      // Already latest — still offer a soft reload option feels dead; do light reload for assets
      setStatus("Already on latest · refreshing…");
      if (btn) btn.textContent = "Refreshing…";
      await hardReload("Refreshing…");
    } catch (e) {
      console.warn("getLatest", e);
      setStatus("Refreshing…");
      if (btn) btn.textContent = "Refreshing…";
      await hardReload("Refreshing…");
    }
  }

  function injectRefreshChrome() {
    // Floating control always visible during beta/dev
    let chrome = document.getElementById("betaChrome");
    if (!chrome) {
      chrome = document.createElement("div");
      chrome.id = "betaChrome";
      document.body.appendChild(chrome);
    }
    if (!document.getElementById("btnRefreshApp")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btnRefreshApp";
      btn.title = "Refresh the app";
      btn.textContent = "Refresh app";
      btn.addEventListener("click", () => getLatest({ force: true }));
      chrome.insertBefore(btn, chrome.firstChild);
    }
    paintBuildLabel();
  }

  function injectProfileRefreshCard() {
    // Called when profile is rendered — app.js can call UpdateCheck.mountProfileCard()
    const host = document.getElementById("appUpdateCard");
    if (!host || host.dataset.ready === "1") return;
    host.dataset.ready = "1";
    host.innerHTML = `
      <div class="app-update-card">
        <div>
          <strong>App updates</strong>
          <p class="muted small" id="appBuildLabel">Checking…</p>
          <p class="muted small" id="appRefreshStatus"></p>
        </div>
        <button type="button" class="btn-primary" id="btnGetLatestProfile" style="width:100%;margin-top:10px;padding:12px">
          Refresh app
        </button>
        <p class="muted small" style="margin-top:8px">
          If something looks out of date, refresh to load the newest experience.
        </p>
      </div>
    `;
    host.querySelector("#btnGetLatestProfile")?.addEventListener("click", () =>
      getLatest({ force: true })
    );
    paintBuildLabel();
  }

  function start() {
    injectRefreshChrome();
    check();
    if (timer) clearInterval(timer);
    timer = setInterval(() => check(), POLL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    window.addEventListener("focus", () => check());
    window.addEventListener("online", () => check());
    // After deploy, first paint may be stale — recheck a few times
    setTimeout(() => check(), 5000);
    setTimeout(() => check(), 15000);

    if ("serviceWorker" in navigator) {
      const swUrl = new URL("sw.js", location.href);
      navigator.serviceWorker
        .register(swUrl.href)
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                check({ forceBanner: true });
                showBanner({
                  message: "A newer version is ready.",
                  buildId: buildKey(window.ROLLPHASE_BUILD) + "-sw",
                });
              }
            });
          });
          try {
            reg.update();
          } catch {
            /* ignore */
          }
        })
        .catch((e) => console.debug("sw register", e));

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("rollphase.swReloaded") === "1") return;
        sessionStorage.setItem("rollphase.swReloaded", "1");
        location.reload();
      });
    }
  }

  return {
    start,
    check,
    hardReload,
    showBanner,
    getLatest,
    mountProfileCard: injectProfileRefreshCard,
    paintBuildLabel,
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => UpdateCheck.start());
} else {
  UpdateCheck.start();
}
