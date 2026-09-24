/**
 * RollPhase closed beta — disclaimer + feedback (product-facing copy only)
 */

const BETA = {
  version: "0.4.0-beta",
  buildLabel: "Closed beta · early access",
  feedbackEmail: "",
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
      <div class="beta-badge">CLOSED BETA</div>
      <img src="assets/logo.jpg" alt="" class="beta-logo" />
      <h1>RollPhase</h1>
      <p class="beta-sub">Train near you · every sport · your people</p>

      <div class="beta-scroll">
        <h2>What is RollPhase?</h2>
        <p><strong>RollPhase</strong> helps athletes find places to train, people to train with, upcoming events, and gear — across many sports. Pick a sport when you want focus, or explore freely. Personalize how you show up for your club without locking the whole app to one brand.</p>

        <h2>What you can try</h2>
        <ul>
          <li><strong>Discover venues</strong> near you — real places, distance, phone, website when available.</li>
          <li><strong>Multi-sport focus</strong> — train BJJ one day, lift the next. Switch anytime.</li>
          <li><strong>Save places</strong> and check in so reviews can be visit-trusted.</li>
          <li><strong>I represent…</strong> — your club name, colors, and crest (yours only).</li>
          <li><strong>Partners &amp; events</strong> — rolling out as the community grows.</li>
        </ul>

        <h2>Please acknowledge</h2>
        <ul>
          <li><strong>Closed beta</strong> — features improve often; some areas (partners, events) fill in as people join.</li>
          <li><strong>Train safely</strong> — meeting people or visiting gyms is at your own risk. Use real-world judgment.</li>
          <li><strong>Age-aware matching</strong> — youth and adult partner discovery stay separated for safety.</li>
          <li><strong>Your brands</strong> — only upload logos and names you have rights to use.</li>
          <li><strong>Independent</strong> — RollPhase isn’t affiliated with any single gym brand or federation.</li>
          <li><strong>Your privacy</strong> — preferences stay on this device unless you send feedback with contact info.</li>
          <li><strong>Feedback welcome</strong> — use Feedback anytime after you enter.</li>
        </ul>

        <h2>About you (optional)</h2>
        <div class="beta-fields">
          <label>Name<input type="text" id="betaName" placeholder="How we should refer to you" autocomplete="name" /></label>
          <label>Email<input type="email" id="betaEmail" placeholder="Only if you want a follow-up" autocomplete="email" /></label>
        </div>

        <label class="beta-check">
          <input type="checkbox" id="betaAgree" />
          <span>I understand this is a closed beta, I accept the disclaimer, and I’m happy to share constructive feedback.</span>
        </label>
      </div>

      <button type="button" class="beta-enter" id="betaEnter" disabled>Enter RollPhase</button>
      <p class="beta-foot">By entering you accept the terms above. Open <strong>About</strong> anytime for a short recap.</p>
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

function betaPushOverlay(name) {
  try {
    const tab =
      (typeof state !== "undefined" && state.tab) ||
      document.querySelector(".tab.active")?.dataset?.tab ||
      "home";
    history.pushState({ rp: 1, view: "overlay", name, tab }, "", `#/${tab}/${name}`);
  } catch {
    /* ignore */
  }
}

function betaCloseOverlay(sheet) {
  if (!sheet) return;
  const isHist =
    history.state?.view === "overlay" &&
    (history.state?.name === "feedback" || history.state?.name === "about");
  if (isHist) {
    history.back();
    return;
  }
  sheet.remove();
}

function openFeedbackSheet(opts = {}) {
  document.getElementById("feedbackSheet")?.remove();
  const ack = loadBetaAck() || {};
  const sheet = document.createElement("div");
  sheet.id = "feedbackSheet";
  sheet.className = "feedback-overlay";
  sheet.innerHTML = `
    <div class="feedback-panel">
      <div class="sheet-handle"></div>
      <h2>Send feedback</h2>
      <p class="muted small">What worked, what confused you, what you’d use every week. Thank you.</p>
      <label class="rep-slider-label">Overall
        <select id="fbRating">
          <option value="5">5 — Love the direction</option>
          <option value="4" selected>4 — Solid, needs polish</option>
          <option value="3">3 — Mixed</option>
          <option value="2">2 — Confusing</option>
          <option value="1">1 — Hard to use</option>
        </select>
      </label>
      <label class="rep-slider-label">Area
        <select id="fbArea">
          <option value="home">Home / sports</option>
          <option value="gyms">Gyms / discovery</option>
          <option value="partners">Partners</option>
          <option value="feed">Feed / events</option>
          <option value="reviews">Venue ratings</option>
          <option value="represent">I represent</option>
          <option value="profile">Profile</option>
          <option value="look">Look &amp; feel</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="rep-slider-label">Your feedback
        <textarea id="fbBody" rows="5" placeholder="What you tried, what you expected, what happened…"></textarea>
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
  if (opts.historyMode !== "none") betaPushOverlay("feedback");
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) betaCloseOverlay(sheet);
  });
  sheet.querySelector("#fbCancel")?.addEventListener("click", () => betaCloseOverlay(sheet));
  sheet.querySelector("#fbSubmit")?.addEventListener("click", () => submitFeedback(sheet));
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

  try {
    const list = JSON.parse(localStorage.getItem(BETA.feedbackKey) || "[]");
    list.push(entry);
    localStorage.setItem(BETA.feedbackKey, JSON.stringify(list));
  } catch {
    /* ignore */
  }

  const summary = [
    `RollPhase feedback`,
    `Rating: ${entry.rating}/5`,
    `Area: ${entry.area}`,
    `When: ${entry.at}`,
    "",
    entry.body,
    "",
    email ? `Contact: ${email}` : "Contact: (none)",
  ].join("\n");

  if (BETA.feedbackEmail) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `https://formsubmit.co/${encodeURIComponent(BETA.feedbackEmail)}`;
    form.target = "_blank";
    form.style.display = "none";
    const fields = {
      _subject: `RollPhase feedback · ${entry.area} · ${entry.rating}/5`,
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
    if (status) status.textContent = "Sending… thank you!";
  } else {
    try {
      navigator.clipboard?.writeText(summary);
    } catch {
      /* ignore */
    }
    const mailto = `mailto:?subject=${encodeURIComponent(`RollPhase feedback · ${entry.area}`)}&body=${encodeURIComponent(summary)}`;
    window.location.href = mailto;
    if (status) status.textContent = "Opening your email… thank you!";
  }
  setTimeout(() => sheet.remove(), 1600);
}

function openAboutSheet(opts = {}) {
  document.getElementById("aboutSheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "aboutSheet";
  sheet.className = "feedback-overlay";
  sheet.innerHTML = `
    <div class="feedback-panel">
      <div class="sheet-handle"></div>
      <h2>About RollPhase</h2>
      <p class="muted small">Closed beta · early access</p>
      <div class="beta-scroll" style="max-height:50vh;margin:12px 0">
        <p><strong>RollPhase</strong> helps you find places to train, people at your level, and a cleaner multi-sport flow — then rate venues so the next athlete knows what to expect.</p>
        <p>Use one sport or many. Focus when you want; explore when you don’t. Your club colors and crest stay personal to you.</p>
        <p>This is a closed beta. Features grow with the community. Train smart, be respectful, and tell us what matters with <strong>Feedback</strong>.</p>
        <p class="muted small">If an update is available, you’ll see a prompt to restart. You can also refresh from Settings.</p>
      </div>
      <p class="muted small" id="appBuildLabelAbout" style="margin:8px 0 12px"></p>
      <button type="button" class="btn-primary" id="aboutGetLatest" style="width:100%;padding:12px">Refresh app</button>
      <button type="button" class="btn-ghost" id="aboutClose" style="width:100%;padding:12px;margin-top:8px">Close</button>
      <button type="button" class="btn-ghost" id="aboutCheckUpdate" style="width:100%;padding:12px;margin-top:8px">Check for update</button>
      <button type="button" class="btn-ghost" id="aboutReset" style="width:100%;padding:12px;margin-top:8px">Show welcome again</button>
    </div>
  `;
  document.body.appendChild(sheet);
  if (opts.historyMode !== "none") betaPushOverlay("about");
  if (typeof UpdateCheck !== "undefined") {
    try {
      UpdateCheck.paintBuildLabel();
    } catch {
      /* ignore */
    }
  }
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) betaCloseOverlay(sheet);
  });
  sheet.querySelector("#aboutClose")?.addEventListener("click", () => betaCloseOverlay(sheet));
  sheet.querySelector("#aboutGetLatest")?.addEventListener("click", () => {
    if (typeof UpdateCheck !== "undefined") {
      UpdateCheck.getLatest({ force: true });
    } else {
      location.reload();
    }
  });
  sheet.querySelector("#aboutCheckUpdate")?.addEventListener("click", async () => {
    if (typeof UpdateCheck !== "undefined") {
      const result = await UpdateCheck.check({ forceBanner: true });
      if (result === "current" && !document.getElementById("updateBanner")) {
        alert(
          window.ROLLPHASE_BUILD?.version
            ? `You’re on the latest version (${window.ROLLPHASE_BUILD.version}).`
            : "You’re on the latest version."
        );
      }
      if (result === "update") betaCloseOverlay(sheet);
    } else {
      location.reload();
    }
  });
  sheet.querySelector("#aboutReset")?.addEventListener("click", () => {
    localStorage.removeItem(BETA.storageKey);
    location.reload();
  });
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function injectBetaChrome() {
  let chrome = document.getElementById("betaChrome");
  if (!chrome) {
    chrome = document.createElement("div");
    chrome.id = "betaChrome";
    document.body.appendChild(chrome);
  }
  // Preserve Get latest if update-check already injected it
  if (!document.getElementById("btnFeedback")) {
    const fb = document.createElement("button");
    fb.type = "button";
    fb.id = "btnFeedback";
    fb.title = "Send feedback";
    fb.textContent = "Feedback";
    fb.addEventListener("click", openFeedbackSheet);
    chrome.appendChild(fb);
  }
  if (!document.getElementById("btnAbout")) {
    const ab = document.createElement("button");
    ab.type = "button";
    ab.id = "btnAbout";
    ab.title = "About";
    ab.textContent = "About";
    ab.addEventListener("click", openAboutSheet);
    chrome.appendChild(ab);
  }
}

function initBeta() {
  injectBetaChrome();
  const ready = renderBetaGate();
  if (ready) {
    window.dispatchEvent(new CustomEvent("rollphase:beta-ready"));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBeta);
} else {
  initBeta();
}
