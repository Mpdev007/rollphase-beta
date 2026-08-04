/**
 * RollPhase venue ratings — in-app, visit-aware, sport-scoped, low noise.
 * User-authored reviews persist in localStorage (prototype).
 */

const REVIEW_STORE_KEY = "rollphase.reviews.user.v1";
const VISIT_STORE_KEY = "rollphase.visits.v1";

const REVIEW_DIMENSIONS = [
  { id: "overall", label: "Overall" },
  { id: "coaching", label: "Coaching / staff" },
  { id: "facility", label: "Facility" },
  { id: "community", label: "Community" },
  { id: "value", label: "Value / drop-in" },
];

/** Sport-specific quick tags (structured, not free-form spam) */
const SPORT_REVIEW_TAGS = {
  bjj: ["Great mats", "Solid open mat", "Beginner-friendly", "Comp culture", "Traveler-friendly"],
  mma: ["Good sparring", "Solid bags", "Cage access", "Traveler-friendly"],
  boxing: ["Good ring time", "Solid coaching", "Bags in shape", "Drop-in OK"],
  wrestling: ["Hard room", "Live goes", "Good mats"],
  muaythai: ["Pad work", "Fight team energy", "Traveler-friendly"],
  kickboxing: ["Good sparring", "Class quality"],
  judo: ["Randori culture", "Technique-first"],
  weightlifting: ["Platforms free", "Good programming", "Busy but fair"],
  crossfit: ["Solid coaching", "Community", "Scaled welcome"],
  hyrox: ["Stations ready", "Sim quality", "Race prep"],
  pickleball: ["Open play works", "Court quality", "Friendly ladder"],
  tennis: ["Court quality", "Good clinics"],
  basketball: ["Open run quality", "Courts maintained"],
  soccer: ["Good pick-up", "Surface OK"],
  volleyball: ["Open gym energy"],
  pilates: ["Reformer quality", "Instructors"],
  yoga: ["Class quality", "Studio vibe"],
  running: ["Group energy", "Pace groups"],
  cycling: ["Ride culture", "Shop support"],
  climbing: ["Setting quality", "Crowd OK", "Belay culture"],
  swimming: ["Lane availability", "Water quality"],
};

/** Seeded community reviews (mock athletes in-app) */
const SEED_REVIEWS = [
  {
    id: "sr1",
    gymId: "g0",
    sport: "bjj",
    author: "Maya R.",
    verifiedVisit: true,
    scores: { overall: 5, coaching: 5, facility: 4, community: 5, value: 5 },
    tags: ["Great mats", "Solid open mat", "Beginner-friendly"],
    text: "Saturday open mat is the real deal. Kids program is organized.",
    at: "2026-03-01T18:00:00Z",
  },
  {
    id: "sr2",
    gymId: "g0",
    sport: "bjj",
    author: "Chris K.",
    verifiedVisit: true,
    scores: { overall: 4, coaching: 4, facility: 4, community: 5, value: 4 },
    tags: ["Traveler-friendly", "Solid open mat"],
    text: "Dropped in while traveling — felt welcome immediately.",
    at: "2026-02-20T12:00:00Z",
  },
  {
    id: "sr3",
    gymId: "g1",
    sport: "bjj",
    author: "Jordan L.",
    verifiedVisit: true,
    scores: { overall: 5, coaching: 5, facility: 5, community: 4, value: 3 },
    tags: ["Comp culture", "Great mats"],
    text: "Competition class is sharp. Worth it if you're serious.",
    at: "2026-02-28T19:00:00Z",
  },
  {
    id: "sr4",
    gymId: "g1",
    sport: "mma",
    author: "Dez M.",
    verifiedVisit: true,
    scores: { overall: 4, coaching: 5, facility: 4, community: 4, value: 4 },
    tags: ["Good sparring", "Cage access"],
    text: "Spar nights controlled and coached. Not a free-for-all.",
    at: "2026-03-02T20:00:00Z",
  },
  {
    id: "sr5",
    gymId: "g13",
    sport: "pickleball",
    author: "Ava P.",
    verifiedVisit: true,
    scores: { overall: 5, coaching: 4, facility: 5, community: 5, value: 4 },
    tags: ["Open play works", "Friendly ladder"],
    text: "Best open play window in town. Ladder nights are fun.",
    at: "2026-03-03T16:00:00Z",
  },
  {
    id: "sr6",
    gymId: "g16",
    sport: "hyrox",
    author: "Kai H.",
    verifiedVisit: true,
    scores: { overall: 5, coaching: 5, facility: 5, community: 4, value: 4 },
    tags: ["Stations ready", "Race prep"],
    text: "Sim days feel like race day. Doubles partners easy to find.",
    at: "2026-03-04T17:30:00Z",
  },
  {
    id: "sr7",
    gymId: "g8",
    sport: "yoga",
    author: "Nina V.",
    verifiedVisit: false,
    scores: { overall: 5, coaching: 5, facility: 5, community: 5, value: 4 },
    tags: ["Class quality", "Studio vibe"],
    text: "Evening vinyasa is consistently excellent.",
    at: "2026-02-15T18:00:00Z",
  },
  {
    id: "sr8",
    gymId: "g3",
    sport: "weightlifting",
    author: "Sam O.",
    verifiedVisit: true,
    scores: { overall: 4, coaching: 4, facility: 5, community: 3, value: 5 },
    tags: ["Platforms free", "Good programming"],
    text: "24h access is the win. Platforms usually available early.",
    at: "2026-03-01T07:00:00Z",
  },
];

function loadUserReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUserReviews(list) {
  localStorage.setItem(REVIEW_STORE_KEY, JSON.stringify(list));
}

function loadVisits() {
  try {
    return JSON.parse(localStorage.getItem(VISIT_STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function recordVisit(gymId, sport) {
  const visits = loadVisits();
  visits.push({ gymId, sport: sport || null, at: new Date().toISOString() });
  // keep last 100
  localStorage.setItem(VISIT_STORE_KEY, JSON.stringify(visits.slice(-100)));
}

function hasVisit(gymId, sport) {
  const visits = loadVisits();
  if (sport) return visits.some((v) => v.gymId === gymId && (!v.sport || v.sport === sport));
  return visits.some((v) => v.gymId === gymId);
}

function allReviews() {
  return [...SEED_REVIEWS, ...loadUserReviews()];
}

function reviewsForGym(gymId, sport) {
  return allReviews()
    .filter((r) => r.gymId === gymId && (!sport || r.sport === sport))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

function aggregateRating(gymId, sport) {
  const list = reviewsForGym(gymId, sport);
  if (!list.length) return null;
  const avg = (key) => {
    const vals = list.map((r) => r.scores?.[key]).filter((n) => typeof n === "number");
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const overall = avg("overall");
  const tagCounts = {};
  list.forEach((r) => (r.tags || []).forEach((t) => {
    tagCounts[t] = (tagCounts[t] || 0) + 1;
  }));
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  return {
    overall: overall ? Math.round(overall * 10) / 10 : null,
    count: list.length,
    verifiedCount: list.filter((r) => r.verifiedVisit).length,
    dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map((d) => [d.id, avg(d.id)])),
    topTags,
  };
}

function starsHtml(n, max = 5) {
  const full = Math.round(n || 0);
  let s = "";
  for (let i = 1; i <= max; i++) s += i <= full ? "★" : "☆";
  return s;
}

function upsertUserReview(review) {
  const list = loadUserReviews().filter(
    (r) => !(r.gymId === review.gymId && r.sport === review.sport && r.author === review.author)
  );
  list.push(review);
  saveUserReviews(list);
  return review;
}

function myReviews(authorName) {
  return loadUserReviews()
    .filter((r) => r.author === authorName)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

const ReviewSystem = {
  REVIEW_DIMENSIONS,
  SPORT_REVIEW_TAGS,
  loadUserReviews,
  saveUserReviews,
  recordVisit,
  hasVisit,
  allReviews,
  reviewsForGym,
  aggregateRating,
  starsHtml,
  upsertUserReview,
  myReviews,
};
