/**
 * Passport.mount(cardEl) — a read-only "Training passport" card appended to the Profile screen's
 * "Your sports" card: the gyms where you have a valid check-in (count + last date), and your belt
 * with its status. See PLAYBOOK.md step 8.
 */
const Passport = (() => {
  let mountedIn = null;

  async function mount(cardEl) {
    if (!cardEl || typeof RP === "undefined" || !RP.db) return;
    if (mountedIn === cardEl && cardEl.querySelector("#passportBody")) {
      refresh(cardEl);
      return;
    }
    mountedIn = cardEl;
    if (!cardEl.querySelector("#passportSection")) {
      const section = document.createElement("div");
      section.id = "passportSection";
      section.style.cssText = "margin-top:16px;padding-top:16px;border-top:1px solid var(--line)";
      section.innerHTML = `<h3 style="margin:0 0 6px">Training passport</h3>
        <p class="muted small" style="margin:0 0 10px">The gyms you've checked in at, and your belt's status.</p>
        <div id="passportBody"><p class="muted small">Loading…</p></div>`;
      cardEl.appendChild(section);
    }
    await refresh(cardEl);
  }

  async function refresh(cardEl) {
    const body = cardEl.querySelector("#passportBody");
    if (!body) return;
    try {
      const user = await RP.user();
      if (!user) {
        body.innerHTML = `<p class="muted small">Check in at a gym to start your passport.</p>`;
        return;
      }
      const [{ data: checkins }, { data: profileRows }] = await Promise.all([
        RP.db.from("checkins").select("gym_id,at").eq("user_id", user.id),
        RP.db.from("profiles").select("belt,belt_verified").eq("id", user.id).limit(1),
      ]);
      const profile = profileRows?.[0];

      if (!checkins || !checkins.length) {
        body.innerHTML = `<p class="muted small">Check in at a gym to start your passport.</p>`;
        return;
      }

      const byGym = new Map();
      for (const c of checkins) {
        const prev = byGym.get(c.gym_id) || { count: 0, last: c.at };
        byGym.set(c.gym_id, {
          count: prev.count + 1,
          last: new Date(c.at) > new Date(prev.last) ? c.at : prev.last,
        });
      }
      const gymIds = [...byGym.keys()];
      const { data: gymRows } = await RP.db.from("gyms").select("id,name").in("id", gymIds);
      const nameById = new Map((gymRows || []).map((g) => [g.id, g.name]));

      const rows = gymIds
        .map((id) => ({ id, name: nameById.get(id) || id, ...byGym.get(id) }))
        .sort((a, b) => new Date(b.last) - new Date(a.last));

      const beltLine = profile?.belt
        ? `<div class="row-line"><span>Belt</span><span>${escapeHtml(profile.belt)}${profile.belt_verified ? ` <span style="color:var(--open)">✓ verified</span>` : " (self-declared)"}</span></div>`
        : "";

      body.innerHTML =
        beltLine +
        rows
          .map(
            (r) =>
              `<div class="row-line"><span>${escapeHtml(r.name)}</span><span>${r.count} visit${r.count === 1 ? "" : "s"} · last ${escapeHtml(new Date(r.last).toLocaleDateString())}</span></div>`
          )
          .join("");
    } catch (e) {
      console.warn("Passport: load failed", e);
      body.innerHTML = `<p class="muted small">Couldn't load your passport. Try again later.</p>`;
    }
  }

  return { mount };
})();

if (typeof window !== "undefined") window.Passport = Passport;
