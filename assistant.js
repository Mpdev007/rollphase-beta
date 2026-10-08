/* Your assistant: Muse runs the app, a Gemini key writes the place note, or both.
   The Gemini key stays on this phone and is sent only to Gemini. */
const RollAssistant = (() => {
  const STORE = "rollphase.assistant.v1";
  const MODEL = "gemini-2.5-flash";

  function empty() {
    return { mode: "both", bridge: "", account: "", museToken: "", geminiKey: "", prompt: "" };
  }

  function load() {
    try {
      return { ...empty(), ...JSON.parse(localStorage.getItem(STORE) || "{}") };
    } catch {
      return empty();
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    return next;
  }

  function localPage() {
    return location.hostname === "127.0.0.1" || location.hostname === "localhost";
  }

  function bridgeBase() {
    const saved = String(load().bridge || "").trim().replace(/\/$/, "");
    if (saved) return saved;
    if (localPage()) return "http://127.0.0.1:8878";
    return "";
  }

  function mode() {
    const value = load().mode;
    return value === "muse" || value === "gemini" || value === "both" ? value : "both";
  }

  function usesMuse() {
    const value = mode();
    return value === "muse" || value === "both";
  }

  function usesGemini() {
    const value = mode();
    return value === "gemini" || value === "both";
  }

  function canAsk() {
    return usesGemini() && !!load().geminiKey;
  }

  function statusLine() {
    const saved = load();
    const parts = [];
    if (usesMuse()) {
      if (!bridgeBase()) parts.push("Add the Muse link to connect from this phone.");
      else if (saved.museToken) parts.push("Muse key is on this phone.");
      else parts.push("Muse is not connected.");
    }
    if (usesGemini()) {
      parts.push(saved.geminiKey ? "Gemini key is on this phone." : "No Gemini key yet.");
    }
    return parts.join(" ");
  }

  async function gemini(key, text, maxTokens) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
          }),
        }
      );
    } catch {
      throw new Error("This phone cannot reach Gemini.");
    }
    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) {
        throw new Error("That Gemini key was refused.");
      }
      throw new Error("Gemini did not answer.");
    }
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const answer = parts.map((part) => part.text || "").join("").trim();
    if (!answer) throw new Error("Gemini did not answer.");
    return answer;
  }

  async function checkGemini(typed) {
    const key = String(typed || load().geminiKey || "").trim();
    if (!key) throw new Error("Paste your Gemini key first.");
    await gemini(key, "Reply with the single word ready.", 8);
    save({ geminiKey: key });
    return "Gemini key works. It stays on this phone.";
  }

  async function askPlace(facts) {
    const key = load().geminiKey;
    if (!usesGemini()) throw new Error("Turn on Gemini in Settings to ask about a place.");
    if (!key) throw new Error("Add your Gemini key in Settings.");
    const lines = [
      `Name: ${facts.name || "Not listed"}`,
      `Address: ${facts.address || "Not listed"}`,
      `Distance: ${facts.miles != null && facts.miles !== "" ? `${facts.miles} mi` : "Not listed"}`,
      `Sport: ${facts.sport || "Not listed"}`,
      `Hours: ${facts.hours || "Not listed"}`,
      `Phone: ${facts.phone || "Not listed"}`,
      `Website: ${facts.website || "Not listed"}`,
      `Open: ${facts.open || "Not listed"}`,
    ];
    return gemini(
      key,
      "You help an athlete read a place they already found. Use only these facts. Do not add coaches, prices, class times, or events. If a fact says Not listed, say it is not listed. Two short sentences.\n\n" +
        lines.join("\n"),
      180
    );
  }

  async function connectMuse(account) {
    const name = String(account || "").trim();
    if (!name) throw new Error("Enter the account name on the app premium.");
    const base = bridgeBase();
    if (!base) throw new Error("Add the Muse link. This phone cannot reach a private computer.");
    let res;
    try {
      res = await fetch(`${base}/v1/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: name, app: "rollphase" }),
      });
    } catch {
      throw new Error("This phone cannot reach that Muse link.");
    }
    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    if (!res.ok) throw new Error(payload.error || "Muse did not connect.");
    save({ account: name, museToken: payload.token || "", prompt: payload.prompt || "" });
    const loopback = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
    return {
      prompt: payload.prompt || "",
      token: payload.token || "",
      note: loopback
        ? "Copy this into your Muse. A public Muse link is what a phone away from this computer can use."
        : "Copy this into your Muse. Put the connector key in Muse's secure prompt.",
    };
  }

  function bind() {
    const root = document.getElementById("assistantCard");
    if (!root) return;
    const saved = load();
    root.querySelectorAll("[data-assistant]").forEach((btn) => {
      btn.classList.add("seg-btn");
      btn.classList.toggle("active", btn.dataset.assistant === mode());
    });
    const museBlock = document.getElementById("assistantMuseBlock");
    const geminiBlock = document.getElementById("assistantGeminiBlock");
    if (museBlock) museBlock.classList.toggle("hidden", !usesMuse());
    if (geminiBlock) geminiBlock.classList.toggle("hidden", !usesGemini());
    const bridgeField = document.getElementById("assistantBridgeField");
    if (bridgeField) bridgeField.classList.toggle("hidden", localPage());
    const bridge = document.getElementById("assistantBridge");
    if (bridge && document.activeElement !== bridge) bridge.value = saved.bridge || "";
    const account = document.getElementById("assistantAccount");
    if (account && document.activeElement !== account) account.value = saved.account || "";
    const key = document.getElementById("assistantGeminiKey");
    if (key && document.activeElement !== key) {
      key.value = "";
      key.placeholder = saved.geminiKey ? "Saved on this phone" : "Paste your key";
    }
    const status = document.getElementById("assistantStatus");
    if (status && status.dataset.sticky !== "1") status.textContent = statusLine();
    const note = document.getElementById("assistantMuseNote");
    const copyBtn = document.getElementById("assistantCopyNote");
    if (note && saved.prompt) {
      note.value = saved.prompt;
      note.classList.remove("hidden");
      copyBtn?.classList.remove("hidden");
    }
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.querySelector("#assistantMode")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-assistant]");
      if (!btn) return;
      save({ mode: btn.dataset.assistant });
      const statusEl = document.getElementById("assistantStatus");
      if (statusEl) statusEl.dataset.sticky = "";
      bind();
    });
    bridge?.addEventListener("change", () => {
      save({ bridge: bridge.value.trim() });
      const statusEl = document.getElementById("assistantStatus");
      if (statusEl) statusEl.dataset.sticky = "";
      bind();
    });
    account?.addEventListener("change", () => save({ account: account.value.trim() }));
    document.getElementById("assistantMuseBtn")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("assistantStatus");
      if (statusEl) {
        statusEl.dataset.sticky = "1";
        statusEl.textContent = "Connecting Muse…";
      }
      try {
        const result = await connectMuse(document.getElementById("assistantAccount")?.value);
        if (note) {
          note.value = result.prompt;
          note.classList.remove("hidden");
        }
        copyBtn?.classList.remove("hidden");
        let line = result.note;
        if (result.token && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(result.token);
            line += " The connector key was copied.";
          } catch {
            line += " Copy the connector key from the secure prompt on the Muse page if it did not copy here.";
          }
        }
        if (statusEl) statusEl.textContent = line;
      } catch (err) {
        if (statusEl) statusEl.textContent = err.message || "Muse did not connect.";
      }
    });
    document.getElementById("assistantCopyNote")?.addEventListener("click", async () => {
      const text = document.getElementById("assistantMuseNote")?.value || "";
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        window.RollToast?.show?.("Note copied");
      } catch {
        window.RollToast?.show?.("Select the note and copy it.");
      }
    });
    document.getElementById("assistantGeminiCheck")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("assistantStatus");
      if (statusEl) {
        statusEl.dataset.sticky = "1";
        statusEl.textContent = "Checking the Gemini key…";
      }
      try {
        const line = await checkGemini(document.getElementById("assistantGeminiKey")?.value);
        if (statusEl) statusEl.textContent = line;
        bind();
        if (statusEl) {
          statusEl.dataset.sticky = "1";
          statusEl.textContent = line;
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = err.message || "That Gemini key was refused.";
      }
    });
    document.getElementById("assistantGeminiClear")?.addEventListener("click", () => {
      save({ geminiKey: "" });
      const statusEl = document.getElementById("assistantStatus");
      if (statusEl) statusEl.dataset.sticky = "";
      bind();
    });
  }

  return { bind, canAsk, askPlace, usesGemini, mode };
})();

window.RollAssistant = RollAssistant;
if (document.getElementById("assistantCard")) RollAssistant.bind();
