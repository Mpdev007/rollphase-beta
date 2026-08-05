/* RollPhase v3 — multi-sport home (never forced), skins, feed */

const state = {
  /** null = explore all sports (no forced focus) */
  sport: null,
  tab: "home",
  gymFilter: "all",
  gymView: "list",
  rankFilter: "all",
  gearMode: "shops",
  feedMode: "events",
  agePool: "adult",
  openToTrain: true,
  checkedInGym: null,
  sportQuery: "",
  /** demo: "guest" = no sports on profile; "athlete" = multi-sport profile */
  mode: "athlete",
  profile: safeClone(typeof PROFILE_DEFAULT !== "undefined" ? PROFILE_DEFAULT : emptyProfile()),
  _rendering: false,
};

function emptyProfile() {
  return {
    displayName: "Guest",
    area: "",
    ageBand: "Adult",
    sports: [],
    represent: {
      enabled: false,
      label: "",
      mode: "custom",
      logoDataUrl: null,
      crop: { zoom: 1, x: 0.5, y: 0.5 },
      colors: { primary: "#121212", secondary: "#f4f4f4", accent: "#8a8a8a" },
      pattern: "rings",
      nix: { status: "idle", notes: "", source: "", samples: [] },
    },
    social: { instagram: "", facebook: "", x: "", tiktok: "", strava: "", youtube: "" },
    following: [],
    webhooks: [],
    eventNotifies: {},
  };
}

function safeClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return emptyProfile();
  }
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function sportMeta(id) {
  if (!id) return null;
  return (typeof SPORTS !== "undefined" ? SPORTS : []).find((s) => s.id === id) || null;
}

function profileSports() {
  return state.profile?.sports || [];
}

function hasProfileSports() {
  return profileSports().length > 0;
}

/** Optional focus: only filters when user picked a sport today */
function focusId() {
  return state.sport || null;
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function empty(title, sub) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(sub)}</div>`;
}

function kindLabel(kind) {
  const map = {
    tournament: "Tournament",
    open_mat: "Open play",
    race: "Race",
    class_series: "Classes",
    league: "League",
    fight: "Fight card",
    live: "Live",
  };
  return map[kind] || kind;
}

/* ---------- Skin ---------- */
const SWATCH = {
  bjj: "linear-gradient(135deg,#0e1520,#5b9fff)",
  mma: "linear-gradient(135deg,#0a0a0a,#e11d2e)",
  boxing: "linear-gradient(135deg,#16100c,#c9a227)",
  wrestling: "linear-gradient(135deg,#0e1524,#f0c14b)",
  muaythai: "linear-gradient(135deg,#1a0c0c,#e8b923)",
  kickboxing: "linear-gradient(135deg,#140c10,#ff2d55)",
  judo: "linear-gradient(135deg,#10141e,#e8eef8)",
  weightlifting: "linear-gradient(135deg,#141416,#c8ccd4)",
  crossfit: "linear-gradient(135deg,#14100c,#ff5a1f)",
  hyrox: "linear-gradient(135deg,#14100c,#ff6a00)",
  pickleball: "linear-gradient(135deg,#0c1c12,#c8f542)",
  tennis: "linear-gradient(135deg,#122018,#ccff00)",
  basketball: "linear-gradient(135deg,#16120e,#f97316)",
  soccer: "linear-gradient(135deg,#0c1a10,#22c55e)",
  volleyball: "linear-gradient(135deg,#121c28,#38bdf8)",
  pilates: "linear-gradient(135deg,#1a1418,#e8a0b8)",
  yoga: "linear-gradient(135deg,#161310,#8fbc8f)",
  running: "linear-gradient(135deg,#0f141c,#fc4c02)",
  cycling: "linear-gradient(135deg,#101114,#d4ff00)",
  climbing: "linear-gradient(135deg,#151518,#ff2d95)",
  swimming: "linear-gradient(135deg,#082030,#2ee6ff)",
};

function ensureRepresent() {
  const d = {
    enabled: false,
    label: "",
    mode: "custom",
    logoDataUrl: null,
    crop: { zoom: 1, x: 0.5, y: 0.5 },
    colors: { primary: "#121212", secondary: "#f4f4f4", accent: "#8a8a8a" },
    pattern: "rings",
    nix: { status: "idle", notes: "", source: "", samples: [] },
  };
  if (!state.profile.represent) state.profile.represent = d;
  const r = state.profile.represent;
  // migrate old vibe-only shape
  if (r.vibe && !r.colors) {
    const map = {
      mono: { primary: "#0a0a0a", secondary: "#f2f2f2", accent: "#c8c8c8", pattern: "rings" },
      classic: { primary: "#0e1520", secondary: "#e8eef8", accent: "#5b9fff", pattern: "mesh" },
      gold: { primary: "#1a1408", secondary: "#f5edd6", accent: "#d4af37", pattern: "stripe" },
      crimson: { primary: "#1a0a0e", secondary: "#fce8ec", accent: "#b42832", pattern: "stripe" },
      none: d.colors,
    };
    const m = map[r.vibe] || d.colors;
    r.colors = { primary: m.primary, secondary: m.secondary, accent: m.accent };
    r.pattern = m.pattern || "rings";
    r.enabled = r.vibe !== "none" && !!r.enabled;
    delete r.vibe;
  }
  r.colors = r.colors || { ...d.colors };
  r.crop = r.crop || { zoom: 1, x: 0.5, y: 0.5 };
  r.nix = r.nix || { status: "idle", notes: "", source: "", samples: [] };
  r.pattern = r.pattern || "rings";
  return r;
}

function applyRepresentStrip() {
  try {
    const strip = $("#representStrip");
    const root = $("#phoneRoot");
    if (!strip || !root) return;
    const rep = ensureRepresent();
    const on = !!(rep.enabled && (rep.label || rep.logoDataUrl || rep.mode === "custom"));
    if (!on) {
      strip.classList.remove("visible");
      strip.setAttribute("data-rep", "none");
      root.removeAttribute("data-rep-custom");
      root.style.removeProperty("--rep-primary");
      root.style.removeProperty("--rep-secondary");
      root.style.removeProperty("--rep-accent");
      return;
    }
    const c = rep.colors;
    strip.classList.add("visible");
    strip.setAttribute("data-rep", "custom");
    strip.setAttribute("data-pattern", rep.pattern || "rings");
    root.setAttribute("data-rep-custom", "1");
    root.style.setProperty("--rep-primary", c.primary);
    root.style.setProperty("--rep-secondary", c.secondary);
    root.style.setProperty("--rep-accent", c.accent);

    strip.style.background = `linear-gradient(90deg, ${c.primary}ee, ${c.primary}99 40%, transparent)`;
    strip.style.borderBottomColor = c.accent;

    const swatch = $("#repSwatch");
    if (swatch) {
      if (rep.logoDataUrl) {
        const z = rep.crop?.zoom || 1;
        const x = (rep.crop?.x ?? 0.5) * 100;
        const y = (rep.crop?.y ?? 0.5) * 100;
        swatch.style.backgroundImage = `url(${rep.logoDataUrl})`;
        swatch.style.backgroundSize = `${z * 100}%`;
        swatch.style.backgroundPosition = `${x}% ${y}%`;
        swatch.style.backgroundColor = c.secondary;
      } else {
        swatch.style.backgroundImage = "";
        swatch.style.background = `linear-gradient(135deg, ${c.primary}, ${c.accent})`;
      }
    }
    if ($("#repLabel")) $("#repLabel").textContent = rep.label?.trim() || "Representing";
    if ($("#repSub")) {
      const src = rep.logoDataUrl ? "Custom crest" : "Custom colors";
      $("#repSub").textContent = `${src} · your profile`;
    }
  } catch (e) {
    console.warn("represent strip", e);
  }
}

/** Neutral shell when no focus sport */
function applyExploreShell() {
  const root = $("#phoneRoot");
  if (!root) return;
  root.setAttribute("data-sport", "explore");
  const chip = $("#sportChip");
  chip?.classList.add("explore-mode");
  if ($("#sportLabel")) $("#sportLabel").textContent = "Explore";
  if ($("#headerVibe")) $("#headerVibe").textContent = "Any sport · any day";
  if ($("#heroKicker")) $("#heroKicker").textContent = "Open explore";
  if ($("#heroTitle")) $("#heroTitle").textContent = "Train what you want today";
  if ($("#heroBlurb")) {
    $("#heroBlurb").textContent =
      "No lock-in. Focus a sport for today, or stay in Explore. Add favorites on your profile.";
  }
  if ($("#heroIcon")) $("#heroIcon").src = "assets/logo.jpg";
  if ($("#gymsModuleTitle")) $("#gymsModuleTitle").textContent = "Venues near you";
  if ($("#partnersModuleTitle")) $("#partnersModuleTitle").textContent = "People open to train";
  if ($("#eventsModuleTitle")) $("#eventsModuleTitle").textContent = "Upcoming nearby";
  if ($("#gymsTitle")) $("#gymsTitle").textContent = "Venues";
  if ($("#partnersTitle")) $("#partnersTitle").textContent = "Partners";
  if ($("#gearTitle")) $("#gearTitle").textContent = "Gear";
  if ($("#feedTitle")) $("#feedTitle").textContent = "Feed";
  if ($("#homeTitle")) $("#homeTitle").textContent = "Near you";
  applyRepresentStrip();
}

function applySkin(sportId, { flash = true } = {}) {
  try {
    state.sport = sportId || null;
    const root = $("#phoneRoot");
    if (!root) return;

    if (!sportId) {
      applyExploreShell();
      state.gymFilter = "all";
      state.rankFilter = "all";
      renderGymFilters();
      renderPartnerFilters();
      $$(".skin-swatch").forEach((sw) => {
        sw.style.outline = "none";
      });
      return;
    }

    const s = sportMeta(sportId);
    if (!s) {
      applyExploreShell();
      return;
    }

    root.setAttribute("data-sport", sportId);
    $("#sportChip")?.classList.remove("explore-mode");
    if ($("#sportChipIcon")) {
      $("#sportChipIcon").src = s.icon;
      $("#sportChipIcon").style.display = "";
    }
    if ($("#sportLabel")) $("#sportLabel").textContent = s.short;
    if ($("#headerVibe")) $("#headerVibe").textContent = s.vibe;
    if ($("#heroKicker")) $("#heroKicker").textContent = "Today’s focus · optional";
    if ($("#heroTitle")) $("#heroTitle").textContent = s.name;
    if ($("#heroBlurb")) $("#heroBlurb").textContent = s.blurb;
    if ($("#heroIcon")) $("#heroIcon").src = s.icon;
    if ($("#gymsModuleTitle")) $("#gymsModuleTitle").textContent = s.homeGymTitle;
    if ($("#partnersModuleTitle")) $("#partnersModuleTitle").textContent = s.homePartnerTitle;
    if ($("#eventsModuleTitle")) $("#eventsModuleTitle").textContent = s.homeEventTitle;
    if ($("#gymsTitle")) $("#gymsTitle").textContent = s.gymsTitle;
    if ($("#partnersTitle")) $("#partnersTitle").textContent = s.partnersTitle;
    if ($("#gearTitle")) $("#gearTitle").textContent = s.gearTitle;
    if ($("#feedTitle")) $("#feedTitle").textContent = s.feedTitle || "Feed";
    if ($("#homeTitle")) $("#homeTitle").textContent = `${s.short} near you`;

    applyRepresentStrip();
    state.gymFilter = "all";
    state.rankFilter = "all";
    renderGymFilters();
    renderPartnerFilters();

    if (flash) {
      $(".skin-flash")?.remove();
      const el = document.createElement("div");
      el.className = "skin-flash";
      root.appendChild(el);
      setTimeout(() => el.remove(), 520);
    }

    $$(".skin-swatch").forEach((sw) => {
      sw.style.outline = sw.dataset.sport === sportId ? "2px solid #fff" : "none";
    });
  } catch (e) {
    console.error("applySkin", e);
  }
}

function renderStageSwatches() {
  const host = $("#skinSwatches");
  if (!host || host.dataset.bound === "1") return;
  host.dataset.bound = "1";
  host.innerHTML =
    `<button type="button" class="skin-swatch" data-sport="" style="background:linear-gradient(135deg,#222,#666)" title="Explore all"><span>ALL</span></button>` +
    SPORTS.map(
      (s) =>
        `<button type="button" class="skin-swatch" data-sport="${s.id}" style="background:${SWATCH[s.id] || "#333"}" title="${s.name}"><span>${escapeHtml(s.short.slice(0, 4))}</span></button>`
    ).join("");
  host.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sport]");
    if (!btn) return;
    setSport(btn.dataset.sport || null);
  });
}

/** Set optional focus for today. null = explore all. Never permanent lock. */
function setSport(id) {
  applySkin(id || null);
  state.checkedInGym = null;
  safeRenderAll();
}

function addSportToProfile(sportId, level = "—") {
  if (!sportId || !sportMeta(sportId)) return;
  const list = profileSports();
  if (list.some((x) => x.id === sportId)) return;
  state.profile.sports = [...list, { id: sportId, level }];
  safeRenderAll();
}

function removeSportFromProfile(sportId) {
  state.profile.sports = profileSports().filter((x) => x.id !== sportId);
  if (state.sport === sportId) setSport(null);
  else safeRenderAll();
}

function setDemoMode(mode) {
  state.mode = mode;
  if (mode === "guest") {
    state.profile = emptyProfile();
    state.sport = null;
  } else {
    state.profile = safeClone(PROFILE_DEFAULT);
    // soft default: first profile sport as optional focus, not forced forever
    state.sport = state.profile.sports[0]?.id || null;
  }
  applySkin(state.sport, { flash: false });
  safeRenderAll();
}

function safeRenderAll() {
  if (state._rendering) return;
  state._rendering = true;
  try {
    renderAll();
  } catch (e) {
    console.error("renderAll", e);
  } finally {
    state._rendering = false;
  }
}

/* ---------- Filters ---------- */
function renderGymFilters() {
  const el = $("#gymFilters");
  if (!el) return;
  const s = sportMeta(focusId());
  const filters = s?.gymFilters || [
    { id: "all", label: "All" },
    { id: "open", label: "Open now" },
    { id: "near", label: "≤ 5 mi" },
  ];
  el.innerHTML = filters
    .map(
      (f) =>
        `<button type="button" class="pill ${state.gymFilter === f.id ? "active" : ""}" data-filter="${f.id}">${escapeHtml(f.label)}</button>`
    )
    .join("");
}

function renderPartnerFilters() {
  const el = $("#partnerFilters");
  if (!el) return;
  const s = sportMeta(focusId());
  const filters = s?.partnerFilters || [
    { id: "all", label: "All levels" },
    { id: "near", label: "≤ 3 mi" },
  ];
  el.innerHTML = filters
    .map(
      (f) =>
        `<button type="button" class="pill ${state.rankFilter === f.id ? "active" : ""}" data-rank="${f.id}">${escapeHtml(f.label)}</button>`
    )
    .join("");
}

function gymsForSport(sport = focusId()) {
  if (!sport) {
    // Explore: nearest venues across sports (dedupe by id)
    return [...GYMS].sort((a, b) => a.mi - b.mi);
  }
  return GYMS.filter((g) => g.sports.includes(sport)).sort((a, b) => a.mi - b.mi);
}

function filterGyms(list) {
  const f = state.gymFilter;
  const sport = focusId();
  if (f === "all" || f === "near") {
    return f === "near" ? list.filter((g) => g.mi <= 5) : list;
  }
  if (f === "open") return list.filter((g) => g.open);
  if (f === "classes") {
    if (!sport) return list.filter((g) => Object.values(g.next || {}).some((n) => /class|clinic|WOD|pads|reformer|fundamentals/i.test(n || "")));
    return list.filter((g) => /class|clinic|WOD|pads|reformer|fundamentals/i.test(g.next[sport] || ""));
  }
  const tagHit = (re) => {
    if (!sport) {
      return list.filter((g) => Object.values(g.tags || {}).some((arr) => (arr || []).some((t) => re.test(t))));
    }
    return list.filter((g) => (g.tags[sport] || []).some((t) => re.test(t)));
  };
  if (f === "openmat") return tagHit(/open mat|open play/i);
  if (f === "gi") return tagHit(/gi|no-gi/i);

  if (f === "cage")
    return list.filter(
      (g) => g.amenities.includes("cage") || (g.tags[sport] || []).some((t) => /cage/i.test(t))
    );
  if (f === "spar") return tagHit(/spar/i);
  if (f === "ring") return list.filter((g) => g.amenities.includes("ring"));
  if (f === "bags") return list.filter((g) => g.amenities.includes("bags"));
  if (f === "platform") return list.filter((g) => g.amenities.includes("platforms"));
  if (f === "24h") return list.filter((g) => /24/i.test(g.hours));
  if (f === "wod") return list.filter((g) => /WOD/i.test(g.next[sport] || ""));
  if (f === "rig") return list.filter((g) => g.amenities.includes("rig"));
  if (f === "pads") return tagHit(/pad/i);
  if (f === "fightteam") return tagHit(/fight team/i);
  if (f === "sled") return list.filter((g) => g.amenities.includes("sled") || g.amenities.includes("stations"));
  if (f === "indoor")
    return list.filter(
      (g) => g.amenities.includes("indoor") || (g.tags[sport] || []).some((t) => /indoor/i.test(t))
    );
  if (f === "tournament") return tagHit(/tournament|hosts events|ladder/i);
  if (f === "reformer")
    return list.filter(
      (g) => g.amenities.includes("reformer") || (g.tags[sport] || []).some((t) => /reformer/i.test(t))
    );
  return list;
}

function partnersForSport() {
  const focus = focusId();
  return PARTNERS.filter((p) => {
    if (focus && p.sport !== focus) return false;
    if (state.agePool === "adult" && p.age !== "adult") return false;
    if (state.agePool === "teen" && p.age !== "teen") return false;
    if (state.rankFilter === "near" && p.mi > 3) return false;
    if (state.rankFilter === "match" && focus === "bjj" && !/white|yellow|blue|orange|green/i.test(p.level)) return false;
    if (state.rankFilter === "match" && focus === "pickleball" && !/3\.|4\./.test(p.level)) return false;
    if (state.rankFilter === "rx" && !/rx/i.test(p.level)) return false;
    return true;
  }).sort((a, b) => a.mi - b.mi);
}

function eventsForSport(opts = {}) {
  const focus = focusId();
  let list = focus ? EVENTS.filter((e) => e.sport === focus) : [...EVENTS];
  if (opts.liveOnly) list = list.filter((e) => e.live);
  if (opts.upcomingOnly) list = list.filter((e) => !e.live);
  return list;
}

function socialForSport() {
  const focus = focusId();
  return SOCIAL_POSTS.filter((p) => {
    if (focus && p.sport !== focus) return false;
    return p.followed || state.feedMode === "social";
  });
}

/* ---------- Cards ---------- */
function gymCardHTML(g, sport) {
  const focus = sport || focusId();
  const primarySport = focus && g.sports.includes(focus) ? focus : g.sports[0];
  const tags = (g.tags[primarySport] || []).slice(0, 3);
  const next = g.next[primarySport] || "";
  const here = (g.here[primarySport] || []).length;
  const sportLabels = g.sports
    .slice(0, 3)
    .map((id) => sportMeta(id)?.short || id)
    .join(" · ");
  const agg =
    typeof ReviewSystem !== "undefined"
      ? ReviewSystem.aggregateRating(g.id, focus || null)
      : null;
  const ratingHtml = agg
    ? `<div class="rating-pill"><span class="stars">${ReviewSystem.starsHtml(agg.overall)}</span> ${agg.overall} · ${agg.count}</div>`
    : "";
  return `
    <article class="card" data-gym="${g.id}">
      <div class="card-top">
        <div>
          <div class="card-title">${escapeHtml(g.name)}</div>
          <div class="card-meta">${next ? escapeHtml(next) : escapeHtml(g.hours)}</div>
          ${ratingHtml}
        </div>
        <div class="dist">${g.mi} mi</div>
      </div>
      <div class="card-tags">
        ${g.open ? '<span class="tag-pill open">Open now</span>' : '<span class="tag-pill">Closed</span>'}
        ${!focus ? `<span class="tag-pill accent">${escapeHtml(sportLabels)}</span>` : ""}
        ${tags.map((t) => `<span class="tag-pill accent">${escapeHtml(t)}</span>`).join("")}
        ${here ? `<span class="tag-pill live">${here} here</span>` : ""}
        ${(agg?.topTags || []).slice(0, 2).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
      </div>
    </article>`;
}

function eventCardHTML(e) {
  const on = !!state.profile.eventNotifies[e.id];
  return `
    <article class="feed-card ${e.live ? "live-card" : ""}" data-event="${e.id}">
      <div class="feed-top">
        <div>
          <div class="feed-kind">${e.live ? '<span class="live-dot"></span>' : ""}${escapeHtml(kindLabel(e.kind))}</div>
          <div class="card-title" style="margin-top:4px">${escapeHtml(e.title)}</div>
          <div class="card-meta">${escapeHtml(e.when)} · ${escapeHtml(e.where)} · ${e.mi} mi</div>
          ${e.reg ? `<div class="card-meta" style="color:var(--accent)">${escapeHtml(e.reg)}</div>` : ""}
        </div>
      </div>
      <div class="notify-row">
        <span class="small muted">${e.live ? "Live now" : "Upcoming"}</span>
        <button type="button" class="notify-btn ${on ? "on" : ""}" data-notify="${e.id}">${on ? "Notify on" : "Notify me"}</button>
      </div>
    </article>`;
}

function socialCardHTML(p) {
  return `
    <article class="feed-card social-post">
      <div class="source">
        <div class="source-av">${initials(p.author)}</div>
        <div>
          <div class="card-title" style="font-size:0.88rem">${escapeHtml(p.author)}</div>
          <div class="platform">${escapeHtml(p.platform)} · ${escapeHtml(p.handle)} · ${escapeHtml(p.when)}</div>
        </div>
      </div>
      <div class="card-meta" style="color:var(--text);font-size:0.85rem;line-height:1.4">${escapeHtml(p.body)}</div>
    </article>`;
}

/* ---------- Screens ---------- */
function renderHomeSportRail() {
  const rail = $("#homeSportRail");
  const title = $("#homeSportsTitle");
  const hint = $("#homeSportsHint");
  if (!rail) return;

  const mine = profileSports();
  const focus = focusId();

  if (hasProfileSports()) {
    if (title) title.textContent = "Your sports";
    if (hint) {
      hint.textContent = focus
        ? `Focus: ${sportMeta(focus)?.short || focus} · tap another anytime · Explore clears focus`
        : "Tap one for today’s focus — or Browse all. Never locked.";
    }
    rail.innerHTML =
      mine
        .map((ps) => {
          const s = sportMeta(ps.id);
          if (!s) return "";
          return `
        <button type="button" class="sport-rail-card ${focus === s.id ? "active" : ""}" data-focus="${s.id}">
          <img src="${s.icon}" alt="" />
          <span class="nm">${escapeHtml(s.short)}</span>
          <span class="lv">${escapeHtml(ps.level || "—")}</span>
        </button>`;
        })
        .join("") +
      `<button type="button" class="sport-rail-card add-card" id="addSportCard"><span class="plus">+</span>Add sport</button>`;
  } else {
    if (title) title.textContent = "Discover sports";
    if (hint) {
      hint.textContent =
        "No profile sports yet — browse freely. Add favorites in Profile when you want.";
    }
    // show popular / high-ROI first without forcing
    const discover = ["bjj", "pickleball", "yoga", "boxing", "hyrox", "pilates", "running", "climbing"]
      .map((id) => sportMeta(id))
      .filter(Boolean);
    rail.innerHTML =
      discover
        .map(
          (s) => `
        <button type="button" class="sport-rail-card ${focus === s.id ? "active" : ""}" data-focus="${s.id}">
          <img src="${s.icon}" alt="" />
          <span class="nm">${escapeHtml(s.short)}</span>
          <span class="lv">Try today</span>
        </button>`
        )
        .join("") +
      `<button type="button" class="sport-rail-card add-card" id="addSportCard"><span class="plus">+</span>All sports</button>`;
  }
}

function renderHomeWelcome() {
  const el = $("#homeWelcome");
  if (!el) return;
  const name = state.profile.displayName || "there";
  if (hasProfileSports()) {
    const list = profileSports()
      .map((ps) => sportMeta(ps.id)?.short || ps.id)
      .join(" · ");
    el.innerHTML = `
      <div class="demo-banner" id="demoBanner">
        <button type="button" class="${state.mode === "athlete" ? "active" : ""}" data-demo="athlete">My sports profile</button>
        <button type="button" class="${state.mode === "guest" ? "active" : ""}" data-demo="guest">Just exploring</button>
      </div>
      <h2>Hey ${escapeHtml(name)}</h2>
      <p>Your sports: ${escapeHtml(list)}. Focus one for today or stay open — switch anytime.</p>`;
  } else {
    el.innerHTML = `
      <div class="demo-banner" id="demoBanner">
        <button type="button" class="${state.mode === "athlete" ? "active" : ""}" data-demo="athlete">My sports profile</button>
        <button type="button" class="${state.mode === "guest" ? "active" : ""}" data-demo="guest">Just exploring</button>
      </div>
      <h2>Welcome</h2>
      <p>Explore any sport. Add favorites when you’re ready — nothing is required to look around.</p>`;
  }
}

function renderHome() {
  const sport = focusId();
  const s = sportMeta(sport);

  renderHomeWelcome();
  renderHomeSportRail();

  const gyms = filterGyms(gymsForSport(sport)).slice(0, 4);
  const partners = partnersForSport().slice(0, 6);
  const events = eventsForSport().slice(0, 4);
  const live = eventsForSport({ liveOnly: true });

  const roi = $("#roiNote");
  if (roi) {
    if (s) {
      roi.innerHTML = `<strong style="color:var(--text)">${escapeHtml(s.short)} near you</strong><br/>${s.roiSurfaces.map(escapeHtml).join(" · ")}`;
    } else {
      roi.innerHTML = `<strong style="color:var(--text)">Exploring all sports</strong><br/>Mixed venues and events nearby. Tap a sport to focus — tap again to clear.`;
    }
  }

  const homeGyms = $("#homeGyms");
  if (homeGyms) {
    const gMod = homeGyms.closest(".module");
    if (!gyms.length) gMod?.classList.add("collapsed");
    else {
      gMod?.classList.remove("collapsed");
      homeGyms.innerHTML = gyms.map((g) => gymCardHTML(g, sport)).join("");
    }
  }

  const homePartners = $("#homePartners");
  if (homePartners) {
    const pMod = homePartners.closest(".module");
    if (!partners.length) pMod?.classList.add("collapsed");
    else {
      pMod?.classList.remove("collapsed");
      homePartners.innerHTML = partners
        .map((p) => {
          const sm = sportMeta(p.sport);
          return `
      <div class="partner-mini">
        <div class="av">${initials(p.name)}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="lvl">${escapeHtml(sm?.short || "")} · ${escapeHtml(p.level)} · ${p.mi} mi</div>
        <div class="card-tags"><span class="tag-pill accent">${escapeHtml(p.intent)}</span></div>
      </div>`;
        })
        .join("");
    }
  }

  const homeEvents = $("#homeEvents");
  if (homeEvents) {
    const eMod = homeEvents.closest(".module");
    if (!events.length) eMod?.classList.add("collapsed");
    else {
      eMod?.classList.remove("collapsed");
      homeEvents.innerHTML =
        (live.length
          ? `<div class="feed-card live-card" style="margin-bottom:10px"><div class="feed-kind"><span class="live-dot"></span>Live now</div><div class="card-title" style="margin-top:4px">${escapeHtml(live[0].title)}</div><div class="card-meta">${escapeHtml(live[0].where)} · ${escapeHtml(sportMeta(live[0].sport)?.short || "")}</div></div>`
          : "") +
        events
          .filter((e) => !e.live)
          .slice(0, 2)
          .map(eventCardHTML)
          .join("");
    }
  }

  renderCheckinBar();
}

function renderCheckinBar() {
  const bar = $("#checkinBar");
  if (!bar) return;
  const s = sportMeta(focusId());
  if (state.checkedInGym) {
    const g = GYMS.find((x) => x.id === state.checkedInGym);
    bar.classList.add("live");
    bar.innerHTML = `
      <div>
        <div class="checkin-title">● Live at ${escapeHtml(g?.name || "venue")}</div>
        <div class="checkin-sub">${escapeHtml(s?.short || "Training")} · check-in live</div>
      </div>
      <button type="button" class="btn-ghost" id="checkoutBtn">Check out</button>`;
    $("#checkoutBtn")?.addEventListener("click", () => {
      const gymId = state.checkedInGym;
      const sport = focusId();
      if (typeof ReviewSystem !== "undefined" && gymId) {
        ReviewSystem.recordVisit(gymId, sport);
      }
      state.checkedInGym = null;
      safeRenderAll();
      // High-ROI: prompt rate after real visit
      if (gymId && confirm("Rate this venue for other athletes? (visit-verified)")) {
        openGymDetail(gymId);
        setTimeout(() => {
          document.querySelector('.detail-tab[data-panel="reviews"]')?.click();
          document.getElementById("writeReviewBtn")?.click();
        }, 80);
      }
    });
  } else {
    bar.classList.remove("live");
    bar.innerHTML = `
      <div>
        <div class="checkin-title">Not checked in</div>
        <div class="checkin-sub">Check in → train → rate (trusted reviews)</div>
      </div>
      <button type="button" class="btn-ghost" id="quickCheckin">Browse venues</button>`;
    $("#quickCheckin")?.addEventListener("click", () => switchTab("gyms"));
  }
}

function renderGyms() {
  let list = filterGyms(gymsForSport());
  const listEl = $("#gymList");
  const mapEl = $("#gymMap");
  if (!listEl || !mapEl) return;
  if (state.gymView === "map") {
    listEl.classList.add("hidden");
    mapEl.classList.remove("hidden");
    $("#mapPins").innerHTML = list
      .map((g, i) => {
        const left = 18 + ((i * 37) % 70);
        const top = 20 + ((i * 53) % 60);
        return `<div class="map-pin" style="left:${left}%;top:${top}%" data-gym="${g.id}" title="${escapeHtml(g.name)}"></div>`;
      })
      .join("");
  } else {
    mapEl.classList.add("hidden");
    listEl.classList.remove("hidden");
    listEl.innerHTML = list.length
      ? list.map((g) => gymCardHTML(g, focusId())).join("")
      : empty("No venues match", "Clear filters or explore all sports.");
  }
}

function mapsSearchUrl(gymName) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gymName)}`;
}

function renderReviewsPanel(gymId, sport) {
  if (typeof ReviewSystem === "undefined") {
    return empty("Ratings loading…", "Refresh if this persists.");
  }
  const RS = ReviewSystem;
  const agg = RS.aggregateRating(gymId, sport);
  const list = RS.reviewsForGym(gymId, sport);
  const verified = sport ? RS.hasVisit(gymId, sport) : RS.hasVisit(gymId);
  const tags = RS.SPORT_REVIEW_TAGS[sport] || ["Traveler-friendly", "Great coaching", "Clean facility", "Worth drop-in"];

  const summary = agg
    ? `
    <div class="rating-summary">
      <div>
        <div class="rating-big">${agg.overall}</div>
        <div class="stars" style="color:#f5c542">${RS.starsHtml(agg.overall)}</div>
      </div>
      <div class="rating-meta">
        <strong style="color:var(--text)">${agg.count} RollPhase review${agg.count === 1 ? "" : "s"}</strong><br/>
        ${agg.verifiedCount} visit-verified<br/>
        ${sport ? `Scoped to ${escapeHtml(sportMeta(sport)?.short || sport)}` : "All sports at this venue"}
      </div>
    </div>
    ${RS.REVIEW_DIMENSIONS.map((d) => {
      const v = agg.dimensions[d.id];
      if (v == null) return "";
      return `<div class="dim-row"><span>${escapeHtml(d.label)}</span><span class="stars">${RS.starsHtml(v)} ${v.toFixed(1)}</span></div>`;
    }).join("")}
    <div class="card-tags" style="margin:12px 0">${(agg.topTags || []).map((t) => `<span class="tag-pill accent">${escapeHtml(t)}</span>`).join("")}</div>
  `
    : empty("No RollPhase reviews yet", "Be the first after you train here.");

  const reviewsHtml = list.length
    ? list
        .map(
          (r) => `
      <article class="review-card">
        <div class="who">${escapeHtml(r.author)}${r.verifiedVisit ? '<span class="verified-badge">Visit verified</span>' : ""}</div>
        <div class="when">${escapeHtml(sportMeta(r.sport)?.short || r.sport)} · ${RS.starsHtml(r.scores?.overall)} · ${new Date(r.at).toLocaleDateString()}</div>
        <div class="card-tags" style="margin-top:6px">${(r.tags || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>
        ${r.text ? `<div class="body">${escapeHtml(r.text)}</div>` : ""}
      </article>`
        )
        .join("")
    : "";

  return `
    ${summary}
    <button type="button" class="btn-primary" id="writeReviewBtn">Rate this venue</button>
    <p class="muted small" style="margin:8px 0 12px">${
      verified
        ? "You’ve checked in here — your review can be visit-verified."
        : "Tip: check in when you train so reviews carry a visit badge (higher trust)."
    }</p>
    <div id="rateFormHost" class="hidden rate-form"></div>
    <h4 class="rep-section-title">From athletes on RollPhase</h4>
    ${reviewsHtml}
    <h4 class="rep-section-title">Outside the app</h4>
    <p class="outside-note">We keep Google/Yelp noise out of the main score. Use Maps for directions &amp; public hours — use RollPhase for sport-specific athlete signal.</p>
    <div class="ext-links">
      <a href="${mapsSearchUrl(GYMS.find((x) => x.id === gymId)?.name || "")}" target="_blank" rel="noopener">Open in Google Maps</a>
      <button type="button" class="linkish" id="copyVenueShare">Copy share link for non-app friends</button>
    </div>
  `;
}

function bindRateForm(gymId, sport) {
  const host = $("#rateFormHost");
  const btn = $("#writeReviewBtn");
  if (!host || !btn || typeof ReviewSystem === "undefined") return;
  const RS = ReviewSystem;
  const tags = RS.SPORT_REVIEW_TAGS[sport] || ["Traveler-friendly", "Great coaching", "Clean facility"];

  btn.addEventListener("click", () => {
    host.classList.remove("hidden");
    host.innerHTML = `
      <p class="muted small">Rate what mattered. Tags keep it scannable for other athletes.</p>
      ${RS.REVIEW_DIMENSIONS.map(
        (d) => `
        <div class="dim-row" style="border:none;flex-direction:column;align-items:flex-start">
          <span>${escapeHtml(d.label)}</span>
          <div class="star-pick" data-dim="${d.id}">
            ${[1, 2, 3, 4, 5]
              .map((n) => `<button type="button" class="star-btn ${n <= 5 && d.id === "overall" && n <= 5 ? "" : ""}" data-n="${n}">★</button>`)
              .join("")}
          </div>
        </div>`
      ).join("")}
      <p class="muted small">Quick tags</p>
      <div id="rateTags">${tags.map((t) => `<button type="button" class="tag-toggle" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}</div>
      <p class="muted small" style="margin-top:10px">What stood out? (optional, keep short)</p>
      <textarea id="rateText" maxlength="280" placeholder="e.g. Open mat is welcoming, mats are clean…"></textarea>
      <button type="button" class="btn-primary" id="rateSubmit" style="margin-top:10px">Post to RollPhase</button>
    `;

    const scores = { overall: 5, coaching: 4, facility: 4, community: 4, value: 4 };
    host.querySelectorAll(".star-pick").forEach((row) => {
      const dim = row.dataset.dim;
      const paint = () => {
        row.querySelectorAll(".star-btn").forEach((b) => {
          b.classList.toggle("on", +b.dataset.n <= scores[dim]);
        });
      };
      paint();
      row.addEventListener("click", (e) => {
        const b = e.target.closest(".star-btn");
        if (!b) return;
        scores[dim] = +b.dataset.n;
        paint();
      });
    });

    const selected = new Set();
    host.querySelectorAll(".tag-toggle").forEach((t) => {
      t.addEventListener("click", () => {
        const tag = t.dataset.tag;
        if (selected.has(tag)) {
          selected.delete(tag);
          t.classList.remove("on");
        } else {
          selected.add(tag);
          t.classList.add("on");
        }
      });
    });

    $("#rateSubmit")?.addEventListener("click", () => {
      const author = state.profile.displayName || "You";
      const verified = RS.hasVisit(gymId, sport);
      RS.upsertUserReview({
        id: `ur_${Date.now()}`,
        gymId,
        sport,
        author,
        verifiedVisit: verified,
        scores: { ...scores },
        tags: [...selected],
        text: ($("#rateText")?.value || "").trim().slice(0, 280),
        at: new Date().toISOString(),
      });
      openGymDetail(gymId);
      setTimeout(() => document.querySelector('.detail-tab[data-panel="reviews"]')?.click(), 50);
    });
  });

  $("#copyVenueShare")?.addEventListener("click", () => {
    const g = GYMS.find((x) => x.id === gymId);
    const agg = RS.aggregateRating(gymId, sport);
    const line = `${g?.name} on RollPhase${agg ? ` · ${agg.overall}★ (${agg.count} athlete reviews)` : ""} — ${location.origin}${location.pathname}#gym=${gymId}`;
    try {
      navigator.clipboard?.writeText(line);
      alert("Copied share blurb for friends (app or not).");
    } catch {
      prompt("Copy this:", line);
    }
  });
}

function openGymDetail(id) {
  const g = GYMS.find((x) => x.id === id);
  if (!g) return;
  const sport = focusId() && g.sports.includes(focusId()) ? focusId() : g.sports[0];
  const s = sportMeta(sport);
  const tags = g.tags[sport] || [];
  const here = g.here[sport] || [];
  const promo = g.promo?.[sport];
  const social = g.social || {};
  const agg =
    typeof ReviewSystem !== "undefined" ? ReviewSystem.aggregateRating(g.id, sport) : null;

  $("#gymDetailBody").innerHTML = `
    <div class="detail-hero">
      <h2>${escapeHtml(g.name)}</h2>
      <div class="card-meta">${g.mi} mi · ${g.open ? "Open now" : "Closed"} · ${escapeHtml(g.hours)}</div>
      ${
        agg
          ? `<div class="rating-pill" style="margin-top:6px"><span class="stars">${ReviewSystem.starsHtml(agg.overall)}</span> ${agg.overall} · ${agg.count} RollPhase reviews</div>`
          : ""
      }
      <div class="card-tags" style="margin-top:10px">
        ${g.sports.map((sid) => `<span class="tag-pill accent">${escapeHtml(sportMeta(sid)?.short || sid)}</span>`).join("")}
        ${tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
      </div>
    </div>
    <div class="detail-tabs">
      <button type="button" class="detail-tab active" data-panel="overview">Overview</button>
      <button type="button" class="detail-tab" data-panel="reviews">Reviews</button>
      <button type="button" class="detail-tab" data-panel="schedule">Schedule</button>
      <button type="button" class="detail-tab" data-panel="here">Here now</button>
      <button type="button" class="detail-tab" data-panel="social">Social</button>
    </div>
    <div class="detail-panel active" data-panel="overview">
      <div class="row-line"><span>Next</span><span>${escapeHtml(g.next[sport] || "—")}</span></div>
      <div class="row-line"><span>Sports</span><span>${g.sports.map((x) => sportMeta(x)?.short || x).join(", ")}</span></div>
      ${
        agg
          ? `<div class="row-line"><span>Athletes say</span><span>${escapeHtml((agg.topTags || []).slice(0, 2).join(" · ") || "—")}</span></div>`
          : ""
      }
      <button type="button" class="btn-primary" id="checkInHere">Check in${s ? ` · ${escapeHtml(s.short)}` : ""}</button>
      <button type="button" class="btn-ghost" id="followGym" style="width:100%;margin-top:8px;padding:12px">Follow gym · social feed</button>
      <button type="button" class="btn-ghost" id="jumpReviews" style="width:100%;margin-top:8px;padding:12px">See athlete reviews</button>
      ${
        sport && !profileSports().some((ps) => ps.id === sport)
          ? `<button type="button" class="btn-ghost" id="addSportFromGym" style="width:100%;margin-top:8px;padding:12px">Add ${escapeHtml(s?.short || "sport")} to my profile</button>`
          : ""
      }
    </div>
    <div class="detail-panel" data-panel="reviews">
      ${renderReviewsPanel(g.id, sport)}
    </div>
    <div class="detail-panel" data-panel="schedule">
      <div class="row-line"><span>Today</span><span>${escapeHtml(g.next[sport] || "Nothing listed")}</span></div>
      <div class="row-line"><span>Hours</span><span>${escapeHtml(g.hours)}</span></div>
      ${promo ? `<div class="event-card" style="margin-top:12px"><div class="card-title">${escapeHtml(promo)}</div></div>` : ""}
    </div>
    <div class="detail-panel" data-panel="here">
      ${
        here.length
          ? here
              .map(
                (h) => `
        <div class="here-row">
          <div class="av">${initials(h.n)}</div>
          <div><div class="card-title">${escapeHtml(h.n)}</div><div class="card-meta">${escapeHtml(h.l)}</div></div>
        </div>`
              )
              .join("")
          : empty("Nobody checked in", "Be first when you arrive.")
      }
    </div>
    <div class="detail-panel" data-panel="social">
      ${
        Object.keys(social).length
          ? Object.entries(social)
              .map(([k, v]) => `<div class="row-line"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`)
              .join("") +
            `<p class="muted small" style="margin-top:12px">Following brings their updates into your Feed.</p>`
          : empty("No linked socials", "Gym can connect IG / FB later.")
      }
      <div class="ext-links">
        <a href="${mapsSearchUrl(g.name)}" target="_blank" rel="noopener">Directions · Google Maps</a>
      </div>
    </div>
  `;

  showScreen("gym-detail");
  $$(".detail-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".detail-tab").forEach((b) => b.classList.remove("active"));
      $$(".detail-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`.detail-panel[data-panel="${btn.dataset.panel}"]`)?.classList.add("active");
    });
  });
  bindRateForm(g.id, sport);
  $("#jumpReviews")?.addEventListener("click", () => {
    document.querySelector('.detail-tab[data-panel="reviews"]')?.click();
  });
  $("#checkInHere")?.addEventListener("click", () => {
    state.checkedInGym = g.id;
    if (sport) applySkin(sport, { flash: false });
    if (typeof ReviewSystem !== "undefined") ReviewSystem.recordVisit(g.id, sport);
    switchTab("home");
  });
  $("#followGym")?.addEventListener("click", (e) => {
    const exists = state.profile.following.some((f) => f.name === g.name);
    if (!exists) {
      state.profile.following.push({ type: "gym", name: g.name, sport: sport || g.sports[0], platform: "instagram" });
    }
    e.target.textContent = "Following ✓";
  });
  $("#addSportFromGym")?.addEventListener("click", () => {
    if (sport) addSportToProfile(sport, "—");
    switchTab("profile");
  });
}

function renderPartners() {
  const s = sportMeta(focusId());
  if ($("#agePoolBadge")) {
    $("#agePoolBadge").textContent = state.agePool === "teen" ? "Youth pool 16–17" : "Adult pool";
  }
  if ($("#partnerHint")) {
    $("#partnerHint").textContent =
      state.agePool === "teen"
        ? `Youth only${s ? ` · ${s.short}` : ""}`
        : s
          ? `${s.vibe} · same sport · level · nearby`
          : "All sports · open to train · nearby — pick a focus to narrow";
  }

  const list = partnersForSport();
  const el = $("#partnerList");
  if (!el) return;
  el.innerHTML = list.length
    ? list
        .map(
          (p) => `
    <article class="partner-card">
      <div class="top">
        <div class="av">${initials(p.name)}</div>
        <div>
          <div class="name">${escapeHtml(p.name)}${p.age === "teen" ? " · Youth" : ""}</div>
          <div class="sub">${escapeHtml(sportMeta(p.sport)?.short || "")} · ${escapeHtml(p.level)} · ${p.mi} mi · ${escapeHtml(p.intent)}</div>
        </div>
      </div>
      <div class="partner-actions">
        <button type="button" class="btn-match" data-match="${p.id}">Request train</button>
        <button type="button" class="btn-sec">Profile</button>
      </div>
    </article>`
        )
        .join("")
    : empty("No partners in this pool", "Expand radius or clear sport focus.");

  $$("[data-match]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.textContent = "Requested ✓";
      btn.disabled = true;
    });
  });
}

function renderFeed() {
  const s = sportMeta(focusId());
  const hint = $("#feedHint");
  if (hint) {
    if (!s) {
      hint.textContent = "All sports. Focus a sport anytime to narrow what you see.";
    } else {
      hint.textContent = `${s.short}: events, live sessions, and posts from places you follow.`;
    }
  }

  const body = $("#feedBody");
  if (state.feedMode === "events") {
    const list = eventsForSport({ upcomingOnly: true });
    body.innerHTML = list.length
      ? list.map(eventCardHTML).join("")
      : empty("No upcoming events", "Webhooks will fill this when calendars connect.");
  } else if (state.feedMode === "live") {
    const list = eventsForSport({ liveOnly: true });
    body.innerHTML = list.length
      ? list.map(eventCardHTML).join("")
      : empty("Nothing live right now", "Check-ins and live sessions appear here.");
  } else {
    const list = socialForSport().filter((p) => p.followed || true);
    const followed = list.filter((p) => p.followed);
    body.innerHTML = followed.length
      ? followed.map(socialCardHTML).join("")
      : empty("Follow gyms & athletes", "Follow places you train — their updates show up here.");
  }

  // notify buttons
  $$("[data-notify]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.notify;
      state.profile.eventNotifies[id] = !state.profile.eventNotifies[id];
      renderFeed();
    });
  });
}

function renderGear() {
  const focus = focusId();
  const shops = (focus ? SHOPS.filter((s) => s.sports.includes(focus)) : SHOPS).sort((a, b) => a.mi - b.mi);
  const needs = focus ? NEEDS.filter((n) => n.sport === focus) : NEEDS;
  const shopsEl = $("#gearShops");
  const needsEl = $("#gearNeeds");
  if (!shopsEl) return;

  if (state.gearMode === "shops") {
    shopsEl.classList.remove("hidden");
    needsEl?.classList.add("hidden");
    shopsEl.innerHTML = shops.length
      ? shops
          .map(
            (s) => `
      <article class="shop-card">
        <div class="card-top">
          <div>
            <div class="card-title">${escapeHtml(s.name)}</div>
            <div class="card-meta">${escapeHtml(s.note)}</div>
          </div>
          <div class="dist">${s.mi} mi</div>
        </div>
      </article>`
          )
          .join("")
      : empty("No shops", "Gear stays sport-scoped.");
  } else {
    needsEl?.classList.remove("hidden");
    shopsEl.classList.add("hidden");
    if (needsEl) {
      needsEl.innerHTML = needs.length
        ? needs
            .map(
              (n) => `
        <article class="need-card">
          <div class="card-tags"><span class="tag-pill accent">${n.kind}</span></div>
          <div class="card-title" style="margin-top:8px">${escapeHtml(n.title)}</div>
          <div class="card-meta">${escapeHtml(n.who)} · ${n.mi} mi</div>
        </article>`
            )
            .join("")
        : empty("No needs", "Post a want/have for this sport.");
    }
  }
}

function renderRepresentStudio(host) {
  const rep = ensureRepresent();
  const c = rep.colors;
  const templates = typeof REPRESENT_TEMPLATES !== "undefined" ? REPRESENT_TEMPLATES : [];
  host.innerHTML = `
    <p class="muted small" style="margin-bottom:10px">
      Personalize <strong style="color:var(--text)">your</strong> strip — club name, crest, and colors.
      Only upload marks you have rights to use. This does not rebrand every sport for everyone.
    </p>

    <label class="toggle-row">
      <span>Show “I represent” strip</span>
      <input type="checkbox" id="repEnabled" ${rep.enabled ? "checked" : ""} />
    </label>

    <div class="social-field" style="margin-top:10px">
      <label>Name</label>
      <input type="text" id="repLabelInput" value="${escapeHtml(rep.label || "")}" placeholder="What you call your team / academy" />
    </div>

    <h4 class="rep-section-title">1 · Logo</h4>
    <div class="rep-logo-row">
      <div class="rep-logo-preview" id="repLogoPreview"></div>
      <div class="rep-logo-actions">
        <label class="btn-ghost rep-file-btn">
          Upload image
          <input type="file" id="repLogoFile" accept="image/*" hidden />
        </label>
        <button type="button" class="btn-ghost" id="repLogoClear" ${rep.logoDataUrl ? "" : "disabled"}>Remove</button>
      </div>
    </div>
    <div class="rep-crop-tools ${rep.logoDataUrl ? "" : "hidden"}" id="repCropTools">
      <label class="rep-slider-label">Zoom <input type="range" id="repZoom" min="1" max="3" step="0.05" value="${rep.crop.zoom || 1}" /></label>
      <label class="rep-slider-label">Pan X <input type="range" id="repPanX" min="0" max="1" step="0.01" value="${rep.crop.x ?? 0.5}" /></label>
      <label class="rep-slider-label">Pan Y <input type="range" id="repPanY" min="0" max="1" step="0.01" value="${rep.crop.y ?? 0.5}" /></label>
    </div>

    <h4 class="rep-section-title">2 · Colors (fully free)</h4>
    <div class="rep-color-grid">
      ${["primary", "secondary", "accent"]
        .map(
          (key) => `
        <div class="rep-color-card">
          <div class="rep-color-head">
            <span>${key}</span>
            <input type="color" data-color-key="${key}" value="${escapeHtml(c[key])}" />
          </div>
          <input type="text" class="rep-hex" data-hex-key="${key}" value="${escapeHtml(c[key])}" maxlength="7" />
          <label class="rep-slider-label">R
            <input type="range" data-rgb="${key}" data-ch="r" min="0" max="255" value="${parseInt((c[key] || '#000000').slice(1, 3), 16) || 0}" />
          </label>
          <label class="rep-slider-label">G
            <input type="range" data-rgb="${key}" data-ch="g" min="0" max="255" value="${parseInt((c[key] || '#000000').slice(3, 5), 16) || 0}" />
          </label>
          <label class="rep-slider-label">B
            <input type="range" data-rgb="${key}" data-ch="b" min="0" max="255" value="${parseInt((c[key] || '#000000').slice(5, 7), 16) || 0}" />
          </label>
        </div>`
        )
        .join("")}
    </div>

    <h4 class="rep-section-title">3 · Pattern</h4>
    <div class="filter-row" id="repPatternPills">
      ${["rings", "stripe", "mesh", "solid"]
        .map(
          (pat) =>
            `<button type="button" class="pill ${rep.pattern === pat ? "active" : ""}" data-pattern="${pat}">${pat}</button>`
        )
        .join("")}
    </div>

    <h4 class="rep-section-title">4 · Optional starters</h4>
    <p class="muted small">Seeds only — every value stays editable after.</p>
    <div class="filter-row" id="repTemplatePills" style="flex-wrap:wrap">
      ${templates
        .map((t) => `<button type="button" class="pill" data-template="${t.id}">${escapeHtml(t.name)}</button>`)
        .join("")}
    </div>

    <h4 class="rep-section-title">5 · Smart colors from logo</h4>
    <p class="muted small">Upload a crest, then let RollPhase suggest a matching palette and pattern. Tweak anything after.</p>
    <div class="rep-nix-actions">
      <button type="button" class="btn-primary" id="nixAnalyze" ${rep.logoDataUrl ? "" : "disabled"}>
        ${rep.nix?.status === "working" ? "Working…" : "Suggest colors from logo"}
      </button>
      <button type="button" class="btn-ghost" id="nixSuggest">Refine look</button>
    </div>
    <div class="webhook-box" id="nixNotes">${escapeHtml(rep.nix?.notes || "Upload a logo, then suggest colors.")}</div>
    <div class="rep-samples" id="nixSamples"></div>

    <p class="muted small" style="margin-top:12px">
      Only upload marks you may use. Your crest stays on your profile — it does not become the app’s sport theme for everyone.
    </p>
  `;

  // preview logo
  paintRepLogoPreview();
  paintNixSamples(rep.nix?.samples || []);

  $("#repEnabled")?.addEventListener("change", (e) => {
    rep.enabled = e.target.checked;
    applyRepresentStrip();
  });
  $("#repLabelInput")?.addEventListener("input", (e) => {
    rep.label = e.target.value;
    if (rep.label.trim()) rep.enabled = true;
    applyRepresentStrip();
  });

  $("#repLogoFile")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      rep.logoDataUrl = String(reader.result);
      rep.crop = { zoom: 1, x: 0.5, y: 0.5 };
      rep.enabled = true;
      rep.mode = "custom";
      renderRepresentStudio(host);
      applyRepresentStrip();
    };
    reader.readAsDataURL(file);
  });
  $("#repLogoClear")?.addEventListener("click", () => {
    rep.logoDataUrl = null;
    rep.nix = { status: "idle", notes: "Logo cleared", source: "", samples: [] };
    renderRepresentStudio(host);
    applyRepresentStrip();
  });

  const bindCrop = (id, key, parse = (v) => parseFloat(v)) => {
    $(id)?.addEventListener("input", (e) => {
      rep.crop[key] = parse(e.target.value);
      paintRepLogoPreview();
      applyRepresentStrip();
    });
  };
  bindCrop("#repZoom", "zoom");
  bindCrop("#repPanX", "x");
  bindCrop("#repPanY", "y");

  host.querySelectorAll("[data-color-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.colorKey;
      setRepColor(key, input.value, host);
    });
  });
  host.querySelectorAll("[data-hex-key]").forEach((input) => {
    input.addEventListener("change", () => {
      let v = input.value.trim();
      if (!v.startsWith("#")) v = `#${v}`;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) setRepColor(input.dataset.hexKey, v, host);
    });
  });
  host.querySelectorAll("[data-rgb]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.rgb;
      const rEl = host.querySelector(`[data-rgb="${key}"][data-ch="r"]`);
      const gEl = host.querySelector(`[data-rgb="${key}"][data-ch="g"]`);
      const bEl = host.querySelector(`[data-rgb="${key}"][data-ch="b"]`);
      const hex = rgbToHex(+rEl.value, +gEl.value, +bEl.value);
      setRepColor(key, hex, host, { skipSliders: true });
    });
  });

  $("#repPatternPills")?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-pattern]");
    if (!pill) return;
    rep.pattern = pill.dataset.pattern;
    $$("#repPatternPills .pill").forEach((b) => b.classList.toggle("active", b === pill));
    applyRepresentStrip();
  });

  $("#repTemplatePills")?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-template]");
    if (!pill) return;
    const t = templates.find((x) => x.id === pill.dataset.template);
    if (!t) return;
    rep.colors = { ...t.colors };
    rep.pattern = t.pattern;
    rep.mode = "template";
    rep.enabled = true;
    renderRepresentStudio(host);
    applyRepresentStrip();
  });

  $("#nixAnalyze")?.addEventListener("click", async () => {
    if (!rep.logoDataUrl || typeof NixClient === "undefined") return;
    rep.nix.status = "working";
    $("#nixNotes").textContent = "Reading your logo…";
    $("#nixAnalyze").disabled = true;
    try {
      const result = await NixClient.analyzeLogo(rep.logoDataUrl);
      rep.colors = {
        primary: result.primary,
        secondary: result.secondary,
        accent: result.accent,
      };
      rep.pattern = result.pattern || rep.pattern;
      rep.nix = {
        status: "ready",
        notes: "Palette suggested from your logo — adjust anything you like.",
        source: result.source,
        samples: result.samples || [],
      };
      rep.mode = "smart";
      rep.enabled = true;
      renderRepresentStudio(host);
      applyRepresentStrip();
    } catch (err) {
      rep.nix = { status: "error", notes: "Could not read that image. Try another file.", source: "error", samples: [] };
      $("#nixNotes").textContent = rep.nix.notes;
      $("#nixAnalyze").disabled = false;
    }
  });

  $("#nixSuggest")?.addEventListener("click", async () => {
    if (typeof NixClient === "undefined") return;
    $("#nixNotes").textContent = "Refining look…";
    try {
      const result = await NixClient.suggestSkin({
        label: rep.label,
        colors: rep.colors,
        logoDataUrl: rep.logoDataUrl,
      });
      rep.colors = {
        primary: result.primary,
        secondary: result.secondary,
        accent: result.accent,
      };
      if (result.pattern) rep.pattern = result.pattern;
      rep.nix = {
        status: "ready",
        notes: "Look refined — keep editing colors if you want.",
        source: result.source,
        samples: rep.nix.samples || [],
      };
      rep.enabled = true;
      renderRepresentStudio(host);
      applyRepresentStrip();
    } catch (err) {
      $("#nixNotes").textContent = "Could not refine right now. Try again.";
    }
  });
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, "0")).join("")}`;
}

function setRepColor(key, hex, host, opts = {}) {
  const rep = ensureRepresent();
  rep.colors[key] = hex;
  rep.enabled = true;
  const colorInput = host.querySelector(`[data-color-key="${key}"]`);
  const hexInput = host.querySelector(`[data-hex-key="${key}"]`);
  if (colorInput) colorInput.value = hex;
  if (hexInput) hexInput.value = hex;
  if (!opts.skipSliders) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rEl = host.querySelector(`[data-rgb="${key}"][data-ch="r"]`);
    const gEl = host.querySelector(`[data-rgb="${key}"][data-ch="g"]`);
    const bEl = host.querySelector(`[data-rgb="${key}"][data-ch="b"]`);
    if (rEl) rEl.value = r;
    if (gEl) gEl.value = g;
    if (bEl) bEl.value = b;
  }
  applyRepresentStrip();
}

function paintRepLogoPreview() {
  const el = $("#repLogoPreview");
  const rep = ensureRepresent();
  if (!el) return;
  if (!rep.logoDataUrl) {
    el.style.background = `linear-gradient(135deg, ${rep.colors.primary}, ${rep.colors.accent})`;
    el.style.backgroundImage = "";
    el.textContent = "No logo";
    return;
  }
  el.textContent = "";
  const z = rep.crop?.zoom || 1;
  el.style.backgroundImage = `url(${rep.logoDataUrl})`;
  el.style.backgroundSize = `${z * 140}%`;
  el.style.backgroundPosition = `${(rep.crop?.x ?? 0.5) * 100}% ${(rep.crop?.y ?? 0.5) * 100}%`;
  el.style.backgroundColor = rep.colors.secondary;
}

function paintNixSamples(samples) {
  const el = $("#nixSamples");
  if (!el) return;
  if (!samples?.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = samples
    .map((hex) => `<button type="button" class="rep-sample" data-sample="${escapeHtml(hex)}" style="background:${escapeHtml(hex)}" title="${escapeHtml(hex)}"></button>`)
    .join("");
  el.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rep = ensureRepresent();
      // cycle: set as accent by default, long-press would be nice — use as accent
      rep.colors.accent = btn.dataset.sample;
      rep.enabled = true;
      const host = $("#representFields");
      if (host) renderRepresentStudio(host);
      applyRepresentStrip();
    });
  });
}

function renderProfile() {
  const p = state.profile;
  const sportsHost = $("#profileSports");
  if (sportsHost) {
    const list = profileSports();
    sportsHost.innerHTML = list.length
      ? list
          .map((x) => {
            const s = sportMeta(x.id);
            return `
          <div class="profile-sport-row">
            <img src="${s?.icon || "assets/logo.jpg"}" alt="" />
            <div class="meta">
              <strong>${escapeHtml(s?.name || x.id)}</strong>
              <span>${escapeHtml(x.level || "—")} · tap home rail to focus</span>
            </div>
            <button type="button" data-remove-sport="${x.id}">Remove</button>
          </div>`;
          })
          .join("") +
        `<button type="button" class="btn-ghost" id="profileAddSport" style="width:100%;margin-top:10px;padding:10px">+ Add another sport</button>`
      : `<p class="muted small">No sports on profile yet — you’re free to explore. Add as many as you train.</p>
         <button type="button" class="btn-ghost" id="profileAddSport" style="width:100%;margin-top:10px;padding:10px">+ Add sports</button>`;

    sportsHost.querySelectorAll("[data-remove-sport]").forEach((btn) => {
      btn.addEventListener("click", () => removeSportFromProfile(btn.dataset.removeSport));
    });
    $("#profileAddSport")?.addEventListener("click", () => openSportPicker({ addMode: true }));
  }

  const repHost = $("#representFields");
  if (repHost) {
    renderRepresentStudio(repHost);
  }

  const myRev = $("#myReviews");
  if (myRev && typeof ReviewSystem !== "undefined") {
    const list = ReviewSystem.myReviews(state.profile.displayName || "You");
    // also show if author is Vlad from seed-like user posts
    const allMine = ReviewSystem.loadUserReviews().filter(
      (r) => r.author === (state.profile.displayName || "You") || r.author === "Vlad"
    );
    const rows = allMine.length ? allMine : list;
    myRev.innerHTML = rows.length
      ? rows
          .map((r) => {
            const g = GYMS.find((x) => x.id === r.gymId);
            return `<div class="review-card" style="cursor:pointer" data-gym="${r.gymId}">
              <div class="who">${escapeHtml(g?.name || r.gymId)}${r.verifiedVisit ? '<span class="verified-badge">Visit verified</span>' : ""}</div>
              <div class="when">${escapeHtml(sportMeta(r.sport)?.short || "")} · ${ReviewSystem.starsHtml(r.scores?.overall)}</div>
              ${r.text ? `<div class="body">${escapeHtml(r.text)}</div>` : ""}
            </div>`;
          })
          .join("")
      : `<p class="muted small">No reviews yet. Check in at a gym, train, check out → rate. That builds trusted signal for other athletes.</p>`;
    myRev.querySelectorAll("[data-gym]").forEach((el) => {
      el.addEventListener("click", () => openGymDetail(el.dataset.gym));
    });
  }

  const socialHost = $("#socialFields");
  if (socialHost) {
    const fields = [
      ["instagram", "Instagram"],
      ["facebook", "Facebook"],
      ["x", "X / Twitter"],
      ["tiktok", "TikTok"],
      ["strava", "Strava"],
      ["youtube", "YouTube"],
    ];
    socialHost.innerHTML = fields
      .map(
        ([key, label]) => `
      <div class="social-field">
        <label>${label}</label>
        <input type="text" data-social="${key}" value="${escapeHtml(p.social[key] || "")}" placeholder="@handle or URL" />
      </div>`
      )
      .join("");
    socialHost.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        state.profile.social[input.dataset.social] = input.value.trim();
      });
    });
  }

  const followHost = $("#followingList");
  if (followHost) {
    followHost.innerHTML = p.following.length
      ? p.following
          .map(
            (f, i) => `
      <span class="follow-chip">
        ${escapeHtml(f.name)} · ${escapeHtml(f.platform)}
        <button type="button" data-unfollow="${i}" aria-label="Unfollow">×</button>
      </span>`
          )
          .join("")
      : `<p class="muted small">Follow gyms from venue detail — their posts land in Feed.</p>`;
    followHost.querySelectorAll("[data-unfollow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.profile.following.splice(+btn.dataset.unfollow, 1);
        renderProfile();
      });
    });
  }

  const wh = $("#webhookList");
  if (wh) {
    wh.innerHTML = p.webhooks?.length
      ? p.webhooks
          .map(
            (w) => `
      <div class="webhook-box">
        <strong style="color:var(--text)">${escapeHtml(w.source)}</strong> · ${escapeHtml(w.sport)} · ${escapeHtml(w.status)}
      </div>`
          )
          .join("")
      : `<p class="muted small">Nothing connected yet. Follow gyms and events as you explore.</p>`;
  }
}

function openSportPicker({ addMode = false } = {}) {
  state._pickerAddMode = addMode;
  state.sportQuery = "";
  const search = $("#sportSearch");
  if (search) search.value = "";
  renderSportGrid();
  $("#sportPicker")?.classList.remove("hidden");
  const foot = $(".sheet-foot");
  if (foot) {
    foot.textContent = addMode
      ? "Add sports you train — as many as you want"
      : "Focus for today is optional · explore all anytime";
  }
}

function renderSportGrid() {
  const q = state.sportQuery.trim().toLowerCase();
  const list = SPORTS.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.short.toLowerCase().includes(q) ||
      s.vibe.toLowerCase().includes(q)
  );
  const grid = $("#sportGrid");
  if (!grid) return;
  const addMode = !!state._pickerAddMode;
  const mine = new Set(profileSports().map((p) => p.id));
  grid.innerHTML =
    (!addMode
      ? `<button type="button" class="sport-option ${!focusId() ? "selected" : ""}" data-sport="" data-explore="1">
          <div class="ico-3d" style="display:grid;place-items:center;background:#1a1a1a;color:#fff;font-weight:800;font-size:0.7rem">ALL</div>
          <span class="nm">Explore all</span>
          <span class="meta">No focus · mixed feed</span>
        </button>`
      : "") +
    list
      .map((s) => {
        const onProfile = mine.has(s.id);
        return `
    <button type="button" class="sport-option ${s.id === focusId() ? "selected" : ""}" data-sport="${s.id}" data-add="${addMode ? "1" : "0"}">
      <img class="ico-3d" src="${s.icon}" alt="" />
      <span class="nm">${escapeHtml(s.name)}</span>
      <span class="meta">${escapeHtml(s.vibe)}${onProfile ? " · in your sports" : ""}${addMode && !onProfile ? " · tap to add" : ""}</span>
    </button>`;
      })
      .join("");
}

/* ---------- Nav ---------- */
function showScreen(name) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $(`#screen-${name}`)?.classList.add("active");
}

function switchTab(tab) {
  state.tab = tab;
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  showScreen(tab);
  if (tab === "home") renderHome();
  if (tab === "gyms") renderGyms();
  if (tab === "partners") renderPartners();
  if (tab === "feed") renderFeed();
  if (tab === "profile") {
    renderProfile();
    renderGear();
  }
}

function renderAll() {
  try {
    const t = state.tab;
    if (t === "home") renderHome();
    else if (t === "gyms") renderGyms();
    else if (t === "partners") renderPartners();
    else if (t === "feed") renderFeed();
    else if (t === "profile") {
      renderProfile();
      renderGear();
    } else if (t === "gear") renderGear();
    else renderHome();
  } catch (e) {
    console.error("renderAll", e);
  }
}

function bind() {
  if (document.body.dataset.bound === "1") return;
  document.body.dataset.bound = "1";

  $("#sportChip")?.addEventListener("click", () => openSportPicker({ addMode: false }));

  $("#sportPicker")?.addEventListener("click", (e) => {
    if (e.target.id === "sportPicker") $("#sportPicker").classList.add("hidden");
  });

  $("#sportSearch")?.addEventListener("input", (e) => {
    state.sportQuery = e.target.value;
    renderSportGrid();
  });

  $("#sportGrid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sport]");
    if (!btn) return;
    const id = btn.dataset.sport || null;
    const addMode = btn.dataset.add === "1" || state._pickerAddMode;
    $("#sportPicker")?.classList.add("hidden");
    if (addMode && id) {
      addSportToProfile(id, "—");
      state._pickerAddMode = false;
      return;
    }
    setSport(id); // empty string → explore
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  document.body.addEventListener("click", (e) => {
    const demo = e.target.closest("[data-demo]");
    if (demo) {
      setDemoMode(demo.dataset.demo);
      return;
    }

    const focusBtn = e.target.closest("[data-focus]");
    if (focusBtn) {
      const id = focusBtn.dataset.focus;
      // toggle: tap again clears focus
      setSport(focusId() === id ? null : id);
      return;
    }

    if (e.target.closest("#browseAllSports")) {
      openSportPicker({ addMode: false });
      return;
    }
    if (e.target.closest("#addSportCard")) {
      openSportPicker({ addMode: hasProfileSports() });
      return;
    }

    const jump = e.target.closest(".tab-jump");
    if (jump) {
      switchTab(jump.dataset.tab);
      return;
    }
    const pin = e.target.closest(".map-pin");
    if (pin?.dataset.gym) {
      openGymDetail(pin.dataset.gym);
      return;
    }
    const card = e.target.closest(".card[data-gym]");
    if (card?.dataset.gym) openGymDetail(card.dataset.gym);

    const nbtn = e.target.closest("[data-notify]");
    if (nbtn && (state.tab === "home" || state.tab === "feed")) {
      const id = nbtn.dataset.notify;
      state.profile.eventNotifies = state.profile.eventNotifies || {};
      state.profile.eventNotifies[id] = !state.profile.eventNotifies[id];
      if (state.tab === "home") renderHome();
      else renderFeed();
    }
  });

  $("#gymBack")?.addEventListener("click", () => switchTab("gyms"));

  $("#gymViewSeg")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    state.gymView = btn.dataset.view;
    $$("#gymViewSeg .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderGyms();
  });

  $("#gymFilters")?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-filter]");
    if (!pill) return;
    state.gymFilter = pill.dataset.filter;
    renderGymFilters();
    renderGyms();
  });

  $("#partnerFilters")?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-rank]");
    if (!pill) return;
    state.rankFilter = pill.dataset.rank;
    renderPartnerFilters();
    renderPartners();
  });

  $("#feedSeg")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-feed]");
    if (!btn) return;
    state.feedMode = btn.dataset.feed;
    $$("#feedSeg .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderFeed();
  });

  $("#gearSeg")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gear]");
    if (!btn) return;
    state.gearMode = btn.dataset.gear;
    $$("#gearSeg .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderGear();
  });

  $("#ageDemo")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-age]");
    if (!btn) return;
    state.agePool = btn.dataset.age;
    $$("#ageDemo .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    if (state.tab === "partners") renderPartners();
  });

  $("#toggleTrain")?.addEventListener("click", () => {
    state.openToTrain = !state.openToTrain;
    if ($("#toggleTrain")) {
      $("#toggleTrain").textContent = state.openToTrain ? "Open to train · On" : "Open to train · Off";
    }
  });

  const tick = () => {
    if ($("#clock")) {
      $("#clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  };
  tick();
  setInterval(tick, 30000);
}

/* Boot — resilient */
(function boot() {
  try {
    // Athlete demo starts with soft focus on first profile sport (optional)
    if (hasProfileSports()) {
      state.sport = profileSports()[0].id;
    } else {
      state.sport = null;
    }
    renderStageSwatches();
    applySkin(state.sport, { flash: false });
    bind();
    safeRenderAll();
  } catch (e) {
    console.error("boot failed", e);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="position:fixed;inset:0;z-index:9999;background:#111;color:#fff;padding:24px;font-family:system-ui">
        <h2>RollPhase failed to start</h2>
        <pre style="white-space:pre-wrap;color:#f88">${String(e && e.message ? e.message : e)}</pre>
        <p>Hard refresh (Ctrl+Shift+R). If it persists, check the console.</p>
      </div>`
    );
  }
})();
