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

  function venueShell(partial) {
    const sports = partial.sports?.length ? partial.sports : ["weightlifting"];
    return {
      next: {},
      here: {},
      promo: {},
      social: {},
      amenities: partial.amenities || [],
      live: true,
      open: partial.open !== false,
      ...partial,
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
    // 2 queries max to respect Nominatim 1 req/s policy (sequential)
    const use = terms.slice(0, 2);
    const all = [];
    for (let i = 0; i < use.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      try {
        const rows = await withTimeout(nominatimSearch(use[i], vb), 12000, "nominatim");
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
      await new Promise((r) => setTimeout(r, 1100));
      try {
        const rows = await withTimeout(nominatimSearch("gym", vb), 12000, "nominatim");
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
      open: openNow !== false,
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
    const textQuery = SPORT_TEXT[sportId] || "gym fitness";
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

  /* ---------- Geocode city / reverse ---------- */
  async function geocodePlace(query) {
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
  }

  async function reverseGeocode(lat, lng) {
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
  }

  /**
   * Main entry — merge free sources; prefer Google when keyed.
   */
  async function fetchNearby(opts) {
    const cfg = config();
    const radiusM = opts.radiusM || cfg.defaultRadiusM || 12000;
    const base = { ...opts, radiusM };

    if (cfg.googlePlacesApiKey) {
      try {
        const places = await fetchGoogleCombined(base);
        if (places.length) return { provider: "google", places };
      } catch (e) {
        console.warn("Google Places failed, free stack next", e);
      }
    }

    // Free stack in parallel where possible (Nominatim sequential inside)
    const [nom, pho, osm] = await Promise.allSettled([
      fetchNominatimNearby(base),
      fetchPhotonNearby(base),
      fetchOsmNearby(base),
    ]);

    const parts = [];
    const sources = [];
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

    // Prefer venues with contact info when merging
    places.sort((a, b) => {
      const score = (p) => (p.phone ? 2 : 0) + (p.website ? 2 : 0) + (p.hours ? 1 : 0) - p.mi * 0.01;
      return score(b) - score(a);
    });

    return {
      provider: sources.includes("nominatim")
        ? "nominatim"
        : sources.includes("osm")
          ? "osm"
          : "photon",
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
    getCurrentPosition,
    saveLastLocation,
    loadLastLocation,
    geocodePlace,
    reverseGeocode,
    haversineMi,
    mapsSearchUrl,
    config,
    viewbox,
  };
})();
