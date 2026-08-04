# RollPhase — Closed Beta Prototype

Interactive **phone-first** product prototype for multi-sport discovery (gyms, partners, events, gear, “I represent” personalization).

> Not the native App Store app. Not production Supabase. For UX / friend testing only.

## Local run

```bash
cd prototype
python -m http.server 8765
# open http://localhost:8765/
```

## Beta features

- **Disclaimer gate** on first visit (acknowledgement + optional name/email)
- **Feedback** button (top-right) — rating, area, message
- **About** — re-read beta info; reset acknowledgement
- Multi-sport home (optional focus, never forced)
- Profile sports + custom represent (logo, colors, Nix hook)

## Configure feedback email (optional)

In `beta.js`, set:

```js
feedbackEmail: "you@example.com",
```

Uses [FormSubmit](https://formsubmit.co) (confirm the email once). If empty, feedback copies to clipboard and opens `mailto:`.

## Deploy

Static files only — any host works (GitHub Pages, Netlify, Cloudflare Pages).
