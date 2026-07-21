let map;
let markers = [];
let allClubs = [];
let activeLeague = "";
let showUnaffiliated = true;

const BROWN = "#7b4b27";
const BRIGHT_RED = "#ff1744";
const WHITE = "#ffffff";

// Dot color = political direction. A solid fill means currently affiliated (within the
// last 20 years); a white/color hatched pattern means historically affiliated (not within
// the last 20 years). No pattern at all when uncategorized.
function politicalStyle(club, stripePx) {
  const cat = club.political_category;
  const recency = club.political_recency;

  let color = WHITE;
  let text = "#0a0e14";
  if (cat === "Right-wing") { color = BROWN; text = "#f4f7ee"; }
  else if (cat === "Left-wing") { color = BRIGHT_RED; text = "#f4f7ee"; }

  let background;
  if ((cat === "Right-wing" || cat === "Left-wing") && recency === "historical") {
    const s = stripePx || 3;
    background = `repeating-linear-gradient(45deg, ${color} 0px, ${color} ${s}px, #ffffff ${s}px, #ffffff ${s * 2}px)`;
  } else {
    background = color;
  }

  return { background, text };
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
  map.on('click', closePanel);
}

// Radius in px, scaled by current zoom. Grows as you zoom in.
function radiusForZoom(zoom) {
  const base = 4;
  const scale = Math.pow(1.28, zoom - 5);
  return Math.max(5, Math.min(22, base * scale));
}

function markerHtml(club, radius) {
  const d = radius * 2;
  const stripePx = Math.max(2, Math.round(radius * 0.28));
  const style = politicalStyle(club, stripePx);
  const isUnaffiliated = club.political_category === "No known political position";
  const shapeClass = isUnaffiliated ? 'club-marker club-marker-square' : 'club-marker';
  return `<div class="${shapeClass}" style="width:${d}px;height:${d}px;background:${style.background};display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:${style.text};font-size:${Math.max(6, radius * 0.55)}px;">${radius > 9 ? club.initials : ''}</div>`;
}

function currentFilteredClubs() {
  const q = getSearchValue().trim().toLowerCase();
  return allClubs.filter(c => {
    const matchesLeague = !activeLeague || c.league === activeLeague;
    const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
    const matchesAffiliation = showUnaffiliated || c.political_category !== "No known political position";
    return matchesLeague && matchesQuery && matchesAffiliation;
  });
}

function getSearchValue() {
  const a = document.getElementById('searchInput');
  const b = document.getElementById('searchInputMobile');
  return (a && a.value) || (b && b.value) || '';
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
  const header = document.getElementById('panelHeaderTop');
  const content = document.getElementById('panelContent');
  const backdrop = document.getElementById('panelBackdrop');
  const style = politicalStyle(club, 5);
  const isUnaffiliated = club.political_category === "No known political position";
  const crestRadius = isUnaffiliated ? '6px' : '50%';

  header.innerHTML = `
    <div class="crest" style="background:${style.background};color:${style.text};border-radius:${crestRadius};">${club.initials}</div>
    <div>
      <h2 class="panel-name">${escapeHtml(club.name)}</h2>
      <div class="panel-meta">${escapeHtml(club.city)}, ${escapeHtml(club.country)}</div>
    </div>
  `;

  const isCategorized = club.political_category !== "No known political position";
  const recencyLabel = club.political_recency === "current" ? "Current" : club.political_recency === "historical" ? "Historical" : "";
  const chipColor = club.political_category === "Right-wing" ? BROWN : club.political_category === "Left-wing" ? BRIGHT_RED : WHITE;
  const politicalBlock = !isCategorized ? '' : `
    <div class="panel-record-label" style="margin-top:16px;">Supporter political leaning</div>
    <span class="panel-league-chip" style="background:${chipColor};color:${style.text};border-color:${chipColor};">${escapeHtml(club.political_category)} — ${escapeHtml(recencyLabel)}</span>
    <div class="panel-record" style="margin-top:6px;">${escapeHtml(club.political_explanation)}</div>
  `;

  content.innerHTML = `
    <span class="panel-league-chip">${escapeHtml(club.league)}</span>
    <div class="panel-record-label">Record</div>
    <div class="panel-record">${escapeHtml(club.record)}</div>
    ${politicalBlock}
    <button class="panel-suggest-link" type="button" onclick="openSuggestFor('${escapeHtml(club.name).replace(/'/g, "\\'")}')">Suggest a correction for ${escapeHtml(club.name)}</button>
  `;

  panel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}

function closePanel() {
  document.getElementById('infoPanel').classList.add('hidden');
  document.getElementById('panelBackdrop').classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setupSearch() {
  const handler = () => {
    const filtered = currentFilteredClubs();
    renderMarkers(filtered);
    if (filtered.length === 1 && getSearchValue().trim()) {
      map.setView([filtered[0].lat, filtered[0].lon], 9);
      showPanel(filtered[0]);
    }
  };
  const a = document.getElementById('searchInput');
  const b = document.getElementById('searchInputMobile');
  a.addEventListener('input', () => { b.value = a.value; handler(); });
  b.addEventListener('input', () => { a.value = b.value; handler(); });
}

function setupLeagueFilter() {
  const selects = [document.getElementById('leagueSelect'), document.getElementById('leagueSelectMobile')];
  const leagues = [...new Set(allClubs.map(c => `${c.country} — ${c.league}`))].sort();
  const leagueMap = {};
  allClubs.forEach(c => { leagueMap[`${c.country} — ${c.league}`] = c.league; });

  selects.forEach(select => {
    leagues.forEach(label => {
      const opt = document.createElement('option');
      opt.value = leagueMap[label];
      opt.textContent = label;
      select.appendChild(opt);
    });
  });

  selects.forEach(select => {
    select.addEventListener('change', () => {
      activeLeague = select.value;
      selects.forEach(s => { s.value = select.value; });
      renderMarkers(currentFilteredClubs());
    });
  });
}

function setupClosePanel() {
  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('panelBackdrop').addEventListener('click', closePanel);
}

function setupAboutModal() {
  const modal = document.getElementById('aboutModal');
  const closeBtn = document.getElementById('aboutModalClose');
  const dismissBtn = document.getElementById('aboutModalDismiss');
  const openBtns = [document.getElementById('aboutBtn'), document.getElementById('aboutBtnMobile')];

  let isInitialOpen = true;

  const open = () => { modal.classList.remove('hidden'); closeMobileMenu(); };
  const close = () => {
    modal.classList.add('hidden');
    if (isInitialOpen) {
      isInitialOpen = false;
      showUnaffCallout();
    }
  };

  openBtns.forEach(b => b.addEventListener('click', () => { isInitialOpen = false; open(); }));
  closeBtn.addEventListener('click', close);
  dismissBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  open();
}

function showUnaffCallout() {
  const callout = document.getElementById('unaffCallout');
  if (window.innerWidth <= 780) return; // desktop-only; toggle lives in the mobile menu on small screens
  callout.classList.remove('hidden');
}

function setupUnaffCallout() {
  document.getElementById('unaffCalloutClose').addEventListener('click', () => {
    document.getElementById('unaffCallout').classList.add('hidden');
  });
}

function setupSuggestModal() {
  const modal = document.getElementById('suggestModal');
  const closeBtn = document.getElementById('suggestModalClose');
  const sendBtn = document.getElementById('suggestSend');
  const clubInput = document.getElementById('suggestClub');
  const textInput = document.getElementById('suggestText');
  const openBtns = [document.getElementById('suggestBtn'), document.getElementById('suggestBtnMobile')];

  const open = () => { modal.classList.remove('hidden'); closeMobileMenu(); };
  const close = () => modal.classList.add('hidden');

  openBtns.forEach(b => b.addEventListener('click', () => open()));
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

function openSuggestFor(clubName) {
  document.getElementById('suggestClub').value = clubName || '';
  document.getElementById('suggestModal').classList.remove('hidden');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.add('hidden');
}

function setupMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('mobileMenuBtn');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) menu.classList.add('hidden');
  });

  document.getElementById('legendToggleBtn').addEventListener('click', () => {
    const legend = document.getElementById('legendBar');
    const nowVisible = legend.classList.toggle('legend-visible');
    document.getElementById('legendToggleBtn').textContent = nowVisible ? 'Hide legend' : 'Show legend';
    closeMobileMenu();
  });
}

function setupUnaffiliatedToggle() {
  const showBtns = [document.getElementById('unaffShowBtn'), document.getElementById('unaffShowBtnMobile')];
  const hideBtns = [document.getElementById('unaffHideBtn'), document.getElementById('unaffHideBtnMobile')];

  const applyState = () => {
    showBtns.forEach(b => b.classList.toggle('toggle-btn-active', showUnaffiliated));
    hideBtns.forEach(b => b.classList.toggle('toggle-btn-active', !showUnaffiliated));
    renderMarkers(currentFilteredClubs());
  };

  showBtns.forEach(b => b.addEventListener('click', () => { showUnaffiliated = true; applyState(); }));
  hideBtns.forEach(b => b.addEventListener('click', () => { showUnaffiliated = false; applyState(); }));
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
setupMobileMenu();
setupUnaffiliatedToggle();
setupAboutModal();
setupSuggestModal();
setupUnaffCallout();
loadClubs();
