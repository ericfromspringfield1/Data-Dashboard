# Data-Dashboard

A browser-based live dashboard that displays weather warnings, a weather radar, sports scores, and news headlines using free public data sources.

## Data sources

- **Weather warnings:** National Weather Service active alerts API (`api.weather.gov`).
- **Weather radar:** RainViewer public radar tiles over an OpenStreetMap base map.
- **Sports scores:** ESPN public scoreboard endpoints for NFL, NBA, MLB, NHL, and EPL.
- **News headlines:** GDELT 2.1 DOC API article index.
- **Location search:** OpenStreetMap Nominatim geocoding for U.S. locations.

## Run locally

Because this is a static site, it can run from any local web server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser.

## Notes

- The dashboard defaults to Washington, DC and can be updated by city, state, ZIP code, or browser geolocation.
- No API keys are required.
- Public APIs can rate-limit or temporarily fail; each panel shows an inline error if a source is unavailable.
