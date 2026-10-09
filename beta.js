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
    // Acceptance is the record. A later update must not bring the welcome back.
    return data?.accepted === true;
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
          <li><strong>Your privacy</strong> — your name and sports stay on this phone. Looking up places sends a rough location to the public map search. Settings has the full note, and Delete my data.</li>
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
    flushFeedback();
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

let feedbackInboxDown = false;

async function deliverFeedback(entry) {
  if (feedbackInboxDown) return false;
  const cfg = (typeof window !== "undefined" && window.ROLLPHASE_PUBLIC) || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return false;
  const body = String(entry.body || "").trim().slice(0, 2000);
  if (!body) return false;
  try {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        area: String(entry.area || "other").slice(0, 40),
        rating: Math.min(5, Math.max(1, +entry.rating || 1)),
        body,
        contact: entry.email ? String(entry.email).slice(0, 120) : null,
      }),
    });
    if (res.ok) return true;
    const text = await res.text();
    if (res.status === 404 || /PGRST205|does not exist|schema cache/i.test(text)) {
      feedbackInboxDown = true;
    }
    return false;
  } catch {
    return false;
  }
}

function readFeedbackList() {
  try {
    const list = JSON.parse(localStorage.getItem(BETA.feedbackKey) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeFeedbackList(list) {
  localStorage.setItem(BETA.feedbackKey, JSON.stringify(list.slice(-30)));
}

async function flushFeedback() {
  const list = readFeedbackList();
  let changed = false;
  for (const entry of list) {
    if (entry.sent || feedbackInboxDown) continue;
    if (await deliverFeedback(entry)) {
      entry.sent = true;
      changed = true;
    }
    if (feedbackInboxDown) break;
  }
  if (changed) writeFeedbackList(list);
}

async function submitFeedback(sheet) {
  const rating = sheet.querySelector("#fbRating")?.value;
  const area = sheet.querySelector("#fbArea")?.value;
  const body = sheet.querySelector("#fbBody")?.value?.trim();
  const email = sheet.querySelector("#fbEmail")?.value?.trim();
  const status = sheet.querySelector("#fbStatus");
  const button = sheet.querySelector("#fbSubmit");
  if (!body) {
    if (status) status.textContent = "Write a note first.";
    return;
  }
  const entry = {
    id: `fb_${Date.now()}`,
    rating: +rating,
    area,
    body,
    email: email || null,
    at: new Date().toISOString(),
    sent: false,
  };
  const list = readFeedbackList();
  list.push(entry);
  writeFeedbackList(list);
  if (button) button.disabled = true;
  if (status) status.textContent = "Sending…";
  const sent = await deliverFeedback(entry);
  if (sent) {
    entry.sent = true;
    writeFeedbackList(list);
    if (status) status.textContent = "Sent. We can read it.";
    setTimeout(() => sheet.remove(), 900);
    return;
  }
  if (button) button.disabled = false;
  if (status) {
    status.textContent = feedbackInboxDown
      ? "Saved on this phone. The inbox is not accepting notes yet."
      : "Saved on this phone. It has not reached the inbox.";
  }
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
      <p class="muted small">What it does, and how a session works</p>
      <div class="beta-scroll" style="margin:12px 0">
        <h3>What it does</h3>
        <p>Rollphase finds a place to train, shows who is on that mat, and lets you share the session. It covers many sports. Focus one when you want. Leave it open when you do not.</p>
        <h3>How it works</h3>
        <p><strong>1. Sport.</strong> Choose it from the menu at the top. Home, the map, and the list follow that sport. Change it from the same menu.</p>
        <p><strong>2. Places.</strong> Gyms lists real places near you, on a map and in a list. Call, the website, the map, and directions show up when that place lists them.</p>
        <p><strong>3. The board.</strong> Open a gym for the timetable and who is here. I’m here puts you on that board. Turn Show in “here now” off in Settings when you want to stay off it.</p>
        <p><strong>4. Share.</strong> Your profile, a gym, and a session each have a code. A phone without Rollphase installs it. A phone that already has it opens that place.</p>
        <p><strong>5. Calendars.</strong> Feed links to the official calendar for the sport. Rollphase does not invent events.</p>
        <h3>Your assistant</h3>
        <p>In Settings, Muse runs Rollphase from your own Muse account after the app premium. A Gemini key, yours, writes a short note about a place and stays on this phone. Both keeps those jobs separate. Rollphase does not pay for either.</p>
        <h3>On this phone</h3>
        <p>Your name, sports, saved places, and keys stay on this phone until you delete them. Open to train is your choice. Youth and adults stay in separate pools. Your club name and crest are yours. Settings explains what is kept.</p>
        <h3>Still growing</h3>
        <p>Partners lists people who tapped I’m in at a place near you, when their level is next to yours. Gear notes you write stay on this phone. A shop is listed only when it is real.</p>
        <h3>The agreement</h3>
        <p>This is a closed beta. Meeting people and visiting gyms is your own judgment. Use only names and logos you have the right to use. Rollphase is not a gym and not a federation. Feedback is in the top bar.</p>
        <p class="muted small">Places come from the public map. When an update is ready, a prompt asks you to restart. Refresh app is also in Settings.</p>
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
        alert("You’re up to date.");
      }
      if (result === "update") betaCloseOverlay(sheet);
    } else {
      location.reload();
    }
  });
  sheet.querySelector("#aboutReset")?.addEventListener("click", () => {
    if (!window.confirm("Show the welcome again? Your name, sports, and saved places stay on this phone.")) return;
    localStorage.removeItem(BETA.storageKey);
    try {
      history.replaceState({ rp: 1, view: "tab", tab: "home" }, "", "#/home");
    } catch {
      /* ignore */
    }
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

function openPrivacySheet() {
  document.getElementById("privacySheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "privacySheet";
  sheet.className = "feedback-overlay";
  sheet.innerHTML = `
    <div class="feedback-panel">
      <div class="sheet-handle"></div>
      <h2>What is kept</h2>
      <div class="beta-scroll" style="margin:12px 0">
        <h3>On this phone</h3>
        <p>Your name, sports, level, saved places, club crest, gear notes, notification choices, and assistant key stay on this phone.</p>
        <h3>When you look up places</h3>
        <p>Gyms sends a rough location to the public map search so it can list places near you. That starts after you accept the welcome.</p>
        <h3>The board</h3>
        <p>I’m in and check-in send the name and level you saved to that gym’s board. Show in “here now” off keeps you off it. Youth and adults stay separate.</p>
        <h3>Feedback</h3>
        <p>A note is delivered only when the inbox accepts it. A contact address is included only if you type one. Until then the note stays on this phone.</p>
        <h3>Alerts</h3>
        <p>Notification choices change what Feed emphasizes. This phone does not send lock-screen alerts.</p>
        <h3>Assistant</h3>
        <p>The Muse link is one you paste. There is no card checkout. The app premium is the account name on the Muse side. A Gemini key stays on this phone.</p>
        <h3>Delete</h3>
        <p>Delete my data clears Rollphase on this phone. If this phone had a board name, that name is removed when the board accepts the delete.</p>
      </div>
      <button type="button" class="btn-primary" id="privacyClose" style="width:100%;padding:12px">Close</button>
      <button type="button" class="btn-ghost" id="privacyDelete" style="width:100%;padding:12px;margin-top:8px">Delete my data</button>
    </div>
  `;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.remove();
  });
  sheet.querySelector("#privacyClose")?.addEventListener("click", () => sheet.remove());
  sheet.querySelector("#privacyDelete")?.addEventListener("click", () => deleteRollphaseData());
}

async function deleteRollphaseData() {
  if (
    !window.confirm(
      "Delete Rollphase data on this phone? Your name, sports, saved places, keys, gear notes, and feedback notes on this phone are removed."
    )
  ) {
    return;
  }
  let boardRemoved = false;
  try {
    const c = window.RP?.db;
    if (c) {
      const { data } = await c.auth.getSession();
      const id = data?.session?.user?.id;
      if (id) {
        const { error } = await c.from("profiles").delete().eq("id", id);
        boardRemoved = !error;
        await c.auth.signOut();
      }
    }
  } catch {
    /* the phone clear still runs */
  }
  const drop = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("rollphase.") || key.startsWith("sb-"))) drop.push(key);
  }
  drop.forEach((key) => localStorage.removeItem(key));
  const sessionDrop = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith("rollphase.")) sessionDrop.push(key);
  }
  sessionDrop.forEach((key) => sessionStorage.removeItem(key));
  window.alert(
    boardRemoved
      ? "This phone is cleared. Your board name was removed."
      : "This phone is cleared."
  );
  location.replace(`${location.pathname}${location.search}`);
}

function initBeta() {
  injectBetaChrome();
  const ready = renderBetaGate();
  if (ready) {
    window.dispatchEvent(new CustomEvent("rollphase:beta-ready"));
    flushFeedback();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBeta);
} else {
  initBeta();
}
