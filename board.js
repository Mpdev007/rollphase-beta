/**
 * The Mat Board: `#/gym/<id>` becomes a page anyone can read without an account. Mounted by
 * app.js's openGymDetail via `window.MatBoard?.mount(g)` (the one line the playbook allows there).
 * See docs/mat-board/DESIGN.md and PLAYBOOK.md step 5.
 */
const MatBoard = (() => {
  const CACHE_PREFIX = "rollphase.board.";
  const GEAR_OPTIONS = ["gi", "no-gi", "gloves", "shin-guards"];
  const KIND_LABELS = {
    class: "Class",
    "open-mat": "Open mat",
    "competition-class": "Comp class",
    kids: "Kids class",
  };

  let host = null;
  let gym = null;
  let channel = null;
  let profilePoll = null;
  let liveReady = false;
  let observer = null;
  let myId = null;
  let myProfile = null;
  let data = { slots: [], intentsBySlot: new Map(), childrenByIntentId: new Map(), profilesById: new Map(), checkins: [], dropinFee: null, myChildren: [], isStaffHere: false };
  let sharedSlotScrolled = false;
  let mountToken = 0; // bumped on every mount()/teardown() so stale async work is dropped
  let loadToken = 0; // bumped on every loadAndRender() call so an older, slower fetch never
  // clobbers a newer one's result — a write and its own realtime echo can both trigger a load,
  // and network timing doesn't guarantee they resolve in the order they started.

  /* ---------------- date/time helpers ---------------- */

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** Seven calendar dates starting today, so "today first" matches the DB's weekday numbering. */
  function weekOccurrences() {
    const out = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      out.push({ date: d, iso: isoDate(d), weekday: d.getDay(), isToday: i === 0 });
    }
    return out;
  }

  function fmtTime(startMin) {
    let h = Math.floor(startMin / 60);
    const m = startMin % 60;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }

  function fmtDayLabel(occ) {
    const wd = occ.date.toLocaleDateString(undefined, { weekday: "long" });
    return occ.isToday ? `Today · ${wd}` : wd;
  }

  function daysAgoLabel(iso) {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const diffDays = Math.floor((Date.now() - then) / 86400000);
    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  }

  function isStale(iso) {
    if (!iso) return true;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return true;
    return Date.now() - then > 60 * 24 * 60 * 60 * 1000; // 60 days
  }

  /* ---------------- lifecycle ---------------- */

  async function mount(g) {
    const token = ++mountToken;
    teardown();
    mountToken = token; // teardown() doesn't bump it further; keep our token current
    gym = g;
    sharedSlotScrolled = false;
    host = document.getElementById("matBoard");
    if (!host) return;
    host.innerHTML = `<div class="mat-board"><p class="mb-sub">Loading the board…</p></div>`;
    watchScreenLeave();

    try {
      myId = (await RP.user())?.id || null;
    } catch {
      myId = null;
    }

    // I5: any gym anyone opens becomes/stays a row. Partial payload — never clobbers
    // address/phone/website/source columns that aren't in this payload.
    if (myId && RP.db) {
      try {
        await RP.db.from("gyms").upsert(
          { id: g.id, name: g.name, loc: `SRID=4326;POINT(${g.lng} ${g.lat})`, city: g.city || null },
          { onConflict: "id" }
        );
      } catch (e) {
        console.warn("MatBoard: gym upsert failed", e);
      }
    }

    await loadAndRender(token);
    if (token === mountToken) subscribeRealtime();
  }

  function teardown() {
    mountToken++;
    if (channel && RP.db) {
      try {
        RP.db.removeChannel(channel);
      } catch {
        /* ignore */
      }
    }
    channel = null;
    if (profilePoll) {
      clearInterval(profilePoll);
      profilePoll = null;
    }
    liveReady = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  /** Unsubscribes when #screen-gym-detail stops being the active screen (no app.js changes needed). */
  function watchScreenLeave() {
    const screen = document.getElementById("screen-gym-detail");
    if (!screen) return;
    observer = new MutationObserver(() => {
      if (!screen.classList.contains("active")) teardown();
    });
    observer.observe(screen, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------------- data ---------------- */

  function cacheKey() {
    return `${CACHE_PREFIX}${gym.id}`;
  }

  function saveCache(payload) {
    try {
      localStorage.setItem(cacheKey(), JSON.stringify({ at: Date.now(), payload }));
    } catch {
      /* quota / private mode */
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadAndRender(token) {
    const myLoad = ++loadToken;
    if (!RP.db) {
      renderFromCacheOrError("Couldn't load the board. Refresh the app and try again.");
      return;
    }
    try {
      const [slotsRes, checkinsRes, gymRes, childrenRes, staffRes] = await Promise.all([
        RP.db.from("board_slots").select("*").eq("gym_id", gym.id).order("weekday").order("start_min"),
        RP.db.from("checkins").select("*").eq("gym_id", gym.id).gt("expires_at", new Date().toISOString()),
        // mount() already upserted this row (or it pre-existed), so it's safe to expect exactly one.
        RP.db.from("gyms").select("dropin_fee").eq("id", gym.id).maybeSingle(),
        myId ? RP.db.from("children").select("*").eq("guardian_id", myId) : Promise.resolve({ data: [] }),
        myId ? RP.db.from("gym_staff").select("role").eq("gym_id", gym.id).eq("user_id", myId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (token !== mountToken || myLoad !== loadToken) return;
      if (slotsRes.error) throw slotsRes.error;

      const slots = (slotsRes.data || []).filter((s) => !s.removed_at);
      const occurrences = weekOccurrences();
      const occByWeekday = new Map(occurrences.map((o) => [o.weekday, o]));
      // Every slot, not just adult ones: RLS on intents does the split for us (adult slots return
      // everyone's rows; kids/teens slots return only the caller's own — never another family's).
      const slotIds = slots.map((s) => s.id);

      let intents = [];
      if (slotIds.length) {
        const onDates = [...new Set(slots.map((s) => occByWeekday.get(s.weekday)?.iso).filter(Boolean))];
        const { data: rows, error } = await RP.db
          .from("intents")
          .select("*")
          .in("slot_id", slotIds)
          .in("on_date", onDates);
        if (!error) intents = rows || [];
      }
      if (token !== mountToken || myLoad !== loadToken) return;

      const peopleIds = new Set([
        ...intents.map((i) => i.user_id),
        ...(checkinsRes.data || []).map((c) => c.user_id),
        ...slots.map((s) => s.confirmed_by).filter(Boolean),
      ]);
      let profiles = [];
      if (peopleIds.size) {
        const { data: rows } = await RP.db.from("profiles").select("*").in("id", [...peopleIds]);
        profiles = rows || [];
      }
      if (myId) myProfile = profiles.find((p) => p.id === myId) || myProfile;

      const intentsBySlot = new Map();
      for (const i of intents) {
        if (!intentsBySlot.has(i.slot_id)) intentsBySlot.set(i.slot_id, []);
        intentsBySlot.get(i.slot_id).push(i);
      }

      data = {
        slots,
        intentsBySlot,
        profilesById: new Map(profiles.map((p) => [p.id, p])),
        checkins: checkinsRes.data || [],
        dropinFee: gymRes?.data?.dropin_fee || null,
        myChildren: childrenRes.data || [],
        isStaffHere: !!staffRes.data,
      };
      saveCache({ slots, intents, profiles, checkins: data.checkins, dropinFee: data.dropinFee, myChildren: data.myChildren, isStaffHere: data.isStaffHere });
      render({ offline: false });
    } catch (e) {
      if (myLoad !== loadToken) return;
      console.warn("MatBoard: load failed", e);
      renderFromCacheOrError("Couldn't load the board. Check your connection.");
    }
  }

  function renderFromCacheOrError(message) {
    const cached = loadCache();
    if (!cached) {
      host.innerHTML = `<div class="mat-board"><p class="mb-refusal-note">${escapeHtml(message)}</p></div>`;
      return;
    }
    const { slots, intents, profiles, checkins, dropinFee, myChildren, isStaffHere } = cached.payload;
    const intentsBySlot = new Map();
    for (const i of intents) {
      if (!intentsBySlot.has(i.slot_id)) intentsBySlot.set(i.slot_id, []);
      intentsBySlot.get(i.slot_id).push(i);
    }
    data = {
      slots,
      intentsBySlot,
      profilesById: new Map(profiles.map((p) => [p.id, p])),
      checkins,
      dropinFee: dropinFee || null,
      myChildren: myChildren || [],
      isStaffHere: !!isStaffHere,
    };
    render({ offline: true, cachedAt: cached.at });
  }

  /* ---------------- realtime ---------------- */

  function subscribeRealtime() {
    if (!RP.db) return;
    const token = mountToken;
    const gymId = gym.id;
    channel = RP.db
      .channel(`board-${gymId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots", filter: `gym_id=eq.${gymId}` }, () => {
        if (token === mountToken) loadAndRender(token);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins", filter: `gym_id=eq.${gymId}` }, () => {
        if (token === mountToken) loadAndRender(token);
      })
      // intents has no gym_id column, so filter client-side by slot_id — but a DELETE's replica
      // identity is the primary key by default, so payload.old carries only `id`, never slot_id.
      // For a delete we instead check whether that id was one we were already tracking for this
      // board (we always have our own intents' ids from the last load).
      .on("postgres_changes", { event: "*", schema: "public", table: "intents" }, (payload) => {
        if (token !== mountToken) return;
        if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id;
          const wasMine = [...data.intentsBySlot.values()].some((list) => list.some((i) => i.id === deletedId));
          if (wasMine) loadAndRender(token);
        } else {
          const mine = data.slots.some((s) => s.id === payload.new?.slot_id);
          if (mine) loadAndRender(token);
        }
      })
      .on("system", {}, (msg) => {
        // "SUBSCRIBED" is not "live": the change feed is ready only once this arrives. Before it,
        // a write can be missed entirely (measured on staging 2026-09-27). Reload once when it
        // lands so nothing from the gap is lost, then mark the board live.
        if (msg?.extension === "postgres_changes" && msg?.status === "ok" && token === mountToken) {
          liveReady = true;
          loadAndRender(token);
        }
      })
      .subscribe();

    // `profiles` (and `attestations`) are deliberately not in supabase_realtime (PLAYBOOK.md: only
    // slots/intents/checkins are) — a belt attestation from someone else won't otherwise reach an
    // already-open board, since it touches none of those three tables. A light poll while the
    // board is mounted covers that gap without changing the realtime publication.
    profilePoll = setInterval(() => {
      if (token === mountToken && document.visibilityState === "visible") loadAndRender(token);
    }, 20000);
  }

  /* ---------------- rendering ---------------- */

  function render({ offline, cachedAt }) {
    if (!host || !gym) return;
    const occurrences = weekOccurrences();
    const adultSlots = data.slots.filter((s) => s.audience === "adult");
    const kidsSlots = data.slots.filter((s) => s.audience !== "adult");

    const html = [`<div class="mat-board">`];
    html.push(`<div class="mb-header">
      <div><div class="mb-title">This week at ${escapeHtml(gym.name)}</div>
      <div class="mb-sub">${liveReady ? "Live" : "Loading live updates…"}</div></div>
      <button type="button" class="btn-sec" id="mbShare" style="padding:9px 14px">Share</button>
    </div>`);
    html.push(`<div class="mb-fee-row">
      <span>${data.dropinFee ? `Drop-in: ${escapeHtml(data.dropinFee)}` : "Drop-in fee not set"}</span>
      <a href="#" data-action="edit-fee">${data.dropinFee ? "Edit" : "Set fee"}</a>
    </div>`);

    if (offline) {
      const when = cachedAt ? new Date(cachedAt).toLocaleTimeString() : "earlier";
      html.push(`<div class="mb-offline-note">Showing the board from ${escapeHtml(when)}; you're offline.</div>`);
    }

    html.push(renderHereNow());

    if (!data.slots.length) {
      html.push(`<div class="mb-empty">
        <strong>No mat times yet.</strong>
        <p>Know the schedule? Add the first one.</p>
        <button type="button" class="btn-match mb-add-btn" data-action="add-slot">Add mat time</button>
      </div>`);
    } else {
      for (const occ of occurrences) {
        const dayAdult = adultSlots.filter((s) => s.weekday === occ.weekday);
        const dayKids = kidsSlots.filter((s) => s.weekday === occ.weekday);
        if (!dayAdult.length && !dayKids.length) continue;
        html.push(`<div class="mb-day-label${occ.isToday ? " today" : ""}">${escapeHtml(fmtDayLabel(occ))}</div>`);
        for (const s of dayAdult.sort((a, b) => a.start_min - b.start_min)) html.push(renderSlotCard(s, occ, true));
        if (dayKids.length) {
          html.push(`<div class="mb-day-label" style="margin-top:8px;font-size:0.66rem">Kids &amp; teens</div>`);
          for (const s of dayKids.sort((a, b) => a.start_min - b.start_min)) html.push(renderSlotCard(s, occ, false));
        }
      }
      html.push(`<button type="button" class="mb-add-btn" data-action="add-slot">+ Add mat time</button>`);
    }

    html.push(`</div>`);
    host.innerHTML = html.join("");
    bindEvents();
    focusSharedSlot();
  }

  function renderHereNow() {
    const rows = data.checkins
      .map((c) => ({ c, p: data.profilesById.get(c.user_id) }))
      .filter((r) => r.p);
    const list = rows.length
      ? `<div class="mb-here-list">${rows
          .map((r) => {
            const belt = r.p.belt
              ? ` (${escapeHtml(r.p.belt)}${r.p.belt_verified ? ` <span class="verified">✓ verified</span>` : ", self-declared"})`
              : "";
            const canAttest = r.p.id !== myId && r.p.belt;
            const attestBtn = canAttest
              ? `<button type="button" class="mb-attest-btn" data-action="attest" data-subject="${r.p.id}" data-belt="${escapeHtml(r.p.belt)}">Rolled with ${escapeHtml(r.p.display_name)} · confirm ${escapeHtml(r.p.belt)}</button>`
              : "";
            return `<div class="mb-here-chip"><span class="av">${escapeHtml(initialsOf(r.p.display_name))}</span>${escapeHtml(r.p.display_name)}${belt}</div>${attestBtn}`;
          })
          .join("")}</div>`
      : `<p class="mb-sub" style="margin-bottom:10px">Nobody has checked in yet.</p>`;
    const myCheckin = myId ? data.checkins.find((c) => c.user_id === myId) : null;
    const status = myCheckin
      ? `<div class="mb-checkin-status ok">You're here until ${escapeHtml(new Date(myCheckin.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</div>`
      : "";
    return `<div class="mb-here">
      <div class="mb-here-title">Here now</div>
      ${list}
      <button type="button" class="btn-match mb-checkin-btn" data-action="checkin">I'm here</button>
      <div id="mbCheckinMsg">${status}</div>
      <div id="mbAttestMsg"></div>
    </div>`;
  }

  function initialsOf(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function renderSlotCard(slot, occ, isAdult) {
    const kindLabel = KIND_LABELS[slot.kind] || slot.kind;
    const sportName = (typeof SPORTS !== "undefined" ? SPORTS.find((s) => s.id === slot.sport)?.short : null) || slot.sport;
    const gear = (slot.gear || []).map((g) => `<span class="mb-chip">${escapeHtml(g)}</span>`).join("");
    const audienceBadge =
      slot.audience === "kids"
        ? `<span class="mb-kind-badge">Kids</span>`
        : slot.audience === "teens"
          ? `<span class="mb-kind-badge teen">Teens</span>`
          : "";

    let confLine;
    if (slot.source === "gym-website" && !slot.confirmed_by) {
      const when = slot.confirmed_at ? new Date(slot.confirmed_at).toLocaleDateString() : "";
      confLine = `<span>from the gym's schedule${when ? " · " + escapeHtml(when) : ""}</span>`;
    } else {
      const name = slot.confirmed_by ? data.profilesById.get(slot.confirmed_by)?.display_name : null;
      const ago = daysAgoLabel(slot.confirmed_at);
      confLine = name
        ? `<span>confirmed by ${escapeHtml(name)}${ago ? " · " + ago : ""}</span>`
        : `<span>unconfirmed</span>`;
    }
    const stale = isStale(slot.confirmed_at);
    const canEditKids = slot.audience === "adult" || data.isStaffHere;
    const actions = canEditKids
      ? `<span><a href="#" data-action="confirm" data-slot="${slot.id}">Confirm</a><a href="#" data-action="edit" data-slot="${slot.id}">Edit</a></span>`
      : "";

    let inSection;
    if (isAdult) {
      const intents = data.intentsBySlot.get(slot.id) || [];
      const mine = myId ? intents.find((i) => i.user_id === myId) : null;
      const names = intents
        .map((i) => data.profilesById.get(i.user_id))
        .filter(Boolean)
        .map((p) => `<b>${escapeHtml(p.display_name)}</b> (${escapeHtml(p.belt || "unranked")}${p.belt ? (p.belt_verified ? ` <span class="verified">✓ verified</span>` : ", self-declared") : ""})`)
        .join(", ");
      inSection = `<div class="mb-slot-in">
        <button type="button" class="mb-imin${mine ? " on" : ""}" data-action="imin" data-slot="${slot.id}" data-date="${occ.iso}">${intents.length} in</button>
        ${intents.length ? `<div class="mb-imin-names">${names}</div>` : `<div class="mb-imin-names">nobody's in yet</div>`}
      </div>`;
    } else {
      // Family Access: in_count is null unless the viewer is a verified family/staff/admin. Names
      // are never shown here — the database only ever returns the caller's own intents for a
      // kids/teens slot, so there is nothing to name even for a verified family.
      const countLine =
        slot.in_count == null
          ? "" // no count at all shown to a non-family, per the owner's rule
          : `<div class="mb-count-hidden">${slot.in_count} kids coming</div>`;
      // Whatever intents I see here are my own (RLS), so this is exactly "which of my kids are
      // already signed up for this occurrence" — never another family's.
      const myIntents = (data.intentsBySlot.get(slot.id) || []).filter((i) => i.child_id != null);
      const signedUpIds = new Set(myIntents.map((i) => i.child_id));
      const signedUpLine = myIntents.length
        ? `<div class="mb-family-mine">Signed up: ${myIntents
            .map((i) => escapeHtml(data.myChildren.find((c) => c.id === i.child_id)?.initial || "your child"))
            .join(", ")}</div>`
        : "";
      const availableChildren = data.myChildren.filter((c) => !signedUpIds.has(c.id));
      const signupButtons = availableChildren.length
        ? `<div class="mb-family-signup">${availableChildren
            .map(
              (c) =>
                `<button type="button" class="btn-match mb-signup-btn" data-action="signup-child" data-slot="${slot.id}" data-date="${occ.iso}" data-child="${c.id}">Sign up ${escapeHtml(c.initial)}</button>`
            )
            .join("")}</div>`
        : "";
      inSection = `${countLine}${signedUpLine}${signupButtons}<div class="mb-family-msg" data-family-msg="${slot.id}"></div>`;
    }

    return `<div class="mb-slot" data-slot-card="${slot.id}">
      <div class="mb-slot-top">
        <div><div class="mb-slot-time">${fmtTime(slot.start_min)}</div>
        <div class="mb-slot-kind">${escapeHtml(kindLabel)} · ${escapeHtml(sportName)}${slot.note ? " · " + escapeHtml(slot.note) : ""}</div></div>
        <div class="mb-slot-actions">${audienceBadge}<button type="button" class="mb-share-session" data-action="share-slot" data-slot="${slot.id}" data-date="${occ.iso}">Share</button></div>
      </div>
      ${gear ? `<div class="mb-slot-gear">${gear}</div>` : ""}
      <div class="mb-slot-conf${stale ? " unconfirmed" : ""}">${confLine}${actions}</div>
      ${inSection}
    </div>`;
  }

  /* ---------------- events ---------------- */

  function bindEvents() {
    host.querySelector("#mbShare")?.addEventListener("click", () => {
      if (typeof window.RollShare?.open !== "function") return;
      window.RollShare.open({
        headline: "Share this board",
        title: gym.name,
        text: `Who's training at ${gym.name}`,
        note: "Scan it. The phone installs Rollphase if needed, then opens this board.",
        url: window.RollShare.gymUrl(gym),
        poster: true,
      });
    });
    host.querySelectorAll('[data-action="share-slot"]').forEach((el) =>
      el.addEventListener("click", () => shareSlot(el.dataset.slot, el.dataset.date))
    );
    host.querySelector('[data-action="checkin"]')?.addEventListener("click", onCheckin);
    host.querySelector('[data-action="add-slot"]')?.addEventListener("click", () => openSlotSheet(null));
    host.querySelectorAll('[data-action="confirm"]').forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        onConfirm(Number(el.dataset.slot));
      })
    );
    host.querySelectorAll('[data-action="edit"]').forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const slot = data.slots.find((s) => s.id === Number(el.dataset.slot));
        if (slot) openSlotSheet(slot);
      })
    );
    host.querySelectorAll('[data-action="imin"]').forEach((el) =>
      el.addEventListener("click", () => onImin(Number(el.dataset.slot), el.dataset.date))
    );
    host.querySelectorAll('[data-action="attest"]').forEach((el) =>
      el.addEventListener("click", () => onAttest(el.dataset.subject, el.dataset.belt))
    );
    host.querySelectorAll('[data-action="signup-child"]').forEach((el) =>
      el.addEventListener("click", () => onSignupChild(Number(el.dataset.slot), Number(el.dataset.child), el.dataset.date))
    );
    host.querySelector('[data-action="edit-fee"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      onEditFee();
    });
  }

  function focusSharedSlot() {
    const slot = window.RollShare?.readArrival?.()?.slot;
    if (!slot || !host) return;
    const card = host.querySelector(`[data-slot-card="${CSS.escape(String(slot))}"]`);
    if (!card) return;
    card.classList.add("is-shared");
    if (!sharedSlotScrolled) {
      sharedSlotScrolled = true;
      card.scrollIntoView({ block: "center" });
    }
  }

  function shareSlot(slotId, dateIso) {
    if (typeof window.RollShare?.open !== "function") return;
    const slot = data.slots.find((s) => String(s.id) === String(slotId));
    if (!slot) return;
    const kind = KIND_LABELS[slot.kind] || slot.kind;
    const sportName =
      (typeof SPORTS !== "undefined" ? SPORTS.find((s) => s.id === slot.sport)?.short : null) || slot.sport || "";
    const gear = (slot.gear || []).join(", ");
    const occ = weekOccurrences().find((o) => o.iso === dateIso);
    const when = `${occ ? fmtDayLabel(occ) : dateIso} · ${fmtTime(slot.start_min)} ${kind}`;
    const detail = [sportName, gear, gym.name].filter(Boolean).join(" · ");
    window.RollShare.open({
      headline: "Share this session",
      title: when,
      text: detail,
      note: "Scan it. The phone installs Rollphase if needed, then opens this session.",
      url: window.RollShare.sessionUrl(gym, slot.id, dateIso),
      poster: false,
    });
  }

  async function onSignupChild(slotId, childId, dateIso) {
    if (!(await ensureSignedIn())) return;
    const { error } = await RP.db.from("intents").insert({ slot_id: slotId, user_id: myId, on_date: dateIso, child_id: childId });
    // No optimistic UI: only a real, confirmed result changes what's shown.
    const msgEl = host.querySelector(`[data-family-msg="${slotId}"]`);
    if (error) {
      window.RollToast?.show?.("Family access for this gym isn't verified yet");
      if (msgEl) {
        msgEl.innerHTML = `<p class="mb-attest-msg err">Family access for this gym isn't verified yet</p>
          <button type="button" class="btn-sec mb-request-family-btn" data-action="request-family">Request access</button>`;
        msgEl.querySelector('[data-action="request-family"]')?.addEventListener("click", onRequestFamilyAccess);
      }
      return;
    }
    window.RollToast?.show?.("Signed up.");
    loadAndRender(mountToken);
  }

  async function onRequestFamilyAccess() {
    if (!(await ensureSignedIn())) return;
    const { error } = await RP.db.rpc("request_family_verification", { p_gym: gym.id });
    window.RollToast?.show?.(error ? error.message : "Request sent — waiting for the gym.");
  }

  function onEditFee() {
    openMiniSheet({
      title: "Drop-in fee",
      fields: [{ key: "fee", label: "Drop-in fee", placeholder: "$20 / free with a gi" }],
      onSave: async (vals) => {
        if (!(await ensureSignedIn())) return;
        const fee = vals.fee.trim() || null;
        const { error } = await RP.db.from("gyms").update({ dropin_fee: fee }).eq("id", gym.id);
        if (error) {
          window.RollToast?.show?.(error.message);
          return;
        }
        window.RollToast?.show?.("Drop-in fee updated.");
        loadAndRender(mountToken);
      },
    });
  }

  async function onAttest(subjectId, belt) {
    if (!(await ensureSignedIn())) return;
    const { error } = await RP.db.rpc("attest_belt", { p_subject: subjectId, p_belt: belt });
    // Re-query rather than capturing #mbAttestMsg up front: a realtime re-render can land during
    // either await above and replace host.innerHTML, detaching an earlier reference so writes to
    // it go nowhere the user can see. Also toast either way — belt-and-suspenders against a
    // re-render landing between this query and the read.
    const msgEl = host.querySelector("#mbAttestMsg");
    if (error) {
      if (msgEl) msgEl.innerHTML = `<div class="mb-attest-msg err">${escapeHtml(error.message)}</div>`;
      window.RollToast?.show?.(error.message);
      return;
    }
    window.RollToast?.show?.("Confirmed.");
    loadAndRender(mountToken);
  }

  async function onCheckin() {
    const msgEl = host.querySelector("#mbCheckinMsg");
    if (typeof state !== "undefined" && state.showHere === false) {
      if (msgEl) {
        msgEl.innerHTML = `<div class="mb-checkin-status err">Here now is off. Turn it on in Settings to appear on this board.</div>`;
      }
      return;
    }
    if (!navigator.geolocation) {
      msgEl.innerHTML = `<div class="mb-checkin-status err">Location isn't available on this device.</div>`;
      return;
    }
    msgEl.innerHTML = `<div class="mb-checkin-status">Finding you…</div>`;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data: row, error } = await RP.db.rpc("check_in", {
            p_gym_id: gym.id,
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
          });
          if (error) throw error;
          const until = new Date(row.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          msgEl.innerHTML = `<div class="mb-checkin-status ok">You're here until ${escapeHtml(until)}</div>`;
          loadAndRender(mountToken);
        } catch (e) {
          msgEl.innerHTML = `<div class="mb-checkin-status err">${escapeHtml(e.message || "Couldn't check in.")}</div>`;
        }
      },
      () => {
        msgEl.innerHTML = `<div class="mb-checkin-status err">Turn on location to check in here.</div>`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function onConfirm(slotId) {
    if (!(await ensureSignedIn())) return;
    const { error } = await RP.db
      .from("slots")
      .update({ confirmed_by: myId, confirmed_at: new Date().toISOString() })
      .eq("id", slotId);
    if (error) {
      console.warn("MatBoard: confirm failed", error);
      return;
    }
    loadAndRender(mountToken);
  }

  async function onImin(slotId, onDate) {
    if (!navigator.onLine) {
      window.RollToast?.show?.("You're offline — can't tap I'm in right now.");
      return;
    }
    if (!(await ensureSignedIn())) return;
    if (!(await ensureDisplayName())) return;
    const intents = data.intentsBySlot.get(slotId) || [];
    const mine = intents.find((i) => i.user_id === myId);
    if (mine) {
      const r = await RP.db.from("intents").delete().eq("id", mine.id);
      if (r.error) console.warn("MatBoard: leaving a slot failed", r.error.message);
    } else {
      const r = await RP.db.from("intents").insert({ slot_id: slotId, user_id: myId, on_date: onDate });
      if (r.error) console.warn("MatBoard: I'm in failed", r.error.message);
    }
    await loadAndRender(mountToken);
  }

  async function ensureSignedIn() {
    if (!myId) myId = (await RP.user())?.id || null;
    if (!myId) window.RollToast?.show?.("Couldn't sign you in — check your connection and try again.");
    return !!myId;
  }

  /* ---------------- name/belt prompt (for "I'm in" and Add/Edit without a profile yet) ---------------- */

  function ensureDisplayName() {
    if (myProfile?.display_name) return Promise.resolve(true);
    return new Promise((resolve) => {
      openMiniSheet({
        title: "What's your name?",
        fields: [
          { key: "name", label: "First name", placeholder: "Shown next to your tap-ins", required: true },
          { key: "belt", label: "Belt (optional)", placeholder: "e.g. blue" },
        ],
        onSave: async (vals) => {
          const row = await RP.ensureProfile(vals.name.trim(), gym.sports?.[0] || null, vals.belt?.trim() || null);
          myProfile = row || myProfile;
          resolve(!!row);
        },
        onCancel: () => resolve(false),
      });
    });
  }

  function openMiniSheet({ title, fields, onSave, onCancel }) {
    closeOverlay();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "mbMiniOverlay";
    overlay.innerHTML = `<div class="sheet mb-sheet" role="dialog" aria-modal="true" aria-labelledby="mbMiniTitle">
      <div class="sheet-handle"></div>
      <h2 id="mbMiniTitle">${escapeHtml(title)}</h2>
      ${fields
        .map(
          (f) => `<label><span>${escapeHtml(f.label)}</span><input type="text" data-field="${f.key}" placeholder="${escapeHtml(f.placeholder || "")}" maxlength="40" /></label>`
        )
        .join("")}
      <div class="mb-sheet-error" id="mbMiniError" hidden></div>
      <div class="mb-sheet-actions">
        <button type="button" class="btn-sec" id="mbMiniCancel">Cancel</button>
        <button type="button" class="btn-match" id="mbMiniSave">Save</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(`[data-field="${fields[0].key}"]`)?.focus();
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        close();
        onCancel?.();
      }
    });
    const escHandler = (e) => {
      if (e.key === "Escape") {
        close();
        onCancel?.();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
    overlay.querySelector("#mbMiniCancel").addEventListener("click", () => {
      close();
      onCancel?.();
    });
    overlay.querySelector("#mbMiniSave").addEventListener("click", async () => {
      const vals = {};
      for (const f of fields) vals[f.key] = overlay.querySelector(`[data-field="${f.key}"]`)?.value || "";
      const errEl = overlay.querySelector("#mbMiniError");
      const missing = fields.find((f) => f.required && !vals[f.key]?.trim());
      if (missing) {
        errEl.hidden = false;
        errEl.textContent = `${missing.label} is required.`;
        return;
      }
      errEl.hidden = true;
      await onSave(vals);
      close();
    });
  }

  function closeOverlay() {
    document.getElementById("mbMiniOverlay")?.remove();
    document.getElementById("mbSlotOverlay")?.remove();
  }

  /* ---------------- Add/Edit mat time sheet ---------------- */

  function openSlotSheet(existing) {
    closeOverlay();
    const sports = typeof SPORTS !== "undefined" ? SPORTS : [];
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "mbSlotOverlay";
    overlay.innerHTML = `<div class="sheet mb-sheet" role="dialog" aria-modal="true" aria-labelledby="mbSlotTitle">
      <div class="sheet-handle"></div>
      <h2 id="mbSlotTitle">${existing ? "Edit mat time" : "Add mat time"}</h2>
      <label><span>Day</span><select id="mbfWeekday">
        ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          .map((d, i) => `<option value="${i}" ${existing?.weekday === i ? "selected" : ""}>${d}</option>`)
          .join("")}
      </select></label>
      <label><span>Start time</span><input type="time" id="mbfStart" value="${existing ? minToHHMM(existing.start_min) : "19:00"}" /></label>
      <label><span>Duration (minutes)</span><input type="number" id="mbfDuration" min="15" max="360" value="${existing?.duration_min ?? 90}" /></label>
      <label><span>Sport</span><select id="mbfSport">
        ${sports.map((s) => `<option value="${s.id}" ${existing?.sport === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
      </select></label>
      <label><span>Kind</span><select id="mbfKind">
        ${Object.entries(KIND_LABELS).map(([k, v]) => `<option value="${k}" ${existing?.kind === k ? "selected" : ""}>${v}</option>`).join("")}
      </select></label>
      <label><span>Gear</span><div class="mb-gear-row" id="mbfGear">
        ${gearOptionsFor(existing?.sport || sports[0]?.id)
          .map((g) => `<button type="button" class="mb-gear-chip${(existing?.gear || []).includes(g) ? " selected" : ""}" data-gear="${g}">${g}</button>`)
          .join("")}
      </div></label>
      <label><span>Note (optional)</span><input type="text" id="mbfNote" maxlength="140" value="${escapeHtml(existing?.note || "")}" /></label>
      <div id="mbfNameFields" hidden>
        <label><span>Your name</span><input type="text" id="mbfName" maxlength="40" /></label>
        <label><span>Belt (optional)</span><input type="text" id="mbfBelt" maxlength="20" /></label>
      </div>
      <div class="mb-sheet-error" id="mbfError" hidden></div>
      <div class="mb-sheet-actions">
        <button type="button" class="btn-sec" id="mbfCancel">Cancel</button>
        <button type="button" class="btn-match" id="mbfSave">Save</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    if (!myProfile?.display_name) overlay.querySelector("#mbfNameFields").hidden = false;

    overlay.querySelectorAll("[data-gear]").forEach((chip) =>
      chip.addEventListener("click", () => chip.classList.toggle("selected"))
    );
    overlay.querySelector("#mbfSport").addEventListener("change", (e) => {
      const gearHost = overlay.querySelector("#mbfGear");
      const wasSelected = new Set([...gearHost.querySelectorAll(".selected")].map((el) => el.dataset.gear));
      gearHost.innerHTML = gearOptionsFor(e.target.value)
        .map((g) => `<button type="button" class="mb-gear-chip${wasSelected.has(g) ? " selected" : ""}" data-gear="${g}">${g}</button>`)
        .join("");
      gearHost.querySelectorAll("[data-gear]").forEach((chip) =>
        chip.addEventListener("click", () => chip.classList.toggle("selected"))
      );
    });
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector("#mbfCancel").addEventListener("click", close);
    overlay.querySelector("#mbfSave").addEventListener("click", async () => {
      const errEl = overlay.querySelector("#mbfError");
      const nameEl = overlay.querySelector("#mbfName");
      if (!myProfile?.display_name && !nameEl.value.trim()) {
        errEl.hidden = false;
        errEl.textContent = "Your name is required.";
        return;
      }
      if (!(await ensureSignedIn())) {
        errEl.hidden = false;
        errEl.textContent = "Couldn't sign you in. Try again.";
        return;
      }
      if (!myProfile?.display_name) {
        const row = await RP.ensureProfile(nameEl.value.trim(), gym.sports?.[0] || null, overlay.querySelector("#mbfBelt").value.trim() || null);
        myProfile = row || myProfile;
      }
      const [hh, mm] = overlay.querySelector("#mbfStart").value.split(":").map(Number);
      const gear = [...overlay.querySelectorAll("[data-gear].selected")].map((el) => el.dataset.gear);
      const payload = {
        gym_id: gym.id,
        weekday: Number(overlay.querySelector("#mbfWeekday").value),
        start_min: hh * 60 + mm,
        duration_min: Number(overlay.querySelector("#mbfDuration").value) || 90,
        sport: overlay.querySelector("#mbfSport").value,
        kind: overlay.querySelector("#mbfKind").value,
        gear,
        note: overlay.querySelector("#mbfNote").value.trim() || null,
        // Adding or correcting a slot is itself a confirmation: the person typing it is vouching
        // for it right now. A gym-website seed keeps its own "from the gym's schedule" line
        // (rendered from source, not confirmed_by) until someone explicitly taps Confirm.
        confirmed_by: myId,
        confirmed_at: new Date().toISOString(),
      };
      let res;
      if (existing) {
        res = await RP.db.from("slots").update(payload).eq("id", existing.id);
      } else {
        res = await RP.db.from("slots").insert({ ...payload, created_by: myId, source: "member" });
      }
      if (res.error) {
        errEl.hidden = false;
        errEl.textContent = res.error.message;
        return;
      }
      close();
      loadAndRender(mountToken);
    });
  }

  function gearOptionsFor(sportId) {
    const sport = typeof SPORTS !== "undefined" ? SPORTS.find((s) => s.id === sportId) : null;
    return sport?.matGear || GEAR_OPTIONS;
  }

  function minToHHMM(min) {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  return { mount };
})();

if (typeof window !== "undefined") window.MatBoard = MatBoard;
