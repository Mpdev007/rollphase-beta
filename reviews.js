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

/** Real athlete reviews only — no seed fakes. */
const SEED_REVIEWS = [];

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
