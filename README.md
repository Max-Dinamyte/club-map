# European Football Club Map

An interactive dark map of all 282 clubs across the 15 leagues we compiled (England/Wales,
Scotland, Germany, France, Italy, Spain, Netherlands, Portugal — top two divisions each).
Built on Leaflet.js + OpenStreetMap tiles, no build step, no API keys, no backend.

## What it does

- Dark ("night match") map with a dot for every club, positioned at its home city.
- Dot **size scales with zoom** — zoom in and dots grow, zoom out and they shrink, so the
  map stays readable at every scale.
- **Click a dot** → panel shows the club's crest (see note below), name in bold, the league
  it plays in, and its record.
- Search box filters by club name, city, or country. League dropdown filters to one league.

## About "record" and the crests

- **Record**: the 2026–27 season hadn't started yet as of when this was built, so every
  club's "record" field is its **final 2025–26 result** (league position, promotion/relegation
  status, or European qualification) — the most recent real data that exists. Once the new
  season kicks off, `data/clubs.json` → `record` is the field to update per club.
- **Crests**: these are **not** the clubs' real logos. Official club badges are trademarked,
  and pulling ~280 of them without rights isn't something I can do responsibly in bulk. Instead
  each club gets a generated circular badge with its initials, colored from a small fixed
  palette. If you have rights to use real crests (e.g. via a licensed API), you can swap the
  `crest`/`club-marker` rendering in `app.js` to point at image files instead of the
  initials-in-a-circle treatment — the code is set up so that's a small, localized change.

## Files

- `index.html` / `style.css` / `app.js` — the map app.
- `data/clubs.json` — the dataset. Each entry:

```json
{
  "id": "unique-slug",
  "country": "Country",
  "league": "League name",
  "name": "Club Name",
  "city": "Home city",
  "lat": 12.34,
  "lon": -5.67,
  "record": "Text shown in the popup",
  "initials": "ABC",
  "color": "#hex"
}
```

Coordinates are **city-level**, not exact stadium geocodes — close enough for a leaguewide
map at this zoom range, but if you want stadium-precision pins for a specific club, just
update its `lat`/`lon` (OpenStreetMap's own site is a fast way to get a precise coordinate:
search the stadium, right-click, copy coordinates).

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → source: deploy from branch → `main` / root.
3. Live at `https://<username>.github.io/<repo-name>/`.

Static site, no build step, no secrets.
