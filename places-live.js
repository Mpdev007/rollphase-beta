/**
 * Live venue discovery — real places only (no stubs).
 *
 * Stack (highest ROI, free-first):
 *  1. Google Places (New) — if ROLLPHASE_CONFIG.googlePlacesApiKey
 *  2. Nominatim (OSM) — viewbox search + extratags (phone/website when known)
 *  3. Photon (Komoot) — bbox-biased POI search
 *  4. Overpass — optional enrichment (short timeout; public instances flaky)
 *
 * Always returns haversine distances from the user's real lat/lng.
 */
const PlacesLive = (() => {
  const UA = "RollPhase/1.0 (athlete venues; https://github.com/Mpdev007/rollphase)";

  /**
   * One FIFO queue for every Nominatim request in the app (search, reverse geocode, the
   * sport-query loop), so calls are spaced >= 1,000 ms apart by when they START — matching
   * Nominatim's 1 req/s policy — without an unconditional flat sleep that over-waits when the
   * previous request itself was slow, and without holding up unrelated data (gyms_near, or a
   * Nominatim call already in flight resolving on its own schedule).
   */
  let lastNominatimStartAt = 0;
  let nominatimChain = Promise.resolve();
  function throttledNominatim(fn) {
    const run = async () => {
      const wait = Math.max(0, lastNominatimStartAt + 1000 - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastNominatimStartAt = Date.now();
      return fn();
    };
    const result = nominatimChain.then(run, run);
    nominatimChain = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  const OVERPASS_URLS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];

  /** Sport → free-text search terms for Nominatim / Photon */
  const SPORT_QUERIES = {
    bjj: ["jiu jitsu", "brazilian jiu jitsu", "martial arts gym", "dojo", "gym"],
    mma: ["mma gym", "martial arts", "gym"],
    boxing: ["boxing gym", "gym"],
    wrestling: ["wrestling club", "gym"],
    muaythai: ["muay thai", "thai boxing", "gym"],
    kickboxing: ["kickboxing", "gym"],
    judo: ["judo", "dojo", "gym"],
    weightlifting: ["gym", "fitness centre", "weight room"],
    crossfit: ["crossfit", "gym"],
    hyrox: ["hyrox", "functional fitness", "gym"],
    pickleball: ["pickleball", "sports centre"],
    tennis: ["tennis club", "tennis court"],
    basketball: ["basketball gym", "recreation center"],
    soccer: ["soccer field", "futsal"],
    volleyball: ["volleyball"],
    pilates: ["pilates"],
    yoga: ["yoga studio", "yoga"],
    running: ["running track", "running club"],
    cycling: ["bike shop", "bicycle"],
    climbing: ["climbing gym", "bouldering"],
    swimming: ["swimming pool", "aquatic"],
  };

  const SPORT_GOOGLE_TYPE = {
    bjj: "gym",
    mma: "gym",
    boxing: "gym",
    weightlifting: "gym",
    crossfit: "gym",
    hyrox: "gym",
    pilates: "gym",
    yoga: "yoga_studio",
    swimming: "swimming_pool",
    climbing: "gym",
    tennis: "athletic_field",
    pickleball: "athletic_field",
    basketball: "athletic_field",
    soccer: "athletic_field",
    cycling: "bicycle_store",
    running: "gym",
    volleyball: "athletic_field",
    wrestling: "gym",
    muaythai: "gym",
    kickboxing: "gym",
    judo: "gym",
  };

  const SPORT_TEXT = {
    bjj: "brazilian jiu jitsu gym",
    mma: "mma gym",
    boxing: "boxing gym",
    wrestling: "wrestling club",
    muaythai: "muay thai gym",
    kickboxing: "kickboxing gym",
    judo: "judo dojo",
    weightlifting: "gym",
    crossfit: "crossfit gym",
    hyrox: "hyrox gym",
    pickleball: "pickleball courts",
    tennis: "tennis club",
    basketball: "basketball gym",
    soccer: "soccer field",
    volleyball: "volleyball courts",
    pilates: "pilates studio",
    yoga: "yoga studio",
    running: "running track",
    cycling: "bike shop",
    climbing: "climbing gym",
    swimming: "swimming pool",
  };

  function config() {
    return (typeof window !== "undefined" && window.ROLLPHASE_CONFIG) || {};
  }

  function haversineMi(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const toR = (d) => (d * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLon = toR(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function mapsSearchUrl(name, address, lat, lng) {
    const q =
      name || address
        ? [name, address].filter(Boolean).join(" ")
        : lat != null && lng != null
          ? `${lat},${lng}`
          : "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  function normalizePhone(p) {
    return p ? String(p).trim() : "";
  }

  function normalizeUrl(u) {
    if (!u) return "";
    const s = String(u).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("www.")) return `https://${s}`;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`;
    return s;
  }

  function viewbox(lat, lng, radiusM) {
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
    // left,top,right,bottom for Nominatim
    return {
      left: lng - dLng,
      top: lat + dLat,
      right: lng + dLng,
      bottom: lat - dLat,
      str: `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`,
      photon: `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`,
    };
  }

  function inferSports(tags, name) {
    const s = new Set();
    const sport = String(tags?.sport || tags?.class || "").toLowerCase();
    const n = (name || "").toLowerCase();
    const type = String(tags?.type || tags?.amenity || tags?.leisure || "").toLowerCase();
    const add = (id) => s.add(id);
    if (/jiu|jitsu|bjj|grappling/.test(n) || /jiu|brazilian/.test(sport)) add("bjj");
    if (/mma|mixed martial|ufc/.test(n) || sport === "mma") add("mma");
    if (/\bbox(ing)?\b/.test(n) || sport === "boxing") add("boxing");
    if (/wrestl/.test(n) || sport === "wrestling") add("wrestling");
    if (/muay|thai box/.test(n) || /muay/.test(sport)) add("muaythai");
    if (/kickbox/.test(n) || sport === "kickboxing") add("kickboxing");
    if (/judo/.test(n) || sport === "judo") add("judo");
    if (/crossfit|cross fit/.test(n)) add("crossfit");
    if (/hyrox|functional/.test(n)) add("hyrox");
    if (/pickle/.test(n) || sport === "pickleball") add("pickleball");
    if (/tennis/.test(n) || sport === "tennis") add("tennis");
    if (/basket|hoop/.test(n) || sport === "basketball") add("basketball");
    if (/soccer|football|futsal/.test(n) || sport === "soccer") add("soccer");
    if (/volley/.test(n) || sport === "volleyball") add("volleyball");
    if (/pilates/.test(n) || sport === "pilates") add("pilates");
    if (/yoga/.test(n) || sport === "yoga") add("yoga");
    if (/climb|boulder|crux/.test(n) || sport === "climbing") add("climbing");
    if (/swim|aquatic|pool/.test(n) || sport === "swimming" || type.includes("pool"))
      add("swimming");
    if (/bike|cycle|bicycle/.test(n) || type === "bicycle") add("cycling");
    if (/run|track/.test(n)) add("running");
    if (
      /gym|fitness|iron|strength|power|athletic|recreation/.test(n) ||
      type.includes("fitness") ||
      type === "gym"
    ) {
      add("weightlifting");
    }
    if (/dojo|martial/.test(n) || /martial/.test(sport)) {
      if (![...s].some((x) => ["bjj", "judo", "mma", "karate"].includes(x))) add("bjj");
    }
    return [...s];
  }

  function buildTagsFromBits(bits, sports) {
    const base = (bits || []).filter(Boolean).slice(0, 4);
    if (!base.length) base.push("Nearby");
    const out = {};
    (sports.length ? sports : ["weightlifting"]).forEach((sid) => {
      out[sid] = base;
    });
    return out;
  }

  const DAY = { mo: "Mo", tu: "Tu", we: "We", th: "Th", fr: "Fr", sa: "Sa", su: "Su" };

  function expandDayToken(token) {
    const parts = token.split("-").map((p) => p.trim().toLowerCase().slice(0, 2));
    const order = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const a = DAY[parts[0]];
    if (!a) return [];
    if (!parts[1]) return [a];
    const b = DAY[parts[1]];
    if (!b) return [a];
    const i = order.indexOf(a);
    const j = order.indexOf(b);
    if (i < 0 || j < 0) return [a];
    const out = [];
    for (let k = i; ; k = (k + 1) % 7) {
      out.push(order[k]);
      if (order[k] === b || out.length > 7) break;
    }
    return out;
  }

  /** true / false when the hours string is readable, otherwise null. */
  function openFromHours(hours, now = new Date()) {
    if (!hours || typeof hours !== "string") return null;
    const raw = hours.trim();
    if (/24\s*\/\s*7|open\s+24/i.test(raw)) return true;
    const keys = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const today = keys[now.getDay()];
    const minutes = now.getHours() * 60 + now.getMinutes();
    const rules = raw.split(";").map((s) => s.trim()).filter(Boolean);
    let parsed = false;
    let sawToday = false;
    let open = false;
    for (const rule of rules) {
      const m = rule.match(/^([A-Za-z]{2,9}(?:\s*-\s*[A-Za-z]{2,9})?(?:\s*,\s*[A-Za-z]{2,9}(?:\s*-\s*[A-Za-z]{2,9})?)*)\s+(.+)$/);
      if (!m) continue;
      const days = m[1].split(",").flatMap((tok) => expandDayToken(tok));
      if (!days.length) continue;
      parsed = true;
      if (!days.includes(today)) continue;
      sawToday = true;
      if (/\boff\b|\bclosed\b/i.test(m[2])) continue;
      for (const span of m[2].split(",")) {
        const tm = span.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (!tm) continue;
        let sh = +tm[1];
        let sm = +(tm[2] || 0);
        let eh = +tm[4];
        let em = +(tm[5] || 0);
        const sap = (tm[3] || "").toLowerCase();
        const eap = (tm[6] || sap).toLowerCase();
        if (sap === "pm" && sh < 12) sh += 12;
        if (sap === "am" && sh === 12) sh = 0;
        if (eap === "pm" && eh < 12) eh += 12;
        if (eap === "am" && eh === 12) eh = 0;
        if (sh > 23 || eh > 24) continue;
        const start = sh * 60 + sm;
        let end = eh * 60 + em;
        let nowM = minutes;
        if (end <= start) {
          end += 1440;
          if (nowM < start) nowM += 1440;
        }
        if (nowM >= start && nowM <= end) open = true;
      }
    }
    if (!parsed) return null;
    if (!sawToday) return false;
    return open;
  }

  function venueShell(partial) {
    const sports = partial.sports?.length ? partial.sports : ["weightlifting"];
    const open = partial.open === true ? true : partial.open === false ? false : null;
    return {
      next: {},
      here: {},
      promo: {},
      social: {},
      amenities: partial.amenities || [],
      live: true,
      ...partial,
      open,
      sports,
      tags: partial.tags || buildTagsFromBits(partial.tagBits, sports),
    };
  }

  function dedupePlaces(places) {
    const seen = new Set();
    const unique = [];
    places
      .filter(Boolean)
      .sort((a, b) => a.mi - b.mi)
      .forEach((p) => {
        const key = `${(p.name || "").toLowerCase()}|${Number(p.lat).toFixed(3)}|${Number(p.lng).toFixed(3)}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(p);
      });
    return unique;
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label || "request"} timeout`)), ms);
      promise.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  /* ---------- Nominatim (primary free path — proven reliable) ---------- */
  async function nominatimSearch(q, vb) {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", q);
    u.searchParams.set("format", "json");
    u.searchParams.set("limit", "20");
    u.searchParams.set("viewbox", vb.str);
    u.searchParams.set("bounded", "1");
    u.searchParams.set("addressdetails", "1");
    u.searchParams.set("extratags", "1");
    u.searchParams.set("namedetails", "0");
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return res.json();
  }

  function nominatimToPlace(item, userLat, userLng, sportId) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    const et = item.extratags || {};
    const name =
      item.name ||
      item.namedetails?.name ||
      (item.display_name || "").split(",")[0] ||
      "Venue";
    // Skip pure road/admin noise
    if (["road", "administrative", "postcode", "suburb"].includes(item.type) && !/gym|fitness|dojo|yoga|climb|pool|martial/i.test(name)) {
      return null;
    }
    const phone = et.phone || et["contact:phone"] || "";
    const website = et.website || et["contact:website"] || et.url || "";
    const hours = et.opening_hours || "";
    const knownOpen = openFromHours(hours);
    const address = item.display_name || "";
    const mi = Math.round(haversineMi(userLat, userLng, lat, lng) * 10) / 10;
    const sports = inferSports(
      { sport: et.sport || item.type, amenity: item.type, class: item.class },
      name
    );
    if (sportId && !sports.includes(sportId)) {
      // keep but mark generic fitness so sport filter can still rank
      if (!sports.length) sports.push("weightlifting");
    }
    const osmType = item.osm_type === "way" ? "way" : item.osm_type === "relation" ? "relation" : "node";
    return venueShell({
      id: `nom-${item.osm_type || "n"}-${item.osm_id || item.place_id}`,
      source: "nominatim",
      name,
      mi,
      hours,
      open: knownOpen,
      phone: normalizePhone(phone),
      website: normalizeUrl(website),
      address,
      lat,
      lng,
      mapsUrl: mapsSearchUrl(name, address, lat, lng),
      osmUrl: item.osm_id
        ? `https://www.openstreetmap.org/${osmType}/${item.osm_id}`
        : undefined,
      sports: sports.length ? sports : sportId ? [sportId, "weightlifting"] : ["weightlifting"],
      tagBits: [
        phone ? "Phone" : null,
        website ? "Website" : null,
        hours ? "Hours" : null,
      ],
    });
  }

  async function fetchNominatimNearby({ lat, lng, radiusM = 12000, sportId = null }) {
    const vb = viewbox(lat, lng, radiusM);
    const terms = (sportId && SPORT_QUERIES[sportId]) || ["gym", "fitness centre", "dojo"];
    // 2 queries max to respect Nominatim 1 req/s policy (paced by the shared throttle below)
    const use = terms.slice(0, 2);
    const all = [];
    for (let i = 0; i < use.length; i++) {
      try {
        const rows = await throttledNominatim(() => withTimeout(nominatimSearch(use[i], vb), 12000, "nominatim"));
        rows.forEach((row) => {
          const p = nominatimToPlace(row, lat, lng, sportId);
          if (p && p.mi <= (radiusM / 1609.34) * 1.15) all.push(p);
        });
      } catch (e) {
        console.warn("Nominatim query failed", use[i], e);
      }
    }
    // Always include a plain "gym" pass if sport-specific returned little
    if (all.length < 5 && !use.includes("gym")) {
      try {
        const rows = await throttledNominatim(() => withTimeout(nominatimSearch("gym", vb), 12000, "nominatim"));
        rows.forEach((row) => {
          const p = nominatimToPlace(row, lat, lng, sportId);
          if (p) all.push(p);
        });
      } catch (e) {
        console.warn("Nominatim gym pass failed", e);
      }
    }
    return dedupePlaces(all);
  }

  /* ---------- Photon ---------- */
  async function fetchPhotonNearby({ lat, lng, radiusM = 12000, sportId = null }) {
    const vb = viewbox(lat, lng, radiusM);
    const q =
      (sportId && SPORT_TEXT[sportId]) ||
      (sportId && SPORT_QUERIES[sportId]?.[0]) ||
      "fitness centre gym";
    const u = new URL("https://photon.komoot.io/api/");
    u.searchParams.set("q", q);
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lng));
    u.searchParams.set("limit", "25");
    u.searchParams.set("bbox", vb.photon);
    const res = await withTimeout(
      fetch(u.toString(), { headers: { Accept: "application/json", "User-Agent": UA } }),
      10000,
      "photon"
    );
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    const places = (data.features || []).map((f) => {
      const props = f.properties || {};
      const [plng, plat] = f.geometry?.coordinates || [];
      if (plat == null || plng == null) return null;
      const name = props.name || props.street || "Venue";
      const address = [props.housenumber, props.street, props.city, props.state]
        .filter(Boolean)
        .join(", ");
      const mi = Math.round(haversineMi(lat, lng, plat, plng) * 10) / 10;
      const sports = inferSports({ sport: props.osm_value, amenity: props.osm_key }, name);
      return venueShell({
        id: `pho-${props.osm_type || "n"}-${props.osm_id || name}`,
        source: "photon",
        name,
        mi,
        hours: "",
        phone: "",
        website: "",
        address,
        lat: plat,
        lng: plng,
        mapsUrl: mapsSearchUrl(name, address, plat, plng),
        osmUrl: props.osm_id
          ? `https://www.openstreetmap.org/${props.osm_type === "W" ? "way" : props.osm_type === "R" ? "relation" : "node"}/${props.osm_id}`
          : undefined,
        sports: sports.length ? sports : ["weightlifting"],
        tagBits: [],
      });
    });
    return dedupePlaces(places.filter(Boolean));
  }

  /* ---------- Overpass (best-effort, non-blocking) ---------- */
  async function overpassFetch(query) {
    let lastErr;
    for (const base of OVERPASS_URLS) {
      try {
        const res = await withTimeout(
          fetch(base, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              "User-Agent": UA,
            },
            body: `data=${encodeURIComponent(query)}`,
          }),
          14000,
          "overpass"
        );
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Overpass failed");
  }

  async function fetchOsmNearby({ lat, lng, radiusM = 10000 }) {
    const r = Math.round(radiusM);
    const q = `[out:json][timeout:12];
(
  nwr["leisure"="fitness_centre"](around:${r},${lat},${lng});
  nwr["leisure"="sports_centre"](around:${r},${lat},${lng});
  nwr["leisure"="dojo"](around:${r},${lat},${lng});
  nwr["amenity"="gym"](around:${r},${lat},${lng});
  nwr["sport"="martial_arts"](around:${r},${lat},${lng});
  nwr["leisure"="swimming_pool"](around:${r},${lat},${lng});
  nwr["sport"="climbing"](around:${r},${lat},${lng});
);
out center tags 40;`;
    const data = await overpassFetch(q);
    return dedupePlaces(
      (data.elements || [])
        .map((el) => {
          const tags = el.tags || {};
          const plat = el.lat ?? el.center?.lat;
          const plng = el.lon ?? el.center?.lon;
          if (plat == null || plng == null) return null;
          if (!tags.name) return null; // skip unnamed buildings
          const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "";
          const website =
            tags.website || tags["contact:website"] || tags.url || tags["contact:facebook"] || "";
          const hours = tags.opening_hours || "";
          const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
            .filter(Boolean)
            .join(" ");
          const mi = Math.round(haversineMi(lat, lng, plat, plng) * 10) / 10;
          const sports = inferSports(tags, tags.name);
          const osmType = el.type || "node";
          return venueShell({
            id: `osm-${osmType}-${el.id}`,
            source: "osm",
            name: tags.name,
            mi,
            hours,
            open: openFromHours(hours),
            phone: normalizePhone(phone),
            website: normalizeUrl(website),
            address,
            lat: plat,
            lng: plng,
            mapsUrl: mapsSearchUrl(tags.name, address, plat, plng),
            osmUrl: `https://www.openstreetmap.org/${osmType}/${el.id}`,
            sports: sports.length ? sports : ["weightlifting"],
            tagBits: [
              phone ? "Phone" : null,
              website ? "Website" : null,
            ],
            amenities: tags.leisure === "dojo" ? ["mats"] : tags.leisure === "fitness_centre" ? ["racks"] : [],
          });
        })
        .filter(Boolean)
    );
  }

  /* ---------- Google Places (optional key) ---------- */
  const GOOGLE_FIELD_MASK =
    "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours,places.businessStatus,places.types";

  function googlePlaceToVenue(p, userLat, userLng, sportId) {
    const plat = p.location?.latitude;
    const plng = p.location?.longitude;
    const mi = plat != null ? Math.round(haversineMi(userLat, userLng, plat, plng) * 10) / 10 : 0;
    const name = p.displayName?.text || "Venue";
    const openNow = p.regularOpeningHours?.openNow;
    const hoursText = (p.regularOpeningHours?.weekdayDescriptions || []).join(" · ");
    const sports = sportId
      ? [sportId, ...inferSports({ sport: (p.types || []).join(" ") }, name)]
      : inferSports({ sport: (p.types || []).join(" ") }, name);
    const sportList = [...new Set(sports.length ? sports : ["weightlifting"])];
    return venueShell({
      id: `ggl-${p.id || name}`,
      source: "google",
      placeId: p.id,
      name,
      mi,
      open: typeof openNow === "boolean" ? openNow : null,
      hours: hoursText || "",
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
      website: normalizeUrl(p.websiteUri || ""),
      address: p.formattedAddress || "",
      lat: plat,
      lng: plng,
      mapsUrl: p.googleMapsUri || mapsSearchUrl(name, p.formattedAddress, plat, plng),
      googleRating: p.rating,
      googleRatingCount: p.userRatingCount,
      sports: sportList,
      tagBits: [
        p.rating ? `★ ${p.rating}` : null,
        p.nationalPhoneNumber ? "Phone" : null,
        p.websiteUri ? "Website" : null,
      ],
    });
  }

  async function fetchGoogleNearby({ lat, lng, radiusM = 10000, sportId = null }) {
    const key = config().googlePlacesApiKey;
    if (!key) throw new Error("No Google Places API key");
    const includedType = SPORT_GOOGLE_TYPE[sportId] || "gym";
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: [includedType],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: radiusM },
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Google Nearby ${res.status}: ${t.slice(0, 160)}`);
    }
    const data = await res.json();
    return (data.places || []).map((p) => googlePlaceToVenue(p, lat, lng, sportId));
  }

  async function fetchGoogleText({ lat, lng, radiusM = 10000, sportId = null }) {
    const key = config().googlePlacesApiKey;
    if (!key) throw new Error("No Google Places API key");
    const city = String(opts.label || "").split(",")[0].trim();
    const textQuery = [SPORT_TEXT[sportId] || "gym fitness", city].filter(Boolean).join(" ");
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 20,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: radiusM },
        },
      }),
    });
    if (!res.ok) throw new Error(`Google Text ${res.status}`);
    const data = await res.json();
    return (data.places || []).map((p) => googlePlaceToVenue(p, lat, lng, sportId));
  }

  async function fetchGoogleCombined(opts) {
    const [a, b] = await Promise.allSettled([
      fetchGoogleNearby(opts),
      opts.sportId ? fetchGoogleText(opts) : Promise.resolve([]),
    ]);
    const list = [
      ...(a.status === "fulfilled" ? a.value : []),
      ...(b.status === "fulfilled" ? b.value : []),
    ];
    if (!list.length) {
      throw a.status === "rejected" ? a.reason : b.reason || new Error("Google empty");
    }
    return dedupePlaces(list);
  }

  /* ---------- Geocode city / reverse (also through the shared throttle: 1 req/s app-wide) ---------- */
  async function geocodePlace(query) {
    return throttledNominatim(async () => {
      const u = new URL("https://nominatim.openstreetmap.org/search");
      u.searchParams.set("q", query);
      u.searchParams.set("format", "json");
      u.searchParams.set("limit", "1");
      const res = await fetch(u.toString(), {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!res.ok) throw new Error(`Geocode ${res.status}`);
      const rows = await res.json();
      if (!rows.length) throw new Error("Place not found");
      return {
        lat: parseFloat(rows[0].lat),
        lng: parseFloat(rows[0].lon),
        label: rows[0].display_name,
      };
    });
  }

  async function reverseGeocode(lat, lng) {
    return throttledNominatim(async () => {
      try {
        const u = new URL("https://nominatim.openstreetmap.org/reverse");
        u.searchParams.set("lat", String(lat));
        u.searchParams.set("lon", String(lng));
        u.searchParams.set("format", "json");
        const res = await fetch(u.toString(), {
          headers: { Accept: "application/json", "User-Agent": UA },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const a = data.address || {};
        return a.city || a.town || a.village || a.suburb || a.county || data.name || null;
      } catch {
        return null;
      }
    });
  }

  /* ---------- I5: the app-owned venue cache, checked before any OSM call ---------- */

  /** Standard 5-character geohash (~4.9 x 4.9 km cells) — no external dependency. */
  function geohash5(lat, lng) {
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let latRange = [-90, 90],
      lngRange = [-180, 180];
    let hash = "",
      bit = 0,
      ch = 0,
      evenBit = true;
    while (hash.length < 5) {
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          ch |= 1 << (4 - bit);
          lngRange[0] = mid;
        } else lngRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          ch |= 1 << (4 - bit);
          latRange[0] = mid;
        } else latRange[1] = mid;
      }
      evenBit = !evenBit;
      if (bit < 4) bit++;
      else {
        hash += BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }
    return hash;
  }

  const OSM_AREA_PREFIX = "rollphase.osmArea.";
  const OSM_AREA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function areaQueriedRecently(lat, lng) {
    try {
      const at = +(localStorage.getItem(OSM_AREA_PREFIX + geohash5(lat, lng)) || 0);
      return at > 0 && Date.now() - at < OSM_AREA_MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  function markAreaQueried(lat, lng) {
    try {
      localStorage.setItem(OSM_AREA_PREFIX + geohash5(lat, lng), String(Date.now()));
    } catch {
      /* private mode / quota */
    }
  }

  const round3 = (n) => Math.round(n * 1000) / 1000;
  const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function fmtSlotClock(startMin) {
    const h24 = Math.floor(startMin / 60);
    const m = startMin % 60;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  /** Minutes from now until this week's (or next week's) occurrence of a weekday+start_min slot. */
  function minutesUntilOccurrence(weekday, startMin, now) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let dayDelta = weekday - now.getDay();
    if (dayDelta < 0 || (dayDelta === 0 && startMin < nowMin)) dayDelta += 7;
    return dayDelta * 1440 + (startMin - nowMin);
  }

  /**
   * Step 9: "Next open mat: <weekday time>" (plus gear and the drop-in fee, when set) for a card
   * with boardSlots > 0 — folded into venueShell's existing `next[sport]` field so app.js's
   * (unchanged) gymCardHTML renders it exactly like any other next-class line.
   */
  function nextOpenMatLine(slotRows, sport, dropinFee, now) {
    const upcoming = slotRows
      .filter((s) => s.sport === sport && s.audience === "adult" && !s.removed_at)
      .map((s) => ({ ...s, inMin: minutesUntilOccurrence(s.weekday, s.start_min, now) }))
      .sort((a, b) => a.inMin - b.inMin);
    if (!upcoming.length) return null;
    const soonest = upcoming[0];
    const gear = (soonest.gear || []).join(", ");
    const bits = [`Next open mat: ${WEEKDAY_SHORT[soonest.weekday]} ${fmtSlotClock(soonest.start_min)}`];
    if (gear) bits.push(gear);
    if (dropinFee) bits.push(dropinFee);
    return bits.join(" · ");
  }

  /** RollPhase's own gyms, from Supabase — the venue any member has ever opened or added. */
  async function fetchOwnVenues({ lat, lng, radiusM }) {
    if (typeof window === "undefined" || !window.RP || !window.RP.db) return [];
    try {
      const { data: rows, error } = await window.RP.db.rpc("gyms_near", {
        p_lat: round3(lat),
        p_lng: round3(lng),
        p_km: radiusM / 1000,
      });
      if (error || !rows) return [];
      const ids = rows.map((r) => r.id);
      let sportsByGym = new Map();
      let slotsByGym = new Map();
      let detailsByGym = new Map();
      if (ids.length) {
        const [{ data: slotRows }, { data: gymRows }] = await Promise.all([
          window.RP.db.from("board_slots").select("gym_id,sport,weekday,start_min,gear,audience,removed_at").in("gym_id", ids),
          // gyms_near's own columns don't include address/phone/website/source — a native venue
          // (source != 'osm') needs these from the gyms row so the venue facts block can render
          // them exactly like OSM facts (step 6's own requirement).
          window.RP.db.from("gyms").select("id,address,phone,website,source").in("id", ids),
        ]);
        for (const s of slotRows || []) {
          if (!sportsByGym.has(s.gym_id)) sportsByGym.set(s.gym_id, new Set());
          sportsByGym.get(s.gym_id).add(s.sport);
          if (!slotsByGym.has(s.gym_id)) slotsByGym.set(s.gym_id, []);
          slotsByGym.get(s.gym_id).push(s);
        }
        for (const g of gymRows || []) detailsByGym.set(g.id, g);
      }
      const now = new Date();
      return rows.map((r) => {
        const detail = detailsByGym.get(r.id) || {};
        const sports = [...(sportsByGym.get(r.id) || [])];
        const slotCount = Number(r.slot_count) || 0;
        const next = {};
        if (slotCount > 0) {
          for (const sport of sports) {
            const line = nextOpenMatLine(slotsByGym.get(r.id) || [], sport, r.dropin_fee, now);
            if (line) next[sport] = line;
          }
        }
        return venueShell({
          id: r.id,
          source: detail.source || "own",
          name: r.name,
          city: r.city || "",
          address: detail.address || "",
          phone: detail.phone || "",
          website: detail.website || "",
          dropinFee: r.dropin_fee || null,
          mi: Math.round(r.km * 0.621371 * 10) / 10,
          lat: r.lat,
          lng: r.lng,
          boardSlots: slotCount,
          sports,
          next,
          mapsUrl: mapsSearchUrl(r.name, detail.address || r.city || "", r.lat, r.lng),
        });
      });
    } catch (e) {
      console.warn("gyms_near failed", e);
      return [];
    }
  }

  /**
   * Main entry — RollPhase's own venue cache first, OSM/Google only as needed.
   * app.js's own boot sequence calls this twice back to back (once from switchTab("home"), once
   * forced right after) before either call's own gyms_near step can resolve. Without
   * de-duplication both calls would race their own independent OSM fetches against each other,
   * so a "before any OSM call" guarantee that holds *within* one call wouldn't hold *across* two
   * overlapping ones. Concurrent calls for the same area collapse into a single real sequence.
   */
  const inFlightNearby = new Map();
  function fetchNearby(opts) {
    const key = `${round3(opts.lat)},${round3(opts.lng)},${opts.radiusM || 0},${opts.sportId || ""}`;
    if (inFlightNearby.has(key)) return inFlightNearby.get(key);
    const p = fetchNearbyUncached(opts);
    inFlightNearby.set(key, p);
    // This chain's own result is never awaited by anyone (the caller gets `p` itself), so if it
    // rejects it becomes an unhandled promise rejection — surfaces as a pageerror in a real
    // browser even though the caller of fetchNearby() still sees and can handle the rejection.
    p.finally(() => {
      if (inFlightNearby.get(key) === p) inFlightNearby.delete(key);
    }).catch(() => {});
    return p;
  }

  async function fetchNearbyUncached(opts) {
    const cfg = config();
    const radiusM = opts.radiusM || cfg.defaultRadiusM || 12000;
    const base = { ...opts, radiusM };

    const own = await fetchOwnVenues(base);
    const skipOsm = own.length >= 5 || areaQueriedRecently(base.lat, base.lng);
    if (skipOsm) {
      return { provider: own.length ? "own" : "nominatim", places: own, sources: own.length ? ["own"] : [] };
    }

    if (cfg.googlePlacesApiKey) {
      try {
        const places = await fetchGoogleCombined(base);
        if (places.length) return { provider: "google", places: dedupePlaces([...own, ...places]), sources: ["own", "google"] };
      } catch (e) {
        console.warn("Google Places failed, free stack next", e);
      }
    }

    // Free stack in parallel where possible (Nominatim throttled to 1 req/s inside)
    const [nom, pho, osm] = await Promise.allSettled([
      fetchNominatimNearby(base),
      fetchPhotonNearby(base),
      fetchOsmNearby(base),
    ]);
    markAreaQueried(base.lat, base.lng);

    const parts = [...own];
    const sources = own.length ? ["own"] : [];
    if (nom.status === "fulfilled" && nom.value.length) {
      parts.push(...nom.value);
      sources.push("nominatim");
    }
    if (pho.status === "fulfilled" && pho.value.length) {
      parts.push(...pho.value);
      sources.push("photon");
    }
    if (osm.status === "fulfilled" && osm.value.length) {
      parts.push(...osm.value);
      sources.push("osm");
    }

    const places = dedupePlaces(parts);
    if (!places.length) {
      const err =
        nom.status === "rejected"
          ? nom.reason
          : pho.status === "rejected"
            ? pho.reason
            : new Error("No live venues found in this area");
      throw err;
    }

    // Prefer venues with contact info when merging, but keep RollPhase's own venues on top —
    // they carry the schedule this app is for.
    places.sort((a, b) => {
      const score = (p) => (p.source === "own" ? 100 : 0) + (p.phone ? 2 : 0) + (p.website ? 2 : 0) + (p.hours ? 1 : 0) - p.mi * 0.01;
      return score(b) - score(a);
    });

    return {
      provider: sources.includes("nominatim")
        ? "nominatim"
        : sources.includes("osm")
          ? "osm"
          : sources.includes("photon")
            ? "photon"
            : "own",
      places,
      sources,
    };
  }

  const LOC_KEY = "rollphase.lastLocation.v1";

  function saveLastLocation(pos) {
    try {
      localStorage.setItem(
        LOC_KEY,
        JSON.stringify({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          label: pos.label || null,
          at: Date.now(),
        })
      );
    } catch {
      /* private mode */
    }
  }

  function loadLastLocation(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    try {
      const raw = localStorage.getItem(LOC_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d?.lat == null || d?.lng == null) return null;
      if (maxAgeMs && d.at && Date.now() - d.at > maxAgeMs) return null;
      return {
        lat: +d.lat,
        lng: +d.lng,
        accuracy: d.accuracy,
        label: d.label || null,
        fromCache: true,
        at: d.at,
      };
    } catch {
      return null;
    }
  }

  function geoOnce(opts) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(Object.assign(new Error("Geolocation API missing"), { code: 0 }));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            fromCache: false,
          }),
        (err) => reject(err),
        opts
      );
    });
  }

  /**
   * Phone-native location:
   * 1) optional Permissions API
   * 2) fast low-accuracy fix (works better on cellular)
   * 3) high-accuracy retry
   * 4) recent last-known localStorage fallback
   * Requires HTTPS (secure context) on real phones.
   */
  async function getCurrentPosition(options = {}) {
    const allowCache = options.allowCache !== false;

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      const cached = allowCache ? loadLastLocation() : null;
      if (cached) return cached;
      const err = new Error(
        "Location needs a secure connection. Open RollPhase from your usual link, or search a city."
      );
      err.code = 0;
      err.secure = false;
      throw err;
    }

    if (!navigator.geolocation) {
      const cached = allowCache ? loadLastLocation() : null;
      if (cached) return cached;
      throw Object.assign(new Error("Location not available on this device"), { code: 0 });
    }

    // Permissions API — surface denied early with clearer UX
    try {
      if (navigator.permissions?.query) {
        const st = await navigator.permissions.query({ name: "geolocation" });
        if (st.state === "denied") {
          const cached = allowCache ? loadLastLocation() : null;
          if (cached) return { ...cached, permissionDenied: true };
          const err = new Error(
            "Location is blocked for this site. Allow it in your phone settings, or type a city."
          );
          err.code = 1;
          throw err;
        }
      }
    } catch (e) {
      if (e && e.code === 1) throw e;
      /* Safari may throw on permissions.query — ignore */
    }

    // Pass 1: network/wifi-ish, faster
    try {
      const pos = await geoOnce({
        enableHighAccuracy: false,
        timeout: options.timeout || 12000,
        maximumAge: options.maximumAge ?? 120000,
      });
      saveLastLocation(pos);
      return pos;
    } catch (e1) {
      // Pass 2: GPS high accuracy
      try {
        const pos = await geoOnce({
          enableHighAccuracy: true,
          timeout: options.timeout || 18000,
          maximumAge: 0,
        });
        saveLastLocation(pos);
        return pos;
      } catch (e2) {
        const cached = allowCache ? loadLastLocation() : null;
        if (cached) return cached;
        throw e2 || e1;
      }
    }
  }

  return {
    fetchNearby,
    fetchNominatimNearby,
    fetchPhotonNearby,
    fetchOsmNearby,
    fetchGoogleNearby,
    fetchOwnVenues,
    getCurrentPosition,
    saveLastLocation,
    loadLastLocation,
    geocodePlace,
    reverseGeocode,
    haversineMi,
    mapsSearchUrl,
    config,
    viewbox,
    openFromHours,
    geohash5,
    areaQueriedRecently,
    markAreaQueried,
  };
})();
