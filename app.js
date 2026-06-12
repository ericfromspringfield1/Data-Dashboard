const state = {
  location: {
    label: 'Washington, DC',
    lat: 38.9072,
    lon: -77.0369,
  },
  map: null,
  radarLayer: null,
  locationMarker: null,
  activeLeague: 'football/nfl',
};

const leagues = [
  { id: 'football/nfl', label: 'NFL' },
  { id: 'basketball/nba', label: 'NBA' },
  { id: 'baseball/mlb', label: 'MLB' },
  { id: 'hockey/nhl', label: 'NHL' },
  { id: 'soccer/eng.1', label: 'EPL' },
];

const els = {
  locationForm: document.querySelector('#locationForm'),
  locationInput: document.querySelector('#locationInput'),
  locationStatus: document.querySelector('#locationStatus'),
  geoButton: document.querySelector('#geoButton'),
  alertSummary: document.querySelector('#alertSummary'),
  alertsList: document.querySelector('#alertsList'),
  radarMeta: document.querySelector('#radarMeta'),
  sportsTabs: document.querySelector('#sportsTabs'),
  scoresList: document.querySelector('#scoresList'),
  newsList: document.querySelector('#newsList'),
  newsQuery: document.querySelector('#newsQuery'),
  newsSearchButton: document.querySelector('#newsSearchButton'),
  lastUpdated: document.querySelector('#lastUpdated'),
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function setLoading(container, message) {
  container.innerHTML = `<article class="card"><p class="meta">${escapeHtml(message)}</p></article>`;
}

function formatTime(value, options = {}) {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(value));
}

function updateLastUpdated() {
  els.lastUpdated.textContent = `Last updated: ${formatTime(new Date().toISOString())}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json, application/json, text/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function geocodeLocation(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'us',
  });

  const data = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!data.length) {
    throw new Error('No matching U.S. location found.');
  }

  return {
    label: data[0].display_name.split(',').slice(0, 3).join(','),
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
  };
}

async function loadWeatherAlerts() {
  els.alertSummary.textContent = 'Loading alerts…';
  setLoading(els.alertsList, 'Checking active National Weather Service alerts.');

  try {
    const params = new URLSearchParams({
      point: `${state.location.lat.toFixed(4)},${state.location.lon.toFixed(4)}`,
      status: 'actual',
      message_type: 'alert',
    });
    const data = await fetchJson(`https://api.weather.gov/alerts/active?${params}`);
    const alerts = data.features || [];

    els.alertSummary.textContent = alerts.length
      ? `${alerts.length} active alert${alerts.length === 1 ? '' : 's'} near ${state.location.label}`
      : `No active NWS alerts near ${state.location.label}`;

    if (!alerts.length) {
      els.alertsList.innerHTML = '<article class="card"><h3>All clear</h3><p class="meta">No active watches, warnings, or advisories were returned for this point.</p></article>';
      return;
    }

    els.alertsList.innerHTML = alerts.slice(0, 8).map(({ properties }) => {
      const severityClass = ['Extreme', 'Severe'].includes(properties.severity) ? 'danger' : 'warning';
      return `
        <article class="card ${severityClass}">
          <h3>${escapeHtml(properties.event)}</h3>
          <p class="meta"><strong>${escapeHtml(properties.severity || 'Unknown severity')}</strong> · ${escapeHtml(properties.areaDesc || 'Area unavailable')}</p>
          <p>${escapeHtml(properties.headline || properties.description || 'No alert description provided.')}</p>
          <p class="meta">Effective ${formatTime(properties.effective)} · Expires ${formatTime(properties.expires)}</p>
        </article>
      `;
    }).join('');
  } catch (error) {
    els.alertSummary.textContent = 'Weather alerts unavailable';
    els.alertsList.innerHTML = `<article class="card danger"><h3>Could not load alerts</h3><p class="meta">${escapeHtml(error.message)}</p></article>`;
  }
}

async function loadRadar() {
  if (!window.L) {
    els.radarMeta.textContent = 'Radar map library unavailable. Check the Leaflet CDN connection.';
    return;
  }

  if (!state.map) {
    state.map = L.map('radarMap', { zoomControl: true }).setView([state.location.lat, state.location.lon], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);
  } else {
    state.map.setView([state.location.lat, state.location.lon], state.map.getZoom());
  }

  els.radarMeta.textContent = 'Loading latest RainViewer radar frame…';

  try {
    const radar = await fetchJson('https://api.rainviewer.com/public/weather-maps.json');
    const frames = radar?.radar?.past || [];
    const latest = frames.at(-1);

    if (!latest) {
      throw new Error('No radar frames returned.');
    }

    if (state.radarLayer) {
      state.map.removeLayer(state.radarLayer);
    }

    state.radarLayer = L.tileLayer(`${radar.host}${latest.path}/256/{z}/{x}/{y}/4/1_1.png`, {
      opacity: 0.72,
      maxZoom: 12,
      attribution: 'Radar &copy; RainViewer',
    }).addTo(state.map);

    if (state.locationMarker) {
      state.map.removeLayer(state.locationMarker);
    }

    state.locationMarker = L.circleMarker([state.location.lat, state.location.lon], {
      radius: 8,
      color: '#55d6ff',
      fillColor: '#55d6ff',
      fillOpacity: 0.8,
      weight: 2,
    }).addTo(state.map).bindPopup(escapeHtml(state.location.label));

    els.radarMeta.textContent = `Radar frame: ${formatTime(latest.time * 1000)} · centered on ${state.location.label}`;
  } catch (error) {
    els.radarMeta.textContent = `Radar unavailable: ${error.message}`;
  }
}

function renderSportsTabs() {
  els.sportsTabs.innerHTML = leagues.map((league) => `
    <button class="tab ${league.id === state.activeLeague ? 'active' : ''}" type="button" role="tab" aria-selected="${league.id === state.activeLeague}" data-league="${league.id}">${league.label}</button>
  `).join('');
}

async function loadSportsScores() {
  renderSportsTabs();
  setLoading(els.scoresList, 'Loading ESPN scoreboard data.');

  try {
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${state.activeLeague}/scoreboard`);
    const events = data.events || [];

    if (!events.length) {
      els.scoresList.innerHTML = '<article class="card"><h3>No games listed</h3><p class="meta">ESPN did not return games for this league right now.</p></article>';
      return;
    }

    els.scoresList.innerHTML = events.slice(0, 8).map((event) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const status = event.status?.type?.shortDetail || event.status?.type?.description || 'Status unavailable';
      const rows = competitors.map((competitor) => {
        const name = competitor.team?.shortDisplayName || competitor.team?.displayName || 'Team';
        const winner = competitor.winner ? 'winner' : '';
        return `<div class="team-row ${winner}"><span>${escapeHtml(name)}</span><strong>${escapeHtml(competitor.score || '0')}</strong></div>`;
      }).join('');

      return `
        <article class="card score-card">
          <div>
            <h3>${escapeHtml(event.shortName || event.name || 'Game')}</h3>
            <div class="teams">${rows}</div>
            <p class="meta">${formatTime(event.date)}</p>
          </div>
          <span class="badge">${escapeHtml(status)}</span>
        </article>
      `;
    }).join('');
  } catch (error) {
    els.scoresList.innerHTML = `<article class="card danger"><h3>Could not load scores</h3><p class="meta">${escapeHtml(error.message)}</p></article>`;
  }
}

async function loadNews() {
  const query = els.newsQuery.value.trim() || 'top stories United States';
  setLoading(els.newsList, 'Loading headlines from GDELT.');

  try {
    const params = new URLSearchParams({
      query,
      mode: 'ArtList',
      format: 'json',
      maxrecords: '12',
      sort: 'HybridRel',
    });
    const data = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`);
    const articles = data.articles || [];

    if (!articles.length) {
      els.newsList.innerHTML = '<article class="card"><h3>No headlines found</h3><p class="meta">Try a broader topic or location.</p></article>';
      return;
    }

    els.newsList.innerHTML = articles.slice(0, 8).map((article) => `
      <article class="card">
        <h3><a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title || 'Untitled headline')}</a></h3>
        <p class="meta">${escapeHtml(article.domain || 'Unknown source')} · ${formatGdeltDate(article.seendate)}</p>
      </article>
    `).join('');
  } catch (error) {
    els.newsList.innerHTML = `<article class="card danger"><h3>Could not load news</h3><p class="meta">${escapeHtml(error.message)}</p></article>`;
  }
}

function formatGdeltDate(value) {
  if (!value) return 'Date unavailable';
  const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11) || '00'}:${value.slice(11, 13) || '00'}:00Z`;
  return formatTime(normalized);
}

async function refreshAll() {
  updateLastUpdated();
  await Promise.allSettled([
    loadWeatherAlerts(),
    loadRadar(),
    loadSportsScores(),
    loadNews(),
  ]);
  updateLastUpdated();
}

async function applyLocation(location) {
  state.location = location;
  els.locationInput.value = location.label;
  els.locationStatus.textContent = `Showing data near ${location.label} (${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}).`;
  await Promise.allSettled([loadWeatherAlerts(), loadRadar()]);
  updateLastUpdated();
}

els.locationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = els.locationInput.value.trim();
  if (!query) return;

  els.locationStatus.textContent = `Finding ${query}…`;
  try {
    await applyLocation(await geocodeLocation(query));
  } catch (error) {
    els.locationStatus.textContent = `Location lookup failed: ${error.message}`;
  }
});

els.geoButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    els.locationStatus.textContent = 'Geolocation is not available in this browser.';
    return;
  }

  els.locationStatus.textContent = 'Requesting browser location…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => applyLocation({
      label: 'Your location',
      lat: coords.latitude,
      lon: coords.longitude,
    }),
    (error) => {
      els.locationStatus.textContent = `Geolocation failed: ${error.message}`;
    },
    { enableHighAccuracy: false, timeout: 10000 },
  );
});

els.sportsTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-league]');
  if (!button) return;
  state.activeLeague = button.dataset.league;
  loadSportsScores().then(updateLastUpdated);
});

els.newsSearchButton.addEventListener('click', () => loadNews().then(updateLastUpdated));
els.newsQuery.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadNews().then(updateLastUpdated);
  }
});

document.querySelectorAll('[data-refresh]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.refresh;
    const refreshers = {
      alerts: loadWeatherAlerts,
      radar: loadRadar,
      sports: loadSportsScores,
      news: loadNews,
    };
    refreshers[target]?.().then(updateLastUpdated);
  });
});

window.addEventListener('load', refreshAll);
