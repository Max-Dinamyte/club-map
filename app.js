let map;
let markers = [];
let allClubs = [];
let activeLeague = "";
let showUnaffiliated = false;

const BROWN = "#7b4b27";
const BRIGHT_RED = "#ff1744";
const WHITE = "#ffffff";

// Dot color = political direction. Solid brown = right-wing, solid neon red = left-wing,
// diagonal half-and-half = split (documented groups pointing in both directions), white = unaffiliated.
function politicalStyle(club) {
  const cat = club.political_category;

  if (cat === "Split") {
    return {
      background: `linear-gradient(135deg, ${BROWN} 0%, ${BROWN} 50%, ${BRIGHT_RED} 50%, ${BRIGHT_RED} 100%)`,
      text: "#f4f7ee"
    };
  }

  let color = WHITE;
  let text = "#0a0e14";
  if (cat === "Right-wing") { color = BROWN; text = "#f4f7ee"; }
  else if (cat === "Left-wing") { color = BRIGHT_RED; text = "#f4f7ee"; }

  return { background: color, text };
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
  const style = politicalStyle(club);
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
  const style = politicalStyle(club);
  const isUnaffiliated = club.political_category === "No known political position";
  const crestRadius = isUnaffiliated ? '6px' : '50%';

  header.innerHTML = `
    <div class="crest" style="background:${style.background};color:${style.text};border-radius:${crestRadius};">${club.initials}</div>
    <div>
      <h2 class="panel-name">${escapeHtml(club.name)}</h2>
      <div class="panel-meta">${escapeHtml(club.city)}, ${escapeHtml(club.country)}</div>
    </div>
  `;

  const isSplit = club.political_category === "Split";
  const chipColor = isSplit ? style.background : club.political_category === "Right-wing" ? BROWN : club.political_category === "Left-wing" ? BRIGHT_RED : WHITE;
  const chipLabel = isSplit ? "Split — opposing factions" : club.political_category;

  const groups = club.political_groups || [];
  let politicalBlock = '';
  if (!isUnaffiliated && groups.length) {
    const groupBlocks = groups.map(g => {
      const linksHtml = g.sources.map((url, i) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="source-link">[${i + 1}]</a>`
      ).join(' ');
      return `
        <div class="group-block">
          <div class="group-name">${escapeHtml(g.name)}</div>
          <div class="panel-record">${escapeHtml(g.note)}</div>
          ${linksHtml ? `<div class="source-links">Sources: ${linksHtml}</div>` : ''}
        </div>
      `;
    }).join('');

    politicalBlock = `
      <div class="panel-record-label" style="margin-top:16px;">Supporter political leaning</div>
      <span class="panel-league-chip" style="background:${chipColor};color:${style.text};border-color:${WHITE};">${escapeHtml(chipLabel)}</span>
      ${groupBlocks}
    `;
  }

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
  const arrow = callout.querySelector('.callout-arrow');
  const toggle = document.getElementById('unaffToggleDesktop');
  if (window.innerWidth <= 780) return; // desktop-only; toggle lives in the mobile menu on small screens

  const toggleRect = toggle.getBoundingClientRect();
  const calloutWidth = 280;
  const margin = 12;

  // Center the callout under the toggle, but keep it fully within the viewport.
  let left = toggleRect.left + toggleRect.width / 2 - calloutWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - calloutWidth - margin));
  const top = toggleRect.bottom + 10;

  callout.style.left = `${left}px`;
  callout.style.top = `${top}px`;

  // Point the arrow at the horizontal center of the toggle, wherever that falls within the callout.
  const arrowLeft = Math.max(16, Math.min(toggleRect.left + toggleRect.width / 2 - left - 6, calloutWidth - 28));
  arrow.style.left = `${arrowLeft}px`;
  arrow.style.right = 'auto';

  callout.classList.remove('hidden');
}

function setupUnaffCallout() {
  document.getElementById('unaffCalloutClose').addEventListener('click', () => {
    document.getElementById('unaffCallout').classList.add('hidden');
  });
  window.addEventListener('resize', () => {
    const callout = document.getElementById('unaffCallout');
    if (!callout.classList.contains('hidden')) showUnaffCallout();
  });
}

// Fill in with a dedicated inbox for this project (not your personal email) — see setup notes.
const SUGGESTIONS_EMAIL = "politifoot@proton.me";

function setupSuggestModal() {
  const modal = document.getElementById('suggestModal');
  const closeBtn = document.getElementById('suggestModalClose');
  const sendBtn = document.getElementById('suggestSend');
  const clubInput = document.getElementById('suggestClub');
  const textInput = document.getElementById('suggestText');
  const statusEl = document.getElementById('suggestStatus');
  const openBtns = [document.getElementById('suggestBtn'), document.getElementById('suggestBtnMobile')];

  const open = () => {
    modal.classList.remove('hidden');
    closeMobileMenu();
    statusEl.textContent = '';
    statusEl.className = 'modal-note modal-note-small';
    sendBtn.disabled = false;
    sendBtn.textContent = 'Submit suggestion';
  };
  const close = () => modal.classList.add('hidden');

  openBtns.forEach(b => b.addEventListener('click', () => open()));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  sendBtn.addEventListener('click', async () => {
    const club = clubInput.value.trim();
    const comment = textInput.value.trim();

    if (!comment) {
      statusEl.textContent = 'Please describe the suggested correction before submitting.';
      statusEl.className = 'modal-note modal-note-small modal-note-error';
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Submitting…';
    statusEl.textContent = '';

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${SUGGESTIONS_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `PolitiFoot correction suggestion${club ? ' — ' + club : ''}`,
          club: club || '(not specified)',
          comment: comment,
          page_url: window.location.href
        })
      });

      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      statusEl.textContent = 'Thanks — your suggestion has been sent.';
      statusEl.className = 'modal-note modal-note-small modal-note-success';
      clubInput.value = '';
      textInput.value = '';
      sendBtn.textContent = 'Sent';
      setTimeout(close, 500);
    } catch (err) {
      statusEl.textContent = 'Something went wrong sending this. Please try again in a moment.';
      statusEl.className = 'modal-note modal-note-small modal-note-error';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Submit suggestion';
    }
  });
}

function openSuggestFor(clubName) {
  document.getElementById('suggestClub').value = clubName || '';
  document.getElementById('suggestText').value = '';
  const statusEl = document.getElementById('suggestStatus');
  statusEl.textContent = '';
  statusEl.className = 'modal-note modal-note-small';
  const sendBtn = document.getElementById('suggestSend');
  sendBtn.disabled = false;
  sendBtn.textContent = 'Submit suggestion';
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

  showBtns.forEach(b => b.classList.toggle('toggle-btn-active', showUnaffiliated));
  hideBtns.forEach(b => b.classList.toggle('toggle-btn-active', !showUnaffiliated));
}

async function loadClubs() {
  const res = await fetch('clubs.json');
  const clubs = await res.json();
  allClubs = clubs;
  setupLeagueFilter();
  renderMarkers(currentFilteredClubs());
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
