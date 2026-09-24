/* RollPhase catalog — sports metadata only. Venues/events/partners are live or empty (no fake listings).
 * depth: "full" = rich events + pro athlete ROI surfaces
 *        "template" = consistent shell, lighter mock (not fully implemented)
 */

const DEFAULT_GYM_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open now" },
  { id: "classes", label: "Classes" },
  { id: "near", label: "≤ 5 mi" },
];
const DEFAULT_PARTNER_FILTERS = [
  { id: "all", label: "All levels" },
  { id: "match", label: "My level" },
  { id: "near", label: "≤ 3 mi" },
];

function sportDef(partial) {
  return {
    ranks: false,
    depth: "template",
    gymFilters: DEFAULT_GYM_FILTERS,
    partnerFilters: DEFAULT_PARTNER_FILTERS,
    homeGymTitle: "Venues near you",
    homePartnerTitle: "Partners open now",
    homeEventTitle: "Upcoming",
    gymsTitle: "Venues",
    partnersTitle: "Partners",
    gearTitle: "Gear",
    feedTitle: "Feed",
    roiSurfaces: ["classes", "open now", "local partners"],
    ...partial,
  };
}

const SPORTS = [
  sportDef({
    id: "bjj",
    name: "Brazilian Jiu-Jitsu",
    short: "BJJ",
    icon: "assets/sports/bjj.jpg",
    vibe: "Mat culture",
    blurb: "Belts, open mats, brackets, partners — BJJ for every academy. Your club vibe lives on your profile.",
    ranks: true,
    depth: "full",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "openmat", label: "Open mat" },
      { id: "gi", label: "Gi / No-Gi" },
    ],
    partnerFilters: [
      { id: "all", label: "All belts" },
      { id: "match", label: "My belt ±1" },
      { id: "near", label: "≤ 3 mi" },
    ],
    homeGymTitle: "Mats near you",
    homePartnerTitle: "Rolling partners",
    homeEventTitle: "Tournaments & open mats",
    gymsTitle: "Academies",
    partnersTitle: "Training partners",
    gearTitle: "Gi & gear",
    roiSurfaces: [
      "belt match",
      "open mat",
      "IBJJF / local brackets",
      "seminar alerts",
      "who is on mats now",
      "profile: I represent… (club vibe)",
    ],
  }),
  sportDef({
    id: "mma",
    name: "MMA",
    short: "MMA",
    icon: "assets/sports/mma.jpg",
    vibe: "Octagon night",
    blurb: "Cage energy. Sparring, fight cards, gyms with bags.",
    depth: "template",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "cage", label: "Has cage" },
      { id: "spar", label: "Spar night" },
    ],
    homeGymTitle: "Fight gyms",
    homePartnerTitle: "Spar partners",
    homeEventTitle: "Fight-night cards",
    gymsTitle: "Gyms & cages",
    partnersTitle: "Sparring partners",
    gearTitle: "Fight gear",
    roiSurfaces: ["spar nights", "cage access", "fight card watch", "weight cut partners"],
  }),
  sportDef({
    id: "boxing",
    name: "Boxing",
    short: "Boxing",
    icon: "assets/sports/boxing.jpg",
    vibe: "Ring prestige",
    blurb: "Leather & gold. Rings, bags, mitt work.",
    depth: "template",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "ring", label: "Has ring" },
      { id: "bags", label: "Heavy bags" },
    ],
    homeGymTitle: "Ring gyms",
    homePartnerTitle: "Pad partners",
    gymsTitle: "Boxing gyms",
    gearTitle: "Gloves & gear",
    roiSurfaces: ["ring time", "amateur shows", "spar sessions"],
  }),
  sportDef({
    id: "wrestling",
    name: "Wrestling",
    short: "Wrestling",
    icon: "assets/sports/wrestling.jpg",
    vibe: "Collegiate grit",
    blurb: "Live goes, rooms, dual meets.",
    depth: "template",
    homeGymTitle: "Wrestling rooms",
    homePartnerTitle: "Live partners",
    roiSurfaces: ["open mat", "tournament brackets", "weight classes"],
  }),
  sportDef({
    id: "muaythai",
    name: "Muay Thai",
    short: "Muay Thai",
    icon: "assets/sports/muaythai.jpg",
    vibe: "Temple fight",
    blurb: "Pads, clinch, fight nights — gyms that run real pads and fight team calendars.",
    depth: "full",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "pads", label: "Pad class" },
      { id: "fightteam", label: "Fight team" },
    ],
    homeGymTitle: "Camps near you",
    homePartnerTitle: "Pad partners",
    homeEventTitle: "Fights & smoker's",
    gymsTitle: "Camps & gyms",
    partnersTitle: "Training partners",
    gearTitle: "Gloves & shins",
    roiSurfaces: ["pad class times", "fight team callouts", "smoker cards", "clinch partners"],
  }),
  sportDef({
    id: "kickboxing",
    name: "Kickboxing",
    short: "Kickboxing",
    icon: "assets/sports/kickboxing.jpg",
    vibe: "Neon strike",
    blurb: "Classes, sparring, K-1 style cards.",
    depth: "template",
    homeGymTitle: "Strike gyms",
    homePartnerTitle: "Spar partners",
    roiSurfaces: ["class schedule", "spar nights", "amateur cards"],
  }),
  sportDef({
    id: "judo",
    name: "Judo",
    short: "Judo",
    icon: "assets/sports/judo.jpg",
    vibe: "Dojo focus",
    blurb: "Randori, belt ranks, IJF & local shiai calendars.",
    ranks: true,
    depth: "template",
    homeGymTitle: "Dojos near you",
    homePartnerTitle: "Randori partners",
    homeEventTitle: "Shiai & camps",
    gymsTitle: "Dojos",
    roiSurfaces: ["randori hours", "shiai dates", "rank exams"],
  }),
  sportDef({
    id: "weightlifting",
    name: "Weightlifting",
    short: "Lifting",
    icon: "assets/sports/weightlifting.jpg",
    vibe: "Iron temple",
    blurb: "Platforms, meets, session partners.",
    depth: "template",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "platform", label: "Platforms" },
      { id: "24h", label: "24h" },
    ],
    homeGymTitle: "Strength floors",
    homePartnerTitle: "Session partners",
    roiSurfaces: ["open platform", "local meets", "programming partners"],
  }),
  sportDef({
    id: "crossfit",
    name: "CrossFit",
    short: "CrossFit",
    icon: "assets/sports/crossfit.jpg",
    vibe: "Garage energy",
    blurb: "WOD clock, boxes, partner WODs.",
    depth: "template",
    homeGymTitle: "Boxes nearby",
    homePartnerTitle: "WOD partners",
    roiSurfaces: ["next WOD", "Open / Quarterfinals", "Rx partners"],
  }),
  sportDef({
    id: "hyrox",
    name: "HYROX",
    short: "HYROX",
    icon: "assets/sports/hyrox.jpg",
    vibe: "Race industrial",
    blurb: "Race calendar, partner doubles, gyms with sleds & stations.",
    depth: "full",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "sled", label: "Sled / stations" },
      { id: "classes", label: "HYROX class" },
    ],
    homeGymTitle: "Training centers",
    homePartnerTitle: "Doubles partners",
    homeEventTitle: "Race calendar",
    gymsTitle: "HYROX gyms",
    partnersTitle: "Race partners",
    gearTitle: "Race kit",
    roiSurfaces: ["race registration windows", "doubles partner match", "station-equipped gyms", "sim days"],
  }),
  sportDef({
    id: "pickleball",
    name: "Pickleball",
    short: "Pickleball",
    icon: "assets/sports/pickleball.jpg",
    vibe: "Social court",
    blurb: "Fastest-growing court sport — open play, DUPR, ladder nights, tournaments.",
    depth: "full",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open play" },
      { id: "indoor", label: "Indoor" },
      { id: "tournament", label: "Hosts events" },
    ],
    partnerFilters: [
      { id: "all", label: "All DUPR" },
      { id: "match", label: "My DUPR ±0.5" },
      { id: "near", label: "≤ 5 mi" },
    ],
    homeGymTitle: "Courts near you",
    homePartnerTitle: "Hit partners",
    homeEventTitle: "Open play & tournaments",
    gymsTitle: "Clubs & courts",
    partnersTitle: "Court partners",
    gearTitle: "Paddles & balls",
    roiSurfaces: ["open play windows", "DUPR match", "ladder / league nights", "PPA / local brackets", "court booking"],
  }),
  sportDef({
    id: "tennis",
    name: "Tennis",
    short: "Tennis",
    icon: "assets/sports/tennis.jpg",
    vibe: "Clay & hardcourt",
    blurb: "Courts, clinics, USTA ladders, hitting partners.",
    depth: "template",
    homeGymTitle: "Clubs & courts",
    homePartnerTitle: "Hitting partners",
    homeEventTitle: "Clinics & ladders",
    roiSurfaces: ["court availability", "NTRP match", "clinic schedule"],
  }),
  sportDef({
    id: "basketball",
    name: "Basketball",
    short: "Hoops",
    icon: "assets/sports/basketball.jpg",
    vibe: "Hardwood",
    blurb: "Open gym, runs, rec leagues.",
    depth: "template",
    homeGymTitle: "Courts near you",
    homePartnerTitle: "Run partners",
    roiSurfaces: ["open gym times", "rec league signups", "full-court runs"],
  }),
  sportDef({
    id: "soccer",
    name: "Soccer / Futsal",
    short: "Soccer",
    icon: "assets/sports/soccer.jpg",
    vibe: "Pitch green",
    blurb: "Pick-up, futsal courts, league nights.",
    depth: "template",
    homeGymTitle: "Fields & courts",
    homePartnerTitle: "Pick-up partners",
    roiSurfaces: ["pick-up boards", "futsal open play", "league fixtures"],
  }),
  sportDef({
    id: "volleyball",
    name: "Volleyball",
    short: "Volleyball",
    icon: "assets/sports/volleyball.jpg",
    vibe: "Sand & gym",
    blurb: "Indoor open gym, beach pairs, tournaments.",
    depth: "template",
    homeGymTitle: "Gyms & beaches",
    homePartnerTitle: "Partners / pairs",
    roiSurfaces: ["open gym", "beach pairs", "local tournaments"],
  }),
  sportDef({
    id: "pilates",
    name: "Pilates",
    short: "Pilates",
    icon: "assets/sports/pilates.jpg",
    vibe: "Studio calm",
    blurb: "Reformer classes, instructor follow, waitlists.",
    depth: "template",
    gymFilters: [
      { id: "all", label: "All" },
      { id: "open", label: "Open now" },
      { id: "reformer", label: "Reformer" },
      { id: "classes", label: "Classes today" },
    ],
    homeGymTitle: "Studios near you",
    homePartnerTitle: "Practice buddies",
    homeEventTitle: "Workshops",
    gymsTitle: "Studios",
    gearTitle: "Grip & socks",
    roiSurfaces: ["class waitlists", "reformer slots", "instructor workshops"],
  }),
  sportDef({
    id: "yoga",
    name: "Yoga",
    short: "Yoga",
    icon: "assets/sports/yoga.jpg",
    vibe: "Breath & earth",
    blurb: "Studios, styles, community flows.",
    depth: "template",
    homeGymTitle: "Studios nearby",
    homePartnerTitle: "Practice buddies",
    roiSurfaces: ["next class style", "workshops", "teacher follows"],
  }),
  sportDef({
    id: "running",
    name: "Running",
    short: "Running",
    icon: "assets/sports/running.jpg",
    vibe: "Outdoor pace",
    blurb: "Group runs, race calendar, pace partners.",
    depth: "template",
    homeGymTitle: "Clubs & tracks",
    homePartnerTitle: "Run partners",
    roiSurfaces: ["group run times", "race calendar", "pace bands"],
  }),
  sportDef({
    id: "cycling",
    name: "Cycling",
    short: "Cycling",
    icon: "assets/sports/cycling.jpg",
    vibe: "Carbon + volt",
    blurb: "Group rides, shops, gran fondos.",
    depth: "template",
    homeGymTitle: "Shops & clubs",
    homePartnerTitle: "Ride partners",
    roiSurfaces: ["group rides", "fondo calendar", "shop events"],
  }),
  sportDef({
    id: "climbing",
    name: "Climbing",
    short: "Climbing",
    icon: "assets/sports/climbing.jpg",
    vibe: "Chalk & beta",
    blurb: "Walls, comps, belay partners.",
    depth: "template",
    homeGymTitle: "Walls nearby",
    homePartnerTitle: "Belay partners",
    roiSurfaces: ["set rotations", "comps", "belay partners"],
  }),
  sportDef({
    id: "swimming",
    name: "Swimming",
    short: "Swim",
    icon: "assets/sports/swimming.jpg",
    vibe: "Pool glass",
    blurb: "Lanes, masters, meets.",
    depth: "template",
    homeGymTitle: "Pools nearby",
    homePartnerTitle: "Lane partners",
    roiSurfaces: ["lap swim windows", "masters sets", "meet calendar"],
  }),
];

/** Live venues only — populated by places-live.js (OSM / Google / Geoapify). Never use fake gyms. */
const GYMS = [];

/** Real partners require signed-in users (Supabase). Empty until network exists. */
const PARTNERS = [];

/** Real events: gym webhooks, federation calendars, user posts — no invented cards. */
const EVENTS = [];

/** Social feed fills when users follow real venues / webhooks. */
const SOCIAL_POSTS = [];

/** Gear shops: prefer live OSM/Google later; empty beats fake storefronts. */
const SHOPS = [];

/** Gear wants/haves need real users. */
const NEEDS = [];

/** Default profile social graph + webhook endpoints (prototype) */
const PROFILE_DEFAULT = {
  displayName: "Vlad",
  area: "Near you",
  ageBand: "Adult",
  sports: [
    { id: "bjj", level: "Blue belt" },
    { id: "pickleball", level: "DUPR 3.5" },
    { id: "yoga", level: "Vinyasa" },
    { id: "boxing", level: "Novice" },
    { id: "hyrox", level: "Open" },
  ],
  /** First-choice sport — feed + home lean hard this way without locking other sports */
  primarySportId: "bjj",
  /** Saved venues (user-pinned) */
  favorites: [],
  /**
   * Stay in the loop — product prefs (push later; feed uses these now)
   */
  notify: {
    primarySport: true,
    savedGyms: true,
    specials: true,
    tournaments: true,
    liveNearby: true,
  },
  /**
   * Club you represent — fully user-personalized.
   * Sport skins stay generic; this only affects profile strip + soft ambient.
   */
  represent: {
    enabled: false,
    label: "",
    mode: "custom", // none | template | custom | nix
    logoDataUrl: null,
    crop: { zoom: 1, x: 0.5, y: 0.5 }, // 0–1 center + zoom
    colors: {
      primary: "#121212",
      secondary: "#f4f4f4",
      accent: "#8a8a8a",
    },
    pattern: "rings", // rings | stripe | mesh | solid
    nix: {
      status: "idle", // idle | working | ready | error
      notes: "",
      source: "",
      samples: [],
    },
  },
  social: {
    instagram: "",
    facebook: "",
    x: "",
    tiktok: "",
    strava: "",
    youtube: "",
  },
  following: [],
  webhooks: [],
  eventNotifies: {},
};

/** Optional starter seeds only — user can edit every value after */
const REPRESENT_TEMPLATES = [
  {
    id: "blank",
    name: "Blank canvas",
    colors: { primary: "#121212", secondary: "#f4f4f4", accent: "#888888" },
    pattern: "solid",
  },
  {
    id: "mono",
    name: "Mono mat",
    colors: { primary: "#0a0a0a", secondary: "#f2f2f2", accent: "#c8c8c8" },
    pattern: "rings",
  },
  {
    id: "ocean",
    name: "Ocean tech",
    colors: { primary: "#0b1c2c", secondary: "#e8f4ff", accent: "#3d9cf0" },
    pattern: "mesh",
  },
  {
    id: "ember",
    name: "Ember night",
    colors: { primary: "#1a0c0c", secondary: "#fce8e6", accent: "#e85d4c" },
    pattern: "stripe",
  },
  {
    id: "forest",
    name: "Forest",
    colors: { primary: "#0d1a12", secondary: "#eef6f0", accent: "#3d9b6e" },
    pattern: "mesh",
  },
];
