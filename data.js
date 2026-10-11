/* RollPhase catalog — sports metadata only. Venues/events/partners are live or empty (no fake listings).
 * depth: "full" = rich events + pro athlete ROI surfaces
 *        "template" = consistent shell, lighter mock (not fully implemented)
 */

const DEFAULT_GYM_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open now" },
  { id: "near", label: "≤ 5 mi" },
];
const DEFAULT_PARTNER_FILTERS = [
  { id: "all", label: "All levels" },
  { id: "match", label: "My level" },
  { id: "near", label: "≤ 3 mi" },
];

// What a Mat Board slot's gear picker offers, by sport id — used by board.js's Add/Edit mat time
// sheet (falls back to its own generic list for a sport not listed here).
const MAT_GEAR_BY_SPORT = {
  bjj: ["gi", "no-gi", "gloves"],
  mma: ["gloves", "shin-guards", "headgear", "mouthguard"],
  boxing: ["gloves", "handwraps", "headgear", "mouthguard"],
  wrestling: ["singlet", "headgear"],
  muaythai: ["gloves", "shin-guards", "handwraps", "mouthguard"],
  kickboxing: ["gloves", "shin-guards", "handwraps"],
  judo: ["gi", "belt"],
  weightlifting: ["lifting shoes", "belt", "wraps"],
  crossfit: ["lifting shoes", "gloves"],
  hyrox: ["running shoes", "gloves"],
  pickleball: ["paddle", "court shoes"],
  tennis: ["racket", "court shoes"],
  basketball: ["court shoes"],
  soccer: ["cleats", "shin-guards"],
  volleyball: ["knee pads", "court shoes"],
  pilates: ["grip socks", "mat"],
  yoga: ["mat", "grip socks"],
  running: ["running shoes"],
  cycling: ["helmet", "cycling shoes"],
  climbing: ["climbing shoes", "chalk", "harness"],
  swimming: ["goggles", "cap"],
};
const GENERIC_MAT_GEAR = ["gi", "no-gi", "gloves", "shin-guards"];

function sportDef(partial) {
  const sport = {
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
    matGear: MAT_GEAR_BY_SPORT[partial.id] || GENERIC_MAT_GEAR,
    ...partial,
  };
  if (sport.icon && !sport.icon.includes("?")) sport.icon += "?v=7";
  return sport;
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
      { id: "near", label: "≤ 5 mi" },
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
      { id: "near", label: "≤ 5 mi" },
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
      { id: "near", label: "≤ 5 mi" },
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
      { id: "near", label: "≤ 5 mi" },
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
      { id: "24h", label: "24h", trait: "hours24" },
      { id: "near", label: "≤ 5 mi" },
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
      { id: "near", label: "≤ 5 mi" },
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
      { id: "open", label: "Open now" },
      { id: "indoor", label: "Indoor", trait: "indoor" },
      { id: "near", label: "≤ 5 mi" },
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
      { id: "near", label: "≤ 5 mi" },
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

/** Official public calendars only. No invented event cards. */
const CALENDARS = {
  bjj: { label: "IBJJF calendar", href: "https://ibjjf.com/events/calendar" },
  mma: { label: "UFC schedule", href: "https://www.ufc.com/events" },
  kickboxing: { label: "WAKO events", href: "https://www.wako.sport/events" },
  judo: { label: "IJF calendar", href: "https://www.ijf.org/calendar" },
  crossfit: { label: "CrossFit Games calendar", href: "https://games.crossfit.com/calendar" },
  hyrox: { label: "Find a HYROX race", href: "https://www.hyrox.com/find-my-race/" },
  pickleball: { label: "Pickleball tournaments", href: "https://pickleballtournaments.com/" },
  soccer: { label: "U.S. Soccer schedule", href: "https://www.ussoccer.com/all-matches" },
  volleyball: { label: "USA Volleyball events", href: "https://usavolleyball.org/events/" },
  cycling: { label: "USA Cycling events", href: "https://usacycling.sport80.com/pub/e_locator/events/find?from_date=today" },
  climbing: { label: "World Climbing calendar", href: "https://www.worldclimbing.com/calendar" },
  basketball: { label: "FIBA 3x3 events", href: "https://play.fiba3x3.com/events" },
};
const MORE_CALENDARS = {
  boxing: { label: "USA Boxing events", href: "https://usaboxing.webpoint.us/wp15/Events2/Events-wp.php?evt_CategoryID=4,1,2,11,10" },
  wrestling: { label: "USA Wrestling events", href: "https://usawrestlingevents.com/events" },
  muaythai: { label: "IFMA events", href: "https://muaythai.sport/events/" },
  weightlifting: { label: "USA Weightlifting", href: "https://www.usaweightlifting.org/events" },
  tennis: { label: "Find a USTA event", href: "https://www.usta.com/en/home/play.html" },
  running: { label: "USATF events", href: "https://www.usatf.org/events" },
  swimming: { label: "U.S. Masters meets", href: "https://www.usms.org/events" },
  yoga: { label: "Find a Yoga Alliance teacher", href: "https://yogaalliance.org/find-a-yoga-teacher/" },
  pilates: {
    label: "NPCP workshops",
    href: "https://nationalpilatescertificationprogram.org/NPCP/NPCP/Continuing_Education/CEC-Calendar.aspx",
  },
};
const RATING_DOOR = {
  pickleball: { label: "Look up a DUPR", href: "https://www.dupr.com/" },
};
const SPORT_LEVELS = {
  bjj: ["White belt", "Blue belt", "Purple belt", "Brown belt", "Black belt"],
  mma: ["Novice", "Amateur", "Pro"],
  boxing: ["Novice", "Open", "Amateur", "Elite"],
  wrestling: ["Beginner", "Junior", "Senior", "Open"],
  muaythai: ["Beginner", "Intermediate", "Fighter", "Champion"],
  kickboxing: ["Beginner", "Intermediate", "Amateur", "Pro"],
  judo: ["White belt", "Yellow belt", "Orange belt", "Green belt", "Blue belt", "Brown belt", "Black belt"],
  weightlifting: ["Beginner", "Local", "Regional", "National"],
  crossfit: ["Scaled", "RX", "Elite"],
  hyrox: ["Open", "Pro", "Elite"],
  pickleball: ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"],
  tennis: ["NTRP 2.5", "NTRP 3.0", "NTRP 3.5", "NTRP 4.0", "NTRP 4.5", "NTRP 5.0"],
  basketball: ["Rec", "League", "Competitive"],
  soccer: ["Rec", "League", "Competitive"],
  volleyball: ["Rec", "BB", "A", "AA", "Open"],
  pilates: ["Beginner", "Intermediate", "Advanced"],
  yoga: ["Beginner", "Intermediate", "Advanced"],
  running: ["Easy", "Tempo", "Race"],
  cycling: ["Social", "Sport", "Race"],
  climbing: ["V0–V2", "V3–V4", "V5–V6", "V7–V8", "V9+"],
  swimming: ["Rec", "Fitness", "Masters", "Competitive"],
};
const LEVEL_MATCH_LABEL = {
  bjj: "My belt ±1",
  judo: "My belt ±1",
  pickleball: "My DUPR ±0.5",
  tennis: "My NTRP",
  running: "My pace",
  climbing: "My grade",
  swimming: "My lane group",
  hyrox: "My division",
  crossfit: "My scale",
  weightlifting: "My meet level",
};
const GENERIC_FACE = {
  gymsTitle: "Venues",
  partnersTitle: "Partners",
  gearTitle: "Gear",
  homeEventTitle: "Upcoming",
  feedTitle: "Feed",
};
const SPORT_FACE = {
  mma: { partnersTitle: "Sparring partners", homeEventTitle: "Fight-night cards", feedTitle: "Fight cards" },
  boxing: { partnersTitle: "Pad partners", homeEventTitle: "Amateur shows", feedTitle: "Shows" },
  wrestling: { gymsTitle: "Wrestling rooms", partnersTitle: "Live partners", gearTitle: "Headgear", homeEventTitle: "Opens and duals", feedTitle: "Wrestling" },
  kickboxing: { gymsTitle: "Strike gyms", partnersTitle: "Spar partners", gearTitle: "Gloves and shins", homeEventTitle: "Amateur cards", feedTitle: "Cards" },
  judo: { partnersTitle: "Randori partners", gearTitle: "Gi and belt", feedTitle: "Shiai" },
  weightlifting: { gymsTitle: "Platforms", partnersTitle: "Session partners", gearTitle: "Shoes and belt", homeEventTitle: "Meets", feedTitle: "Meets" },
  crossfit: { gymsTitle: "Boxes", partnersTitle: "WOD partners", gearTitle: "Training kit", homeEventTitle: "The Open", feedTitle: "WODs" },
  tennis: { gymsTitle: "Clubs and courts", partnersTitle: "Hitting partners", gearTitle: "Racquets", feedTitle: "Ladders" },
  basketball: { gymsTitle: "Courts", partnersTitle: "Run partners", gearTitle: "Court shoes", homeEventTitle: "Runs and leagues", feedTitle: "Runs" },
  soccer: { gymsTitle: "Fields and courts", partnersTitle: "Pick-up partners", gearTitle: "Cleats", homeEventTitle: "League nights", feedTitle: "Fixtures" },
  volleyball: { gymsTitle: "Gyms and beaches", partnersTitle: "Pairs", gearTitle: "Knee pads", homeEventTitle: "Opens and tournaments", feedTitle: "Opens" },
  yoga: { gymsTitle: "Studios", partnersTitle: "Practice buddies", gearTitle: "Mat", homeEventTitle: "Teachers", feedTitle: "Classes" },
  running: { gymsTitle: "Clubs and tracks", partnersTitle: "Run partners", gearTitle: "Shoes", homeEventTitle: "Races", feedTitle: "Runs" },
  cycling: { gymsTitle: "Shops and clubs", partnersTitle: "Ride partners", gearTitle: "Helmet and shoes", homeEventTitle: "Group rides", feedTitle: "Rides" },
  climbing: { gymsTitle: "Walls", partnersTitle: "Belay partners", gearTitle: "Shoes and chalk", homeEventTitle: "Comps", feedTitle: "Sets" },
  swimming: { gymsTitle: "Pools", partnersTitle: "Lane partners", gearTitle: "Goggles", homeEventTitle: "Meets", feedTitle: "Meets" },
};
const NAME_FILTERS = {
  crossfit: { id: "24h", label: "24h", trait: "hours24" },
  tennis: { id: "club", label: "Club", trait: "club" },
  basketball: { id: "indoor", label: "Indoor", trait: "indoor" },
  soccer: { id: "futsal", label: "Futsal", trait: "futsal" },
  volleyball: { id: "beach", label: "Beach", trait: "beach" },
  yoga: { id: "hot", label: "Hot", match: "\\bhot\\b" },
  running: { id: "track", label: "Track", trait: "track" },
  cycling: { id: "shop", label: "Bike shop", trait: "shop" },
  climbing: { id: "boulder", label: "Bouldering", trait: "boulder" },
  swimming: { id: "indoor", label: "Indoor", trait: "indoor" },
};
SPORTS.forEach((s) => {
  if (CALENDARS[s.id]) s.calendar = CALENDARS[s.id];
  else if (MORE_CALENDARS[s.id]) s.calendar = MORE_CALENDARS[s.id];
  if (RATING_DOOR[s.id]) s.resources = [RATING_DOOR[s.id]];
  if (SPORT_LEVELS[s.id]) s.levels = SPORT_LEVELS[s.id];
  const face = SPORT_FACE[s.id];
  if (face) {
    Object.keys(face).forEach((key) => {
      if (!GENERIC_FACE[key] || s[key] === GENERIC_FACE[key]) s[key] = face[key];
    });
  }
  const extra = NAME_FILTERS[s.id];
  if (extra && !(s.gymFilters || []).some((f) => f.id === extra.id)) {
    const filters = (s.gymFilters || []).slice();
    const at = filters.findIndex((f) => f.id === "near" || f.id === "classes");
    filters.splice(at < 0 ? filters.length : at, 0, extra);
    s.gymFilters = filters;
  }
  if (s.levels && LEVEL_MATCH_LABEL[s.id]) {
    s.partnerFilters = (s.partnerFilters || []).map((f) =>
      f.id === "match" ? { ...f, label: LEVEL_MATCH_LABEL[s.id] } : f
    );
  }
});

/** Live venues only. Never use fake gyms. */
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
  displayName: "",
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
