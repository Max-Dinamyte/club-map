let map;
let markers = [];
let allClubs = [];
let activeLeague = "";

const BROWN = "#6b4a2f";
const BRIGHT_RED = "#e0263a";
const GOLD = "#d8b451";
const BLUE = "#2f6fce";
const WHITE = "#ffffff";

// Dot color = political direction. Ring color = recency (gold = current, i.e. within the last
// 20 years; blue = historical, i.e. not within the last 20 years). No ring when uncategorized.
function politicalStyle(club) {
  const cat = club.political_category;
  const recency = club.political_recency;

  let fill = WHITE;
  let text = "#0a0e14";
  if (cat === "Right-wing") { fill = BROWN; text = "#f4f7ee"; }
  else if (cat === "Left-wing") { fill = BRIGHT_RED; text = "#f4f7ee"; }

  let ring = null;
  if (cat === "Right-wing" || cat === "Left-wing") {
    ring = recency === "current" ? GOLD : BLUE;
  }

  return { fill, ring, text };
}

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 13
  }).setView([49, 5], 5);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  map.on('zoomend', () => renderMarkers(currentFilteredClubs()));
  map.on('click', () => {
    document.getElementById('infoPanel').classList.add('hidden');
  });
}

// Radius in px, scaled by current zoom. Grows as you zoom in.
function radiusForZoom(zoom) {
  const base = 4;
  const scale = Math.pow(1.28, zoom - 5);
  return Math.max(5, Math.min(22, base * scale));
}

function markerHtml(club, radius) {
  const d = radius * 2;
  const style = politicalStyle(club);
  const ring = style.ring
    ? `box-shadow:0 0 0 ${Math.max(1.5, radius * 0.22)}px ${style.ring};`
    : '';
  return `<div class="club-marker" style="width:${d}px;height:${d}px;background:${style.fill};${ring}display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:${style.text};font-size:${Math.max(6, radius * 0.55)}px;">${radius > 9 ? club.initials : ''}</div>`;
}

function currentFilteredClubs() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  return allClubs.filter(c => {
    const matchesLeague = !activeLeague || c.league === activeLeague;
    const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
    return matchesLeague && matchesQuery;
  });
}

function renderMarkers(clubs) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const zoom = map.getZoom();
  const radius = radiusForZoom(zoom);

  clubs.forEach(club => {
    if (club.lat == null || club.lon == null) return;

    const icon = L.divIcon({
      html: markerHtml(club, radius),
      className: '',
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius]
    });

    const marker = L.marker([club.lat, club.lon], { icon }).addTo(map);
    marker.on('click', () => showPanel(club));
    markers.push(marker);
  });

  document.getElementById('clubCount').textContent =
    `${clubs.length} club${clubs.length === 1 ? '' : 's'} shown · ${allClubs.length} in dataset`;
}

function showPanel(club) {
  const panel = document.getElementById('infoPanel');
  const content = document.getElementById('panelContent');
  const style = politicalStyle(club);
  const ringStyle = style.ring
    ? `box-shadow:0 0 0 3px ${style.ring}, 0 0 8px rgba(0,0,0,0.4);`
    : '';

  const isCategorized = club.political_category !== "No known political position";
  const recencyLabel = club.political_recency === "current" ? "Current" : club.political_recency === "historical" ? "Historical" : "";
  const politicalBlock = !isCategorized ? '' : `
    <div class="panel-record-label" style="margin-top:14px;">Supporter political leaning</div>
    <span class="panel-league-chip" style="background:${style.fill};color:${style.text};border-color:${style.fill};">${escapeHtml(club.political_category)} — ${escapeHtml(recencyLabel)}</span>
    <div class="panel-record" style="margin-top:6px;">${escapeHtml(club.political_explanation)}</div>
  `;

  content.innerHTML = `
    <div class="panel-header">
      <div class="crest" style="background:${style.fill};color:${style.text};${ringStyle}">${club.initials}</div>
      <div>
        <h2 class="panel-name">${escapeHtml(club.name)}</h2>
        <div class="panel-meta">${escapeHtml(club.city)}, ${escapeHtml(club.country)}</div>
      </div>
    </div>
    <span class="panel-league-chip">${escapeHtml(club.league)}</span>
    <div class="panel-record-label">Record</div>
    <div class="panel-record">${escapeHtml(club.record)}</div>
    ${politicalBlock}
    <button class="panel-suggest-link" type="button" onclick="openSuggestFor('${escapeHtml(club.name).replace(/'/g, "\\'")}')">Suggest a correction for ${escapeHtml(club.name)}</button>
  `;

  panel.classList.remove('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => {
    const filtered = currentFilteredClubs();
    renderMarkers(filtered);
    if (filtered.length === 1 && input.value.trim()) {
      map.setView([filtered[0].lat, filtered[0].lon], 9);
      showPanel(filtered[0]);
    }
  });
}

function setupLeagueFilter() {
  const select = document.getElementById('leagueSelect');
  const leagues = [...new Set(allClubs.map(c => `${c.country} — ${c.league}`))].sort();
  const leagueMap = {};
  allClubs.forEach(c => { leagueMap[`${c.country} — ${c.league}`] = c.league; });

  leagues.forEach(label => {
    const opt = document.createElement('option');
    opt.value = leagueMap[label];
    opt.textContent = label;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    activeLeague = select.value;
    renderMarkers(currentFilteredClubs());
  });
}

function setupClosePanel() {
  document.getElementById('closePanel').addEventListener('click', () => {
    document.getElementById('infoPanel').classList.add('hidden');
  });
}

function setupAboutModal() {
  const modal = document.getElementById('aboutModal');
  const openBtn = document.getElementById('aboutBtn');
  const closeBtn = document.getElementById('aboutModalClose');
  const dismissBtn = document.getElementById('aboutModalDismiss');

  const open = () => modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  dismissBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  open();
}

function setupSuggestModal() {
  const modal = document.getElementById('suggestModal');
  const openBtn = document.getElementById('suggestBtn');
  const closeBtn = document.getElementById('suggestModalClose');
  const sendBtn = document.getElementById('suggestSend');
  const clubInput = document.getElementById('suggestClub');
  const textInput = document.getElementById('suggestText');

  const open = () => modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  sendBtn.addEventListener('click', () => {
    const club = clubInput.value.trim();
    const body = textInput.value.trim();
    const subject = `PolitiFoot correction suggestion${club ? ' — ' + club : ''}`;
    const bg = [
      club ? `Club: ${club}` : '',
      '',
      body || '(describe the suggested correction here)',
      '',
      '---',
      'Please include a source (newspaper, magazine, established media outlet, or academic research) for any factual claim.'
    ].filter(Boolean).join('\n');
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bg)}`;
    window.location.href = mailto;
  });
}

// Pre-fills the suggestion form with the currently viewed club's name.
function openSuggestFor(clubName) {
  const modal = document.getElementById('suggestModal');
  document.getElementById('suggestClub').value = clubName || '';
  modal.classList.remove('hidden');
}

async function loadClubs() {
  const res = await fetch('clubs.json');
  const clubs = await res.json();
  allClubs = clubs;
  setupLeagueFilter();
  renderMarkers(allClubs);
}

initMap();
setupSearch();
setupClosePanel();
setupAboutModal();
setupSuggestModal();
loadClubs();
