/**
 * Nix client — local / on-device LLM bridge for RollPhase personalization.
 *
 * Production (phone):
 *   - Nix runs as mobile LLM (vision + gen) for:
 *     · logo palette extraction
 *     · club-skin suggestions (colors, pattern density)
 *     · optional generative assets (icons, strip textures)
 *   - Never injects third-party trademarks into global sport skins.
 *   - User-owned upload only; analysis stays on device when possible.
 *
 * Prototype now:
 *   - Client-side canvas palette extraction (stand-in for Nix vision)
 *   - Same async API surface so swapping to real Nix is a one-line endpoint change
 */

const NixClient = (() => {
  const ENDPOINT_KEY = "rollphase.nix.endpoint";

  function getEndpoint() {
    try {
      return localStorage.getItem(ENDPOINT_KEY) || "";
    } catch {
      return "";
    }
  }

  function setEndpoint(url) {
    try {
      localStorage.setItem(ENDPOINT_KEY, url || "");
    } catch {
      /* ignore */
    }
  }

  /**
   * Dominant colors from an image data URL (prototype Nix vision).
   * @param {string} dataUrl
   * @returns {Promise<{ primary:string, secondary:string, accent:string, pattern:string, notes:string, source:string }>}
   */
  async function analyzeLogo(dataUrl) {
    const endpoint = getEndpoint();
    if (endpoint) {
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, "")}/v1/analyze-logo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: dataUrl,
            task: "team_skin_palette",
            constraints: {
              no_trademark_sport_skin: true,
              output: ["primary", "secondary", "accent", "pattern_hint"],
            },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          return {
            primary: json.primary || "#111111",
            secondary: json.secondary || "#f5f5f5",
            accent: json.accent || json.primary || "#888888",
            pattern: json.pattern || json.pattern_hint || "rings",
            notes: json.notes || "Nix on-device analysis",
            source: "nix",
          };
        }
      } catch (e) {
        console.warn("Nix endpoint failed, falling back to local extract", e);
      }
    }
    return extractPaletteLocal(dataUrl);
  }

  /**
   * Ask Nix to refine skin from free text + optional logo (future).
   */
  async function suggestSkin({ label, colors, logoDataUrl }) {
    const endpoint = getEndpoint();
    if (endpoint) {
      try {
        const res = await fetch(`${endpoint.replace(/\/$/, "")}/v1/suggest-skin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, colors, image: logoDataUrl || null }),
        });
        if (res.ok) return { ...(await res.json()), source: "nix" };
      } catch (e) {
        console.warn("Nix suggest-skin failed", e);
      }
    }
    // Local heuristic refine
    const c = colors || {};
    return {
      primary: c.primary || "#121212",
      secondary: c.secondary || "#f0f0f0",
      accent: c.accent || "#c0c0c0",
      pattern: "stripe",
      notes: "Local refine (connect Nix for richer skins)",
      source: "local",
    };
  }

  function extractPaletteLocal(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const size = 48;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          const buckets = new Map();
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 200) continue;
            // quantize
            const r = data[i] >> 4;
            const g = data[i + 1] >> 4;
            const b = data[i + 2] >> 4;
            const key = `${r},${g},${b}`;
            buckets.set(key, (buckets.get(key) || 0) + 1);
          }
          const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
          const toHex = (key) => {
            const [r, g, b] = key.split(",").map((n) => Math.min(255, parseInt(n, 10) * 16 + 8));
            return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
          };
          const colors = sorted.slice(0, 8).map(([k]) => toHex(k));
          // Prefer dark / light extremes + a mid accent
          const lum = (hex) => {
            const n = parseInt(hex.slice(1), 16);
            const r = (n >> 16) & 255;
            const g = (n >> 8) & 255;
            const b = n & 255;
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const byLum = [...colors].sort((a, b) => lum(a) - lum(b));
          const primary = byLum[0] || "#111111";
          const secondary = byLum[byLum.length - 1] || "#f5f5f5";
          const accent = colors.find((c) => c !== primary && c !== secondary) || byLum[Math.floor(byLum.length / 2)] || "#888888";
          const contrast = Math.abs(lum(primary) - lum(secondary));
          const pattern = contrast > 100 ? "rings" : lum(primary) < 80 ? "mesh" : "stripe";
          resolve({
            primary,
            secondary,
            accent,
            pattern,
            notes: "On-device palette extract (Nix vision stand-in). Connect Nix endpoint for LLM skin gen.",
            source: "local-vision",
            samples: colors.slice(0, 6),
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Could not load image for analysis"));
      img.src = dataUrl;
    });
  }

  return { analyzeLogo, suggestSkin, getEndpoint, setEndpoint, extractPaletteLocal };
})();
