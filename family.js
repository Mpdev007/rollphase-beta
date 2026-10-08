/**
 * Family.mount(cardEl) — the Profile "Family" card: add a child (first initial + age band only,
 * never a name/birthday/photo), per-gym request/verification status, and — only for gym staff or
 * platform admins — a staff screen to verify/decline requests and revoke verified families.
 * The database does the enforcing (see PLAYBOOK.md step 11 and the kids_classes_counts_only
 * migration); this file never shows more than what a query actually returned.
 */
const Family = (() => {
  const AGE_BANDS = ["4-7", "7-12", "13-17"];
  let mountedIn = null;

  async function mount(cardEl) {
    if (!cardEl || typeof RP === "undefined" || !RP.db) return;
    mountedIn = cardEl;
    if (!cardEl.querySelector("#familySection")) {
      const section = document.createElement("div");
      section.id = "familySection";
      section.style.cssText = "margin-top:16px;padding-top:16px;border-top:1px solid var(--line)";
      section.innerHTML = `<h3 style="margin:0 0 6px">Family</h3>
        <div id="familyBody"><p class="muted small">Loading…</p></div>`;
      cardEl.appendChild(section);
    }
    await refresh(cardEl);
  }

  async function refresh(cardEl) {
    const body = cardEl.querySelector("#familyBody");
    if (!body) return;
    try {
      const user = await RP.user();
      if (!user || user.is_anonymous) {
        body.innerHTML = `
          <p class="muted small">Add your email to set up a family.</p>
          <div class="social-field">
            <label>Email</label>
            <input type="email" id="familyUpgradeEmail" placeholder="you@example.com" />
          </div>
          <button type="button" class="btn-ghost" id="familyUpgradeBtn" style="width:100%;padding:10px">Upgrade your account</button>
          <p class="muted small" id="familyUpgradeMsg" style="margin-top:6px"></p>`;
        body.querySelector("#familyUpgradeBtn")?.addEventListener("click", async () => {
          const email = body.querySelector("#familyUpgradeEmail")?.value.trim();
          const msg = body.querySelector("#familyUpgradeMsg");
          if (!email) {
            if (msg) msg.textContent = "Enter an email first.";
            return;
          }
          const { error } = await RP.db.auth.updateUser({ email });
          if (msg) msg.textContent = error ? error.message : "Check your email to confirm — then reopen this page.";
        });
        return;
      }

      const [{ data: children }, { data: staffRows }, { data: requests }, { data: verifications }] = await Promise.all([
        RP.db.from("children").select("*").eq("guardian_id", user.id),
        RP.db.from("gym_staff").select("gym_id,role").eq("user_id", user.id),
        RP.db.from("family_requests").select("gym_id,requested_at").eq("guardian_id", user.id),
        RP.db.from("family_verifications").select("gym_id,verified_at").eq("guardian_id", user.id),
      ]);

      const gymIds = [...new Set([...(requests || []).map((r) => r.gym_id), ...(verifications || []).map((v) => v.gym_id), ...(staffRows || []).map((s) => s.gym_id)])];
      const { data: gymRows } = gymIds.length ? await RP.db.from("gyms").select("id,name").in("id", gymIds) : { data: [] };
      const gymName = (id) => gymRows?.find((g) => g.id === id)?.name || id;

      const childrenHtml = (children || []).length
        ? (children || []).map((c) => `<div class="row-line"><span>${escapeHtml(c.initial)}</span><span>${escapeHtml(c.age_band)}</span></div>`).join("")
        : `<p class="muted small">No children added yet.</p>`;

      const statusRows = [
        ...(verifications || []).map((v) => ({ gymId: v.gym_id, line: `Verified by ${escapeHtml(gymName(v.gym_id))}` })),
        ...(requests || [])
          .filter((r) => !(verifications || []).some((v) => v.gym_id === r.gym_id))
          .map((r) => ({ gymId: r.gym_id, line: `Waiting for ${escapeHtml(gymName(r.gym_id))}` })),
      ];
      const statusHtml = statusRows.length
        ? statusRows.map((r) => `<div class="row-line"><span>${escapeHtml(gymName(r.gymId))}</span><span>${r.line}</span></div>`).join("")
        : `<p class="muted small">No family requests yet — try signing up a child for a kids/teens class on a gym's board.</p>`;

      body.innerHTML = `
        <p class="muted small">Add your child: first initial only, and an age band. No name, birthday or photo — ever.</p>
        <div class="social-field">
          <label>Initial</label>
          <input type="text" id="childInitial" maxlength="2" placeholder="e.g. J" />
        </div>
        <div class="social-field">
          <label>Age band</label>
          <select id="childAgeBand">${AGE_BANDS.map((b) => `<option value="${b}">${b}</option>`).join("")}</select>
        </div>
        <button type="button" class="btn-ghost" id="addChildBtn" style="width:100%;padding:10px">Add child</button>
        <p class="muted small" id="addChildMsg" style="margin-top:6px"></p>
        <div style="margin-top:10px">${childrenHtml}</div>
        <h4 class="rep-section-title">Family access by gym</h4>
        ${statusHtml}
      `;
      body.querySelector("#addChildBtn")?.addEventListener("click", async () => {
        const initial = body.querySelector("#childInitial")?.value.trim();
        const ageBand = body.querySelector("#childAgeBand")?.value;
        const msg = body.querySelector("#addChildMsg");
        if (!initial || !/^[A-Za-z]{1,2}$/.test(initial)) {
          if (msg) msg.textContent = "Initial must be 1-2 letters.";
          return;
        }
        const { error } = await RP.db.from("children").insert({ guardian_id: user.id, initial, age_band: ageBand });
        if (msg) msg.textContent = error ? error.message : "";
        if (!error) await refresh(cardEl);
      });

      if ((staffRows || []).length) {
        const staffHost = document.createElement("div");
        staffHost.id = "familyStaffSection";
        staffHost.style.cssText = "margin-top:16px;padding-top:16px;border-top:1px solid var(--line)";
        body.appendChild(staffHost);
        await renderStaffScreen(staffHost, user.id, staffRows, cardEl);
      }
    } catch (e) {
      console.warn("Family: load failed", e);
      body.innerHTML = `<p class="muted small">Couldn't load Family. Try again later.</p>`;
    }
  }

  async function renderStaffScreen(host, myId, staffRows, cardEl) {
    host.innerHTML = `<h4 class="rep-section-title">Staff</h4><p class="muted small">Loading requests…</p>`;
    try {
      const staffGymIds = staffRows.map((s) => s.gym_id);
      const [{ data: requests }, { data: verifications }] = await Promise.all([
        RP.db.from("family_requests").select("guardian_id,gym_id,requested_at").in("gym_id", staffGymIds),
        RP.db.from("family_verifications").select("guardian_id,gym_id,verified_at").in("gym_id", staffGymIds),
      ]);
      const guardianIds = [...new Set([...(requests || []).map((r) => r.guardian_id), ...(verifications || []).map((v) => v.guardian_id)])];
      const [{ data: profiles }, { data: allChildren }, { data: gymRows }] = await Promise.all([
        guardianIds.length ? RP.db.from("profiles").select("id,display_name").in("id", guardianIds) : Promise.resolve({ data: [] }),
        guardianIds.length ? RP.db.from("children").select("guardian_id,initial,age_band").in("guardian_id", guardianIds) : Promise.resolve({ data: [] }),
        RP.db.from("gyms").select("id,name").in("id", staffGymIds),
      ]);
      const nameOf = (id) => profiles?.find((p) => p.id === id)?.display_name || "A parent";
      const gymNameOf = (id) => gymRows?.find((g) => g.id === id)?.name || id;
      const childrenOf = (id) => (allChildren || []).filter((c) => c.guardian_id === id).map((c) => `${c.initial} (${c.age_band})`).join(", ") || "—";

      const requestRows = (requests || [])
        .map(
          (r) => `<div class="row-line">
            <span>${escapeHtml(nameOf(r.guardian_id))} · ${escapeHtml(gymNameOf(r.gym_id))}<br/><span class="muted small">${escapeHtml(childrenOf(r.guardian_id))}</span></span>
            <span>
              <button type="button" class="btn-ghost" data-verify="${escapeHtml(r.guardian_id)}" data-gym="${escapeHtml(r.gym_id)}">Verify</button>
              <button type="button" class="btn-ghost" data-decline="${escapeHtml(r.guardian_id)}" data-gym="${escapeHtml(r.gym_id)}">Decline</button>
            </span>
          </div>`
        )
        .join("");
      const verifiedRows = (verifications || [])
        .map(
          (v) => `<div class="row-line">
            <span>${escapeHtml(nameOf(v.guardian_id))} · ${escapeHtml(gymNameOf(v.gym_id))}</span>
            <span><button type="button" class="btn-ghost" data-revoke="${escapeHtml(v.guardian_id)}" data-gym="${escapeHtml(v.gym_id)}">Revoke</button></span>
          </div>`
        )
        .join("");

      host.innerHTML = `
        <h4 class="rep-section-title">Staff — requests</h4>
        ${requestRows || `<p class="muted small">No pending requests.</p>`}
        <h4 class="rep-section-title">Staff — verified families</h4>
        ${verifiedRows || `<p class="muted small">No verified families yet.</p>`}
        <p class="muted small" id="familyStaffMsg" style="margin-top:6px"></p>
      `;
      const msg = host.querySelector("#familyStaffMsg");
      host.querySelectorAll("[data-verify]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const { error } = await RP.db.rpc("verify_family", { p_guardian: btn.dataset.verify, p_gym: btn.dataset.gym });
          if (msg) msg.textContent = error ? error.message : "Verified.";
          if (!error) refresh(cardEl);
        })
      );
      host.querySelectorAll("[data-decline]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const { error } = await RP.db.from("family_requests").delete().eq("guardian_id", btn.dataset.decline).eq("gym_id", btn.dataset.gym);
          if (msg) msg.textContent = error ? error.message : "Declined.";
          if (!error) refresh(cardEl);
        })
      );
      host.querySelectorAll("[data-revoke]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const { error } = await RP.db.rpc("revoke_family", { p_guardian: btn.dataset.revoke, p_gym: btn.dataset.gym });
          if (msg) msg.textContent = error ? error.message : "Revoked.";
          if (!error) refresh(cardEl);
        })
      );
    } catch (e) {
      console.warn("Family staff screen failed", e);
      host.innerHTML = `<p class="muted small">Couldn't load the staff screen.</p>`;
    }
  }

  return { mount };
})();

if (typeof window !== "undefined") window.Family = Family;
