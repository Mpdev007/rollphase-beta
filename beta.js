/**
 * RollPhase closed beta — disclaimer gate + tester feedback
 * Consent stored in localStorage (per browser).
 */

const BETA = {
  version: "0.4.0-beta",
  buildLabel: "Interactive prototype · not the App Store build",
  /** Optional: FormSubmit email for live feedback (https://formsubmit.co) */
  feedbackEmail: "", // e.g. "you@example.com" — leave empty to use mailto/copy
  storageKey: "rollphase.beta.ack.v1",
  feedbackKey: "rollphase.beta.feedback",
};

function betaAcked() {
  try {
    const raw = localStorage.getItem(BETA.storageKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data?.version === BETA.version && data?.accepted === true;
  } catch {
    return false;
  }
}

function saveBetaAck(payload) {
  localStorage.setItem(
    BETA.storageKey,
    JSON.stringify({
      accepted: true,
      version: BETA.version,
      name: payload.name || "",
      email: payload.email || "",
      at: new Date().toISOString(),
    })
  );
}

function loadBetaAck() {
  try {
    return JSON.parse(localStorage.getItem(BETA.storageKey) || "null");
  } catch {
    return null;
  }
}

function renderBetaGate() {
  if (betaAcked()) {
    document.getElementById("betaGate")?.remove();
    document.body.classList.remove("beta-locked");
    return true;
  }
  document.body.classList.add("beta-locked");
  let gate = document.getElementById("betaGate");
  if (!gate) {
    gate = document.createElement("div");
    gate.id = "betaGate";
    document.body.appendChild(gate);
  }
  gate.innerHTML = `
    <div class="beta-card">
      <div class="beta-badge">CLOSED BETA · ${BETA.version}</div>
      <img src="assets/logo.jpg" alt="" class="beta-logo" />
      <h1>RollPhase</h1>
      <p class="beta-sub">${BETA.buildLabel}</p>

      <div class="beta-scroll">
        <h2>Welcome, tester</h2>
        <p>Thanks for trying this early build. You’re looking at an <strong>interactive product prototype</strong> (HTML/CSS/JS) used to validate UX, multi-sport flow, and personalization — <strong>not</strong> the final native iOS/Android app or a production Supabase backend.</p>

        <h2>Please acknowledge</h2>
        <ul>
          <li><strong>Prototype data</strong> — gyms, partners, events, and maps are mock/sample data, not live inventory.</li>
          <li><strong>Not a medical or safety guarantee</strong> — training with others is at your own risk; always use real-world judgment.</li>
          <li><strong>Age &amp; matching</strong> — teen/adult pool rules are demonstrated in UI; production will enforce them server-side.</li>
          <li><strong>Brands &amp; clubs</strong> — “I represent…” is for <em>your</em> personalization. Do not upload trademarks you don’t have rights to use. Sport skins are generic and not affiliated with any specific academy or federation unless stated.</li>
          <li><strong>No official affiliation</strong> — RollPhase is not affiliated with IBJJF, HYROX, or other sports bodies shown as feed examples.</li>
          <li><strong>Privacy</strong> — this beta stores preferences and optional logo data in <em>your browser</em> (localStorage). Don’t enter secrets. Clear site data anytime.</li>
          <li><strong>Feedback</strong> — bugs, confusion, and “wow” moments all help. Use Feedback in the app after you enter.</li>
        </ul>

        <h2>Tester information</h2>
        <div class="beta-fields">
          <label>Name (optional)<input type="text" id="betaName" placeholder="How we should refer to you" autocomplete="name" /></label>
          <label>Email (optional)<input type="email" id="betaEmail" placeholder="For follow-up if you want" autocomplete="email" /></label>
        </div>

        <label class="beta-check">
          <input type="checkbox" id="betaAgree" />
          <span>I understand this is a beta prototype, I accept the disclaimer, and I agree to provide constructive feedback.</span>
        </label>
      </div>

      <button type="button" class="beta-enter" id="betaEnter" disabled>Enter beta</button>
      <p class="beta-foot">By entering you acknowledge the terms above. You can re-open About anytime from the app.</p>
    </div>
  `;

  const agree = gate.querySelector("#betaAgree");
  const enter = gate.querySelector("#betaEnter");
  agree?.addEventListener("change", () => {
    enter.disabled = !agree.checked;
  });
  enter?.addEventListener("click", () => {
    if (!agree?.checked) return;
    saveBetaAck({
      name: gate.querySelector("#betaName")?.value?.trim() || "",
      email: gate.querySelector("#betaEmail")?.value?.trim() || "",
    });
    gate.remove();
    document.body.classList.remove("beta-locked");
    window.dispatchEvent(new CustomEvent("rollphase:beta-ready"));
  });
  return false;
}

function openFeedbackSheet() {
  document.getElementById("feedbackSheet")?.remove();
  const ack = loadBetaAck() || {};
  const sheet = document.createElement("div");
  sheet.id = "feedbackSheet";
  sheet.className = "feedback-overlay";
  sheet.innerHTML = `
    <div class="feedback-panel">
      <div class="sheet-handle"></div>
      <h2>Beta feedback</h2>
      <p class="muted small">What worked, what confused you, what to build next. Screenshots optional later.</p>
      <label class="rep-slider-label">How does it feel overall?
        <select id="fbRating">
          <option value="5">5 — Love the direction</option>
          <option value="4" selected>4 — Solid, needs polish</option>
          <option value="3">3 — Mixed</option>
          <option value="2">2 — Confusing</option>
          <option value="1">1 — Broken / unusable</option>
        </select>
      </label>
      <label class="rep-slider-label">Area
        <select id="fbArea">
          <option value="home">Home / multi-sport</option>
          <option value="gyms">Gyms / discovery</option>
          <option value="partners">Partners / matching</option>
          <option value="feed">Feed / events</option>
          <option value="represent">I represent / personalization</option>
          <option value="profile">Profile</option>
          <option value="visual">Visual / skins</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="rep-slider-label">Your feedback
        <textarea id="fbBody" rows="5" placeholder="Be specific: what you tried, what you expected, what happened…"></textarea>
      </label>
      <label class="rep-slider-label">Contact (optional)
        <input type="email" id="fbEmail" value="${escapeAttr(ack.email || "")}" placeholder="email" />
      </label>
      <div class="feedback-actions">
        <button type="button" class="btn-primary" id="fbSubmit">Send feedback</button>
        <button type="button" class="btn-ghost" id="fbCancel">Cancel</button>
      </div>
      <p class="muted small" id="fbStatus"></p>
    </div>
  `;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.remove();
  });
  sheet.querySelector("#fbCancel")?.addEventListener("click", () => sheet.remove());
  sheet.querySelector("#fbSubmit")?.addEventListener("click", () => submitFeedback(sheet));
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function submitFeedback(sheet) {
  const rating = sheet.querySelector("#fbRating")?.value;
  const area = sheet.querySelector("#fbArea")?.value;
  const body = sheet.querySelector("#fbBody")?.value?.trim();
  const email = sheet.querySelector("#fbEmail")?.value?.trim();
  const status = sheet.querySelector("#fbStatus");
  if (!body) {
    if (status) status.textContent = "Please write a bit of feedback first.";
    return;
  }
  const entry = {
    id: `fb_${Date.now()}`,
    rating: +rating,
    area,
    body,
    email: email || null,
    betaVersion: BETA.version,
    userAgent: navigator.userAgent,
    url: location.href,
    at: new Date().toISOString(),
    ack: loadBetaAck(),
  };

  // Persist locally (exportable)
  try {
    const list = JSON.parse(localStorage.getItem(BETA.feedbackKey) || "[]");
    list.push(entry);
    localStorage.setItem(BETA.feedbackKey, JSON.stringify(list));
  } catch {
    /* ignore */
  }

  const summary = [
    `RollPhase beta feedback (${BETA.version})`,
    `Rating: ${entry.rating}/5`,
    `Area: ${entry.area}`,
    `When: ${entry.at}`,
    "",
    entry.body,
    "",
    email ? `Contact: ${email}` : "Contact: (none)",
    `URL: ${entry.url}`,
  ].join("\n");

  if (BETA.feedbackEmail) {
    // FormSubmit free endpoint (no backend to host)
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `https://formsubmit.co/${encodeURIComponent(BETA.feedbackEmail)}`;
    form.target = "_blank";
    form.style.display = "none";
    const fields = {
      _subject: `RollPhase beta · ${entry.area} · ${entry.rating}/5`,
      message: summary,
      _captcha: "false",
      _template: "table",
    };
    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement("input");
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
    if (status) status.textContent = "Opening secure feedback submit… Thank you!";
  } else {
    // mailto + clipboard fallback
    try {
      navigator.clipboard?.writeText(summary);
    } catch {
      /* ignore */
    }
    const mailto = `mailto:?subject=${encodeURIComponent(`RollPhase beta · ${entry.area}`)}&body=${encodeURIComponent(summary)}`;
    window.location.href = mailto;
    if (status) status.textContent = "Copied feedback & opened email. Paste if needed. Thank you!";
  }
  setTimeout(() => sheet.remove(), 1600);
}

function openAboutSheet() {
  document.getElementById("aboutSheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "aboutSheet";
  sheet.className = "feedback-overlay";
  sheet.innerHTML = `
    <div class="feedback-panel">
      <div class="sheet-handle"></div>
      <h2>About this beta</h2>
      <p class="muted small">${BETA.buildLabel} · ${BETA.version}</p>
      <div class="beta-scroll" style="max-height:50vh;margin:12px 0">
        <p>RollPhase is a multi-sport training companion prototype: discover venues, partners, events, gear needs, and personalize how you “represent” — without locking you to one sport.</p>
        <p><strong>Planned product stack:</strong> native SwiftUI + Kotlin, Supabase (Postgres + PostGIS + Realtime), optional Nix on-device LLM for personalization.</p>
        <p><strong>This build:</strong> clickable mobile UI mock for UX validation with friends/testers.</p>
        <p>Re-read the full disclaimer by clearing site data, or continue testing and send Feedback anytime.</p>
      </div>
      <button type="button" class="btn-ghost" id="aboutClose" style="width:100%;padding:12px">Close</button>
      <button type="button" class="btn-ghost" id="aboutReset" style="width:100%;padding:12px;margin-top:8px">Reset beta acknowledgement</button>
    </div>
  `;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.remove();
  });
  sheet.querySelector("#aboutClose")?.addEventListener("click", () => sheet.remove());
  sheet.querySelector("#aboutReset")?.addEventListener("click", () => {
    localStorage.removeItem(BETA.storageKey);
    location.reload();
  });
}

function injectBetaChrome() {
  // Floating actions on stage (desktop + mobile)
  if (document.getElementById("betaChrome")) return;
  const chrome = document.createElement("div");
  chrome.id = "betaChrome";
  chrome.innerHTML = `
    <button type="button" id="btnFeedback" title="Send feedback">Feedback</button>
    <button type="button" id="btnAbout" title="About beta">About</button>
  `;
  document.body.appendChild(chrome);
  document.getElementById("btnFeedback")?.addEventListener("click", openFeedbackSheet);
  document.getElementById("btnAbout")?.addEventListener("click", openAboutSheet);

  // In-phone profile also gets links if container exists later
}

function initBeta() {
  injectBetaChrome();
  const ready = renderBetaGate();
  if (ready) {
    window.dispatchEvent(new CustomEvent("rollphase:beta-ready"));
  }
}

// Boot beta before / with app
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBeta);
} else {
  initBeta();
}
