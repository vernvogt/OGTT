/* ---------------- Global state ---------------- */
let currentPage = "leaderboard";
let currentPeriod = "2026";
let currentReportYear = "2026";
let currentResultsYear = "2026";
let searchTerm = "";

const PERIODS = ["2026","2025","Overall"];
const PERIOD_LABEL = { "2026": "01 Jan – 31 Dec 2026", "2025": "01 Jul – 31 Dec 2025", "Overall": "All Time" };
const PERIOD_TAB_TITLE = { "2026": "2026", "2025": "2025", "Overall": "All-Time" };

const YEARS = ["2026","2025","2024"];

let PARTICIPANTS = [];
let REPORTS = [];
let RACE_RESULTS = [];
let reportsByDate = {};

function fmtDate(iso){
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function ordinal(n){ const s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function badgeClass(posStr){
  const n = parseInt(posStr, 10);
  if(n === 1) return "gold"; if(n === 2) return "silver"; if(n === 3) return "bronze"; return "";
}
// Turns a raw position value (which may be a plain number, or a coded status
// like "DNF", "1 (S2)", "3 (Short Course)") into a small badge string plus an
// optional clear-language label to display alongside it.
function humanizePosition(posRaw){
  const pos = String(posRaw).trim();
  const STATUS = {
    'DNF': { badge: 'DNF', label: 'Did Not Finish' },
    'DNS': { badge: 'DNS', label: 'Did Not Start' },
    'DQ': { badge: 'DQ', label: 'Disqualified' },
    'SIGIS': { badge: 'SIG', label: 'SIGIS' },
    'DRIVER': { badge: 'DRV', label: 'Driver' }
  };
  if(STATUS[pos.toUpperCase()]) return STATUS[pos.toUpperCase()];
  let m = pos.match(/^(\d+)\s*\(S2\)$/i);
  if(m) return { badge: m[1], label: 'Doubles' };
  m = pos.match(/^(\d+)\s*\(Short\s*Course\)$/i);
  if(m) return { badge: m[1], label: null }; // already shown under a "Short Course" section heading
  if(!isNaN(parseInt(pos, 10))){
    return { badge: pos, label: null };
  }
  return { badge: pos.slice(0,4), label: null };
}
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------------- Top-level page nav ---------------- */
function renderPageNav(){
  const wrap = document.getElementById('page-nav');
  const pages = [
    {id:'leaderboard', label:'Leaderboard'},
    {id:'reports', label:'Race Reports'},
    {id:'results', label:'Race Results'}
  ];
  wrap.innerHTML = "";
  pages.forEach(pg => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (pg.id === currentPage ? ' active' : '');
    btn.textContent = pg.label;
    btn.onclick = () => { currentPage = pg.id; showPage(); };
    wrap.appendChild(btn);
  });
}
function showPage(){
  renderPageNav();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + currentPage).classList.add('active');
}

/* ---------------- Leaderboard ---------------- */
function renderTabs(){
  const wrap = document.getElementById('tabs');
  wrap.innerHTML = "";
  PERIODS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (p === currentPeriod ? ' active' : '');
    btn.innerHTML = PERIOD_TAB_TITLE[p] + '<span class="sub">' + PERIOD_LABEL[p] + '</span>';
    btn.onclick = () => { currentPeriod = p; renderTabs(); renderBoard(); };
    wrap.appendChild(btn);
  });
}

function renderBoard(){
  document.getElementById('board-title').textContent =
    currentPeriod === "Overall" ? "All-Time Leaderboard" : "Leaderboard — " + PERIOD_LABEL[currentPeriod];

  let list = PARTICIPANTS
    .map(p => ({ p, entries: p.entries[currentPeriod]||0, points: p.points[currentPeriod]||0 }))
    .filter(x => x.entries > 0);

  if(searchTerm.trim()){
    const t = searchTerm.trim().toLowerCase();
    list = list.filter(x => x.p.name.toLowerCase().includes(t) || x.p.nickname.toLowerCase().includes(t));
  }

  list.sort((a,b) => b.points - a.points || b.entries - a.entries);

  document.getElementById('board-meta').textContent = list.length + " paddlers · " + list.reduce((s,x)=>s+x.entries,0) + " entries logged";

  const board = document.getElementById('board');
  board.innerHTML = "";
  const head = document.createElement('div');
  head.className = 'board-row head';
  head.innerHTML = '<div>#</div><div>Paddler</div><div style="text-align:right">Entries</div><div style="text-align:right">Points</div>';
  board.appendChild(head);

  if(list.length === 0){
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.textContent = "No results found for this period.";
    board.appendChild(e);
    return;
  }

  list.forEach((x, i) => {
    const row = document.createElement('div');
    row.className = 'board-row';
    const rankClass = i===0 ? 'top1' : i===1 ? 'top2' : i===2 ? 'top3' : '';
    row.innerHTML = `
      <div class="rank ${rankClass}">${i+1}</div>
      <div class="who"><div class="name">${x.p.name}</div><div class="nick">"${x.p.nickname}"</div></div>
      <div class="num">${x.entries}</div>
      <div class="num points">${x.points}</div>
    `;
    row.onclick = () => openParticipant(x.p);
    board.appendChild(row);
  });
}

function openParticipant(p){
  const modal = document.getElementById('modal');
  const races = p.races
    .filter(r => currentPeriod === "Overall" || r.period === currentPeriod)
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date));

  const raceRows = races.map(r => {
    const has = reportsByDate[r.date];
    const hp = humanizePosition(r.position);
    return `
      <div class="race-item" data-date="${r.date}" ${has ? '' : 'style="cursor:default"'}>
        <div class="pos-badge ${badgeClass(r.position)}">${hp.badge}</div>
        <div class="race-info">
          <div class="date">${fmtDate(r.date)}${hp.label ? ` <span class="pos-label">· ${hp.label}</span>` : ''}</div>
          <div class="period-tag">${r.period === 'Other' ? 'earlier' : r.period}${has ? ' · <span class="has-report">race report ↓</span>' : ''}</div>
        </div>
        <div class="race-pts">${r.points} pt${r.points===1?'':'s'}</div>
      </div>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="modal-head">
      <button class="close" id="modal-close">✕</button>
      <h3>${p.name}</h3>
      <div class="nick">"${p.nickname}"</div>
      <div class="stat-row">
        <div class="stat-card"><div class="label">Entries (Overall)</div><div class="value">${p.entries["Overall"]}</div></div>
        <div class="stat-card"><div class="label">Points (Overall)</div><div class="value">${p.points["Overall"]}</div></div>
        <div class="stat-card"><div class="label">2025 Pts</div><div class="value">${p.points["2025"]}</div></div>
        <div class="stat-card"><div class="label">2026 Pts</div><div class="value">${p.points["2026"]}</div></div>
      </div>
    </div>
    <div class="modal-body">
      <div class="race-list-title">${races.length} race${races.length===1?'':'s'} ${currentPeriod==="Overall" ? "(all-time)" : "in " + PERIOD_LABEL[currentPeriod]}</div>
      ${races.length ? raceRows : '<div class="empty-state">No races in this period.</div>'}
    </div>
  `;
  document.getElementById('modal-close').onclick = closeModal;
  modal.querySelectorAll('.race-item').forEach(el => {
    el.addEventListener('click', () => {
      const d = el.getAttribute('data-date');
      if(reportsByDate[d]){
        closeModal();
        const y = d.slice(0,4);
        currentPage = 'reports';
        currentReportYear = YEARS.includes(y) ? y : currentReportYear;
        showPage();
        renderReportYearTabs();
        renderReports();
        setTimeout(() => scrollToCard('report-' + d), 200);
      }
    });
  });
  document.getElementById('overlay').classList.add('open');
}
function closeModal(){ document.getElementById('overlay').classList.remove('open'); }
document.getElementById('overlay').addEventListener('click', (e) => { if(e.target.id === 'overlay') closeModal(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeModal(); });

function scrollToCard(id){
  const el = document.getElementById(id);
  if(el){
    el.setAttribute('open','');
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    el.style.transition = 'box-shadow .3s ease';
    el.style.boxShadow = '0 0 0 3px var(--buoy)';
    setTimeout(() => { el.style.boxShadow = ''; }, 1400);
  }
}

/* ---------------- Race Reports page ---------------- */
function renderReportYearTabs(){
  const wrap = document.getElementById('report-year-tabs');
  wrap.innerHTML = "";
  YEARS.forEach(y => {
    const count = REPORTS.filter(r => r.year == y || (r.date && r.date.slice(0,4)===y)).length;
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (y === currentReportYear ? ' active' : '');
    btn.innerHTML = y + '<span class="sub">' + count + ' report' + (count===1?'':'s') + '</span>';
    btn.onclick = () => { currentReportYear = y; renderReportYearTabs(); renderReports(); };
    wrap.appendChild(btn);
  });
}

function renderReports(){
  const wrap = document.getElementById('reports');
  wrap.innerHTML = "";
  const list = REPORTS.filter(r => String(r.year) === String(currentReportYear))
    .slice()
    .sort((a,b) => {
      if(a.date && b.date) return b.date.localeCompare(a.date);
      if(a.date) return -1;
      if(b.date) return 1;
      return (b.seq||0) - (a.seq||0);
    });

  document.getElementById('reports-meta').textContent = list.length + " report" + (list.length===1?'':'s') + " for " + currentReportYear;

  if(list.length === 0){
    wrap.innerHTML = '<div class="board"><div class="empty-state">No race reports on file for ' + currentReportYear + ' yet.</div></div>';
    return;
  }

  list.forEach(r => {
    const details = document.createElement('details');
    details.className = 'report-card';
    details.id = r.date ? ('report-' + r.date) : ('report-x-' + Math.random().toString(36).slice(2));

    const narrHtml = r.narrative.map(line => `<p>${escapeHtml(line)}</p>`).join("");
    const mainResults = (r.results || []).filter(res => res.group !== 'shortcourse');
    const scResults = (r.results || []).filter(res => res.group === 'shortcourse');

    const chipRow = (arr) => arr.map(res => {
      const hp = humanizePosition(res.position);
      return `<div class="chip"><span class="n">${hp.badge}</span>${escapeHtml(res.name)}${hp.label ? `<span class="chip-status">${hp.label}</span>` : ''}${typeof res.points === 'number' ? `<span class="chip-pts">${res.points}pt${res.points===1?'':'s'}</span>` : ''}</div>`;
    }).join("");

    const resultsHtml = mainResults.length ? `
      <div class="report-results">
        ${chipRow(mainResults)}
      </div>` : "";
    const scHtml = scResults.length ? `
      <div class="report-results sc-results">
        <div class="sc-label">Short Course</div>
        ${chipRow(scResults)}
      </div>` : "";

    const igLinks = r.instagramLinks || [];
    const igHtml = igLinks.length ? `
      <div class="ig-row" onclick="event.stopPropagation()">
        ${igLinks.map((url, i) => `
          <a class="ig-btn" href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2c-2.72 0-3.06.01-4.12.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2 8.94 2 9.28 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 22 9.28 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.43-.26-.66-.6-1.22-1.16-1.77-.55-.56-1.11-.9-1.77-1.16-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.21 1.85.34.47.18.8.4 1.15.75.35.35.57.68.75 1.15.13.36.3.88.34 1.85.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.21 1.5-.34 1.85-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.36.13-.88.3-1.85.34-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.21-1.85-.34-.47-.18-.8-.4-1.15-.75-.35-.35-.57-.68-.75-1.15-.13-.36-.3-.88-.34-1.85C3.8 14.99 3.8 14.67 3.8 12s.01-2.99.06-4.04c.04-.98.21-1.5.34-1.85.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.36-.13.88-.3 1.85-.34C9.01 3.8 9.33 3.8 12 3.8zm0 3.05a5.15 5.15 0 100 10.3 5.15 5.15 0 000-10.3zm0 8.5a3.35 3.35 0 110-6.7 3.35 3.35 0 010 6.7zm5.35-8.7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"/></svg>
            ${igLinks.length > 1 ? `Photos ${i+1}` : 'View on Instagram'}
          </a>`).join("")}
      </div>` : "";

    details.innerHTML = `
      <summary>
        <div>
          <div class="rdate">${r.date ? fmtDate(r.date) : currentReportYear}</div>
          <div class="rtitle">${escapeHtml(r.title || 'Race report')}</div>
        </div>
        <div class="rc-chev">▸</div>
      </summary>
      <div class="report-narr">${narrHtml}</div>
      ${resultsHtml}
      ${scHtml}
      ${igHtml}
    `;
    wrap.appendChild(details);
  });
}

/* ---------------- Race Results page ---------------- */
function renderResultsYearTabs(){
  const wrap = document.getElementById('results-year-tabs');
  wrap.innerHTML = "";
  YEARS.concat(['Earlier']).forEach(y => {
    const count = RACE_RESULTS.filter(r => yearOf(r.date) === y).length;
    if(count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (y === currentResultsYear ? ' active' : '');
    btn.innerHTML = y + '<span class="sub">' + count + ' race' + (count===1?'':'s') + '</span>';
    btn.onclick = () => { currentResultsYear = y; renderResultsYearTabs(); renderResults(); };
    wrap.appendChild(btn);
  });
}
function yearOf(dateIso){
  const y = dateIso.slice(0,4);
  return YEARS.includes(y) ? y : 'Earlier';
}

function renderResults(){
  const wrap = document.getElementById('results');
  wrap.innerHTML = "";
  const list = RACE_RESULTS.filter(r => yearOf(r.date) === currentResultsYear)
    .slice()
    .sort((a,b) => b.date.localeCompare(a.date));

  document.getElementById('results-meta').textContent = list.length + " race" + (list.length===1?'':'s') + " logged for " + currentResultsYear;

  if(list.length === 0){
    wrap.innerHTML = '<div class="board"><div class="empty-state">No race results logged for ' + currentResultsYear + '.</div></div>';
    return;
  }

  list.forEach(r => {
    const details = document.createElement('details');
    details.className = 'report-card';
    details.id = 'result-' + r.date;
    const has = reportsByDate[r.date];

    const isSC = (pos) => /short\s*course/i.test(String(pos));
    const mainRes = r.results.filter(res => !isSC(res.position));
    const scRes = r.results.filter(res => isSC(res.position));

    const chipRow = (arr) => arr.map(res => {
      const hp = humanizePosition(res.position);
      const special = isNaN(parseInt(res.position));
      return `<div class="chip ${special ? 'special' : ''}"><span class="n">${hp.badge}</span>${escapeHtml(res.name)}${hp.label ? `<span class="chip-status">${hp.label}</span>` : ''}<span class="chip-pts">${res.points}pt${res.points===1?'':'s'}</span></div>`;
    }).join("");

    const mainHtml = chipRow(mainRes);
    const scHtml = scRes.length ? `
      <div class="report-results sc-results" style="border-top:none;margin-top:12px;padding-top:0;">
        <div class="sc-label">Short Course</div>
        ${chipRow(scRes)}
      </div>` : "";

    details.innerHTML = `
      <summary>
        <div>
          <div class="rdate">${fmtDate(r.date)}</div>
          <div class="rtitle">${r.results.length} finisher${r.results.length===1?'':'s'}${has ? ' · <span class="has-report">has race report</span>' : ''}</div>
        </div>
        <div class="rc-chev">▸</div>
      </summary>
      <div class="report-results" style="border-top:none;margin-top:12px;padding-top:0;">${mainHtml}</div>
      ${scHtml}
      ${has ? `<div style="margin-top:12px;"><button class="tab-btn" style="display:inline-block;flex:none;" onclick="jumpToReport('${r.date}')">Read the race report →</button></div>` : ''}
    `;
    wrap.appendChild(details);
  });
}

function jumpToReport(date){
  const y = date.slice(0,4);
  currentPage = 'reports';
  currentReportYear = YEARS.includes(y) ? y : currentReportYear;
  showPage();
  renderReportYearTabs();
  renderReports();
  setTimeout(() => scrollToCard('report-' + date), 200);
}

/* ---------------- Search ---------------- */
document.getElementById('search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderBoard();
});

/* ---------------- Data loading & init ---------------- */
const DATA_URL = 'data.json?v=' + Date.now(); // cache-bust so a fresh deploy is always picked up

async function loadData(){
  const statusEl = document.getElementById('load-status');
  let primaryError = null;
  try{
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error('data.json responded with HTTP ' + res.status);
    const data = await res.json();
    PARTICIPANTS = data.participants || [];
    REPORTS = data.reports || [];
    RACE_RESULTS = data.raceResults || [];
    reportsByDate = {};
    REPORTS.forEach(r => { if(r.date) reportsByDate[r.date] = r; });
    return;
  } catch(err){
    primaryError = err;
    console.warn('Live data fetch failed, trying cache fallback', err);
  }
  try{
    const res = await fetch('data.json', { cache: 'force-cache' });
    if(!res.ok) throw new Error('data.json responded with HTTP ' + res.status);
    const data = await res.json();
    PARTICIPANTS = data.participants || [];
    REPORTS = data.reports || [];
    RACE_RESULTS = data.raceResults || [];
    if(statusEl) statusEl.textContent = "Showing last saved results (offline)";
  } catch(err2){
    const detail = primaryError ? primaryError.message : err2.message;
    if(statusEl) statusEl.textContent = "Couldn't load data.json (" + detail + "). Make sure data.json was uploaded alongside index.html on Netlify, then reload.";
    throw err2;
  }
  reportsByDate = {};
  REPORTS.forEach(r => { if(r.date) reportsByDate[r.date] = r; });
}

async function init(){
  await loadData();
  showPage();
  renderTabs();
  renderBoard();
  renderReportYearTabs();
  renderReports();
  renderResultsYearTabs();
  renderResults();
}

init();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // If a new service worker takes over control of this page (i.e. a fresh
      // deploy was picked up), reload once automatically so the new version
      // actually shows up, instead of silently staying on the old cached copy.
      let hasReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasReloaded) return;
        hasReloaded = true;
        window.location.reload();
      });

      // Whenever the app is reopened (e.g. from the home-screen icon after being
      // backgrounded), proactively ask the browser to check for a newer service
      // worker rather than waiting for its own periodic check.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });
    }).catch(err => console.warn('SW registration failed', err));
  });
}
