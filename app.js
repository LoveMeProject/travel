// ===== 가족 여행 앱 · SPA =====
let DATA = loadData();
let route = { name: 'home', homeTab: 'upcoming' };
let ME = localStorage.getItem('ft_me') || null; // 이 기기 사용자 (mom/dad/son)
const app = document.getElementById('app');

// ---- helpers ----
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function go(r) { route = { ...route, ...r }; render(); window.scrollTo(0, 0); }

// ---- 저장 + 클라우드 동기화 ----
let _pushCache = {}; // id -> 마지막으로 클라우드에 올린 JSON
let _attachPhoto = null; // 메모 첨부 사진 임시보관
function persist() { saveData(DATA); cloudSync(); }
function cloudSync() {
  // 변경된 여행만 클라우드에 올림. (자동 삭제는 하지 않음 — 삭제는 delTrip에서만)
  if (!window.SB) return;
  DATA.trips.forEach(t => {
    const js = JSON.stringify(t);
    if (_pushCache[t.id] !== js) {
      _pushCache[t.id] = js;
      SB.from('trips').upsert({ id: t.id, data: t, updated_at: new Date().toISOString() })
        .then(r => { if (r.error) console.error('upsert', r.error); });
    }
  });
}
function cloudDeleteTrip(id) {
  if (!window.SB) return;
  delete _pushCache[id];
  SB.from('trips').delete().eq('id', id).then(r => { if (r.error) console.error('delete', r.error); });
}
function seedCache() { _pushCache = {}; DATA.trips.forEach(t => { _pushCache[t.id] = JSON.stringify(t); }); }

// ---- 사용자(나는 누구) ----
function setMe(k) { ME = k; localStorage.setItem('ft_me', k); render(); }
function changeMe() { ME = null; localStorage.removeItem('ft_me'); render(); }
function renderIdentity() {
  app.innerHTML = `
    <div style="padding:calc(var(--safe-top) + 80px) 28px 40px;text-align:center;">
      <div style="font-size:26px;font-weight:700;margin-bottom:10px;">누구세요?</div>
      <div style="font-size:15px;color:var(--text-2);margin-bottom:32px;">이 기기에서 사용할 사람을 골라주세요.<br>올린 기록에 이 이름이 표시돼요.</div>
      ${Object.entries(MEMBERS).map(([k, m]) => `
        <button onclick="setMe('${k}')" style="width:100%;padding:18px;border-radius:14px;margin-bottom:12px;font-size:18px;font-weight:600;background:var(--surface);border:1px solid var(--border);">
          ${m.label} <span style="color:var(--text-3);font-weight:400;font-size:15px;">${m.name}</span>
        </button>`).join('')}
    </div>`;
}
function getTrip(id) { return DATA.trips.find(t => t.id === id); }
function memberAv(key) { const m = MEMBERS[key]; return m ? `<span class="av ${m.cls}">${m.label}</span>` : ''; }
function memberLabel(key) { return MEMBERS[key] ? MEMBERS[key].label : key; }
function openMap(q) { if (!q) return; window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q), '_blank'); }
function openUrl(u) { if (u) window.open(u, '_blank'); }
function nearbyFood(name) { window.open('https://www.google.com/maps/search/' + encodeURIComponent('맛집 near ' + name), '_blank'); }

const CAT = { food: { label: '맛집', emoji: '🍜' }, sight: { label: '관광', emoji: '📸' }, idea: { label: '아이디어', emoji: '💡' }, hotel: { label: '숙소', emoji: '🏨' }, move: { label: '이동', emoji: '🚗' }, shopping: { label: '쇼핑', emoji: '🛍️' } };
const TYPE_EMOJI = { flight: '✈️', hotel: '🏨', food: '🍜', sight: '📸', activity: '🎯', memo: '📝', move: '🚗', shopping: '🛍️' };
// 구글맵 place URL에서 이름 추출 (네이버 단축링크 등은 불가 → 빈 문자열)
function nameFromMapUrl(url) {
  try { const m = decodeURIComponent(url).match(/\/place\/([^\/@?]+)/); if (m) return m[1].replace(/\+/g, ' ').trim(); } catch (e) {}
  return '';
}

// ================= RENDER =================
function render() {
  if (!ME) return renderIdentity();
  if (route.name === 'home') return renderHome();
  const t = getTrip(route.tripId);
  if (!t) { route = { name: 'home' }; return renderHome(); }
  if (route.name === 'trip') return renderTrip(t);
  if (route.name === 'flights') return renderFlights(t);
  if (route.name === 'hotels') return renderHotels(t);
  if (route.name === 'checklist') return renderChecklist(t);
  if (route.name === 'memos') return renderMemos(t);
}

// ---------------- HOME ----------------
function renderHome() {
  // 탭 없이 한 리스트: 진행중 → 예정(가까운 순) → 지난(최근 순)
  const rank = { ongoing: 0, upcoming: 1, past: 2 };
  const list = DATA.trips.slice().sort((a, b) => {
    const sa = tripStatus(a), sb = tripStatus(b);
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
    return sa === 'past' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start);
  });

  app.innerHTML = `
    <div class="home-header">
      <div>
        <div class="title">우리 가족 여행</div>
        <div class="sub">나: <b style="color:var(--text-2)">${ME ? MEMBERS[ME].label : ''}</b> · <span class="linkbtn" onclick="changeMe()">바꾸기</span></div>
      </div>
      <button class="fab-round" onclick="sheetNewTrip()">+</button>
    </div>
    <div class="page" style="padding-top:14px;">
      ${list.length ? list.map(tripCardHtml).join('') : `<div class="empty"><span class="ico">🧳</span>아직 여행이 없어요.<br>+ 버튼으로 새 여행을 만들어 보세요.</div>`}
    </div>
  `;
}

function tripCardHtml(t) {
  const st = tripStatus(t);
  const dd = dday(t.start);
  const savedFood = (t.saved || []).filter(s => s.cat === 'food').length;
  let rightTag = '';
  if (st === 'upcoming' && dd) rightTag = `<span class="badge">${dd}</span>`;
  else if (st === 'ongoing') rightTag = `<span class="badge">여행중</span>`;
  else if (st === 'past') rightTag = `<span class="badge gray">${dplus(t.end) || '지난 여행'}</span>`;
  let metaExtra = '';
  if (st === 'past') metaExtra = t.memories && t.memories.length ? ` · 구글포토 ${t.memories.length}` : (savedFood ? ` · 맛집 ${savedFood}곳` : '');
  return `
    <div class="trip-card ${st === 'past' ? 'past' : 'upcoming'}" onclick="go({name:'trip',tripId:'${t.id}',tab:'plan'})">
      <div class="row">
        <div class="name">${esc(t.name)}</div>
        ${rightTag}
      </div>
      <div class="meta">${fmtRange(t.start, t.end)} · ${nights(t.start, t.end)} · ${t.members.length}명${metaExtra}</div>
    </div>
  `;
}

// ---------------- TRIP DETAIL ----------------
function renderTrip(t) {
  const tab = route.tab || 'plan';
  let content = '';
  if (tab === 'plan') content = planView(t);
  else if (tab === 'map') content = mapView(t);
  else if (tab === 'saved') content = savedView(t);
  else if (tab === 'memory') content = memoryView(t);

  app.innerHTML = `
    <div class="topbar">
      <button class="back" onclick="go({name:'home'})">‹</button>
      <h1>${esc(t.name)}</h1>
      <div class="actions"><span onclick="sheetTrip('${t.id}')">${EDIT_ICON}</span><span onclick="openMap('${esc(t.dest)}')">${NAV_ICON.map}</span></div>
    </div>
    ${tab === 'plan' ? tripChips(t) : ''}
    <div class="page page-scroll">${content}</div>
    ${fabFor(t, tab)}
    ${bottomNav(t.id, tab)}
  `;
}

function tripChips(t) {
  return `
    <div class="trip-head">
      <div class="name">${esc(t.name)}</div>
      <div class="dates">${fmtRange(t.start, t.end)} · ${t.members.map(m => memberLabel(m)).join('·')}</div>
    </div>
    <div class="chips">
      <button class="chip ${t.flights.length ? 'filled' : ''}" onclick="go({name:'flights',tripId:'${t.id}'})">항공${t.flights.length ? ' ' + t.flights.length : ''}</button>
      <button class="chip ${t.hotels.length ? 'filled' : ''}" onclick="go({name:'hotels',tripId:'${t.id}'})">숙소${t.hotels.length ? ' ' + t.hotels.length : ''}</button>
      <button class="chip" onclick="go({name:'checklist',tripId:'${t.id}'})">체크</button>
      <button class="chip" onclick="go({name:'memos',tripId:'${t.id}'})">메모</button>
    </div>
  `;
}

const NAV_ICON = {
  plan: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4" stroke-linecap="round"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  saved: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" stroke-linejoin="round"/></svg>',
  memory: '<svg viewBox="0 0 24 24"><rect x="3" y="6.5" width="18" height="14" rx="2.5"/><path d="M8 6.5l1.5-2.5h5L16 6.5" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
};
const EDIT_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17v3z"/><path d="M13.5 6.5l4 4"/></svg>';
function bottomNav(tripId, tab) {
  const items = [['plan', '일정'], ['map', '지도'], ['saved', '저장함'], ['memory', '추억']];
  return `<div class="bottomnav">${items.map(([k, lb]) =>
    `<button class="${tab === k ? 'on' : ''}" onclick="go({name:'trip',tripId:'${tripId}',tab:'${k}'})">${NAV_ICON[k]}${lb}</button>`
  ).join('')}</div>`;
}

function fabFor(t, tab) {
  if (tab === 'saved') return `<button class="fab" onclick="sheetSaved('${t.id}')">+</button>`;
  return '';
}

// 해당 날짜(dateIso)에 뜨는 항공편 (출발 날짜로 매칭)
function flightsForDate(t, dateIso) {
  const d = new Date(dateIso + 'T00:00:00'), y = d.getFullYear(), mm = d.getMonth() + 1, dd = d.getDate();
  return (t.flights || []).filter(f => {
    if (f.depDate) { const p = f.depDate.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return p && +p[1] === y && +p[2] === mm && +p[3] === dd; }
    const m = (f.dep || '').match(/(\d{1,2})[.\/-](\d{1,2})/); return m && +m[1] === mm && +m[2] === dd; // 구 데이터 fallback
  });
}
function flightTime(f) { if (f.depTime) return f.depTime; const m = (f.dep || '').match(/(\d{1,2}:\d{2})/); return m ? m[1] : ''; }

// ---- 일정(plan) ----
function planView(t) {
  return t.days.map((d, di) => {
    // 일반 아이템 + 항공편(자동 이동 표시)을 시간순으로 합치기
    const rows = [
      ...d.items.map(it => ({ kind: 'item', time: it.time || '', it })),
      ...flightsForDate(t, d.date).map(f => ({ kind: 'flight', time: flightTime(f), f })),
    ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return `
      <div class="day-block">
        <div class="day-head">
          <span class="dnum">day ${di + 1}</span>
          <span class="ddate">${fmtDate(d.date)} / ${weekday(d.date)}</span>
          <span class="weather">${esc(d.weather || '')}</span>
        </div>
        ${rows.map(r => r.kind === 'item' ? itemHtml(t, di, r.it) : flightItemHtml(t, r.f)).join('')}
        <div class="day-actions">
          <button onclick="sheetItem('${t.id}', ${di})">＋ 장소 추가</button>
          <button onclick="sheetItem('${t.id}', ${di}, 'memo')">＋ 메모 추가</button>
        </div>
      </div>
    `;
  }).join('');
}

// 항공편을 일정에 '이동' 카드로 표시 (탭하면 항공 편집)
function flightItemHtml(t, f) {
  return `
    <div class="item" onclick="sheetFlight('${t.id}','${f.id}')">
      <div class="time-col"><span class="time">${esc(flightTime(f))}</span><span class="dot accent"></span></div>
      <div class="body accent">
        <span class="type-emoji">✈️</span>
        <div class="t-name">${esc(f.route)}<span class="t-tag">항공</span></div>
        <div class="t-sub">${esc(f.airline || '')}${flightArrStr(f) ? ' · ' + esc(flightDepStr(f)) + ' → ' + esc(flightArrStr(f)) : ''}</div>
      </div>
    </div>
  `;
}

function itemHtml(t, di, it, ii, total) {
  const bodyCls = it.type === 'food' ? 'warn' : (it.type === 'flight' ? 'accent' : '');
  const linkTxt = (it.links || []).map(l => l.kind === 'youtube' ? '유튜브' : '인스타').join('·');
  const leg = it.distToNext ? `<div class="travel-leg">다음까지 ${esc(it.distToNext)} · <a onclick="openMap('${esc(it.name)}')">구글맵</a></div>` : '';
  return `
    <div class="item" onclick="sheetItemDetail('${t.id}',${di},'${it.id}')">
      <div class="time-col"><span class="time">${esc(it.time || '')}</span><span class="dot ${it.type === 'flight' || it.type === 'food' ? 'accent' : ''}"></span></div>
      <div class="body ${bodyCls}">
        <span class="type-emoji">${TYPE_EMOJI[it.type] || '📍'}</span>
        <div class="t-name">${esc(it.name)}<span class="t-tag">${esc(it.tag || '')}</span></div>
        ${(it.rank || it.sub || linkTxt) ? `<div class="t-sub">
          ${it.rank ? `<span>맛집 ${it.rank}위</span>` : ''}
          ${it.sub ? `<span>${esc(it.sub)}</span>` : ''}
          ${linkTxt ? `<span>${linkTxt}</span>` : ''}
        </div>` : ''}
        ${it.photo ? `<img src="${it.photo}" style="width:100%;border-radius:10px;margin-top:8px;display:block;"/>` : ''}
      </div>
    </div>
    ${leg}
  `;
}

// ---- 지도(map) — 링크 방식 ----
function mapView(t) {
  const allPlaces = [];
  t.days.forEach((d, di) => d.items.forEach(it => { if (it.mapUrl || it.type === 'food' || it.type === 'sight') allPlaces.push({ ...it, day: di + 1 }); }));
  (t.saved || []).forEach(s => { if (s.cat === 'food' || s.cat === 'sight') allPlaces.push({ name: s.name, type: s.cat, tag: CAT[s.cat].label, day: null, saved: true }); });

  return `
    <div class="card" style="background:var(--accent-bg);border:none;">
      <div class="c-title">지도로 보기</div>
      <div class="c-meta">아래 장소를 눌러 구글맵에서 위치·길찾기를 확인하세요.</div>
      <button class="add-dashed" style="border-style:solid;border-color:var(--accent);color:var(--accent);margin-top:14px;" onclick="openMap('${esc(t.dest)} 관광')">${esc(t.dest)} 전체 지도 열기</button>
    </div>
    ${allPlaces.length ? allPlaces.map(p => `
      <div class="card" onclick="openMap('${esc(p.name)}')">
        <div class="c-title">${esc(p.name)} ${p.day ? `<span class="pill">Day ${p.day}</span>` : `<span class="pill">저장함</span>`}</div>
        <div class="c-link">구글맵에서 열기 ›</div>
      </div>
    `).join('') : `<div class="empty"><span class="ico">📍</span>일정·저장함에 장소를 추가하면<br>여기 지도 목록에 모여요.</div>`}
  `;
}

// ---- 저장함(saved) ----
function savedView(t) {
  const filter = route.savedFilter || 'all';
  const saved = t.saved || [];
  const filtered = filter === 'all' ? saved : saved.filter(s => s.cat === filter);
  const food = filtered.filter(s => s.cat === 'food').sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const others = filtered.filter(s => s.cat !== 'food');
  const ordered = filter === 'food' ? food : (filter === 'all' ? [...food, ...others] : others);

  return `
    <div class="seg" style="padding:0 0 8px;">
      ${[['all', '전체'], ['food', '맛집'], ['sight', '관광'], ['idea', '아이디어']].map(([k, l]) =>
        `<button class="${filter === k ? 'on' : ''}" onclick="go({savedFilter:'${k}'})">${l}</button>`).join('')}
    </div>
    ${ordered.length ? ordered.map(s => savedCardHtml(t, s)).join('') : `<div class="empty"><span class="ico">🔖</span>발견한 맛집·관광지·아이디어를<br>+ 로 담아두세요. 맛집은 순위를 매길 수 있어요.</div>`}
  `;
}

function savedCardHtml(t, s) {
  const liked = s.likes || [];
  const catAbbr = { food: '맛', sight: '관', idea: '아', hotel: '숙' };
  const rankBadge = s.cat === 'food' && s.rank ? `<span class="rank r${s.rank}">${s.rank}</span>` : `<span class="rank">${catAbbr[s.cat] || '·'}</span>`;
  const linkIcons = (s.links || []).map(l => `<span class="pill" onclick="event.stopPropagation();openUrl('${esc(l.url)}')">${l.kind === 'youtube' ? '유튜브' : '인스타'}</span>`).join('');
  return `
    <div class="card">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${rankBadge}
        <div style="flex:1;min-width:0;">
          <div class="c-title" style="display:block;">${esc(s.name)}</div>
          ${s.memo ? `<div class="c-meta">${esc(s.memo)}</div>` : ''}
          <div class="pill-row">
            ${linkIcons}
            ${s.mapUrl || s.cat !== 'idea' ? `<span class="pill" onclick="event.stopPropagation();openMap('${esc(s.name)}')">지도</span>` : ''}
            ${s.cat === 'food' ? `<span class="pill" onclick="event.stopPropagation();nearbyFood('${esc(s.name)}')">근처 맛집</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
            <button class="like-btn ${liked.length ? 'liked' : ''}" onclick="event.stopPropagation();toggleLike('${t.id}','${s.id}')">
              ♥ ${liked.length ? liked.map(memberLabel).join('·') : '좋아요'}
            </button>
            <div style="display:flex;gap:12px;align-items:center;">
              ${s.cat === 'food' ? `<span class="linkbtn" onclick="event.stopPropagation();cycleRank('${t.id}','${s.id}')">순위 ${s.rank || '-'}</span>` : ''}
              <span class="linkbtn" onclick="event.stopPropagation();sheetSaved('${t.id}','${s.id}')">수정</span>
              <span class="linkbtn" style="color:var(--text-3)" onclick="event.stopPropagation();delSaved('${t.id}','${s.id}')">삭제</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- 추억(memory) = 여행 순간 모자이크 + 구글포토 링크 ----
function memoryView(t) {
  const moments = (t.moments || []).slice().sort((a, b) => (a.day - b.day) || (a.ts - b.ts));
  const mems = t.memories || [];
  const cols = route.mosaicCols || 3;

  // 퍼즐처럼: 채워진 사진 + 마지막 '＋' 타일 + 남은 칸을 빈 조각으로
  const tiles = moments.map(m => `
    <div class="mtile" onclick="viewMoment('${t.id}','${m.id}')">
      ${m.photo ? `<img src="${m.photo}" alt="${esc(m.place || '순간')}"/>` : `<span class="mt-emoji">📷</span>`}
    </div>`).join('');
  const addTile = `<div class="mtile add" onclick="pickMoment('${t.id}')"><span>＋</span></div>`;
  // 빈 조각으로 현재 줄(+한 줄 더) 채우기
  const filledCount = moments.length + 1;
  const remainder = (cols - (filledCount % cols)) % cols;
  const emptySlots = remainder + cols; // 최소 한 줄은 비워 '채워질 자리'를 보여줌
  const emptyTiles = Array.from({ length: emptySlots }).map(() => `<div class="mtile empty"></div>`).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div class="section-label" style="margin:0;">여행 순간 <span style="color:var(--text-3);font-weight:400;">${moments.length}장</span></div>
      <div class="seg" style="padding:0;">
        <button class="${cols === 3 ? 'on' : ''}" onclick="go({mosaicCols:3})">3×</button>
        <button class="${cols === 4 ? 'on' : ''}" onclick="go({mosaicCols:4})">4×</button>
      </div>
    </div>
    <div class="mosaic" style="grid-template-columns:repeat(${cols},1fr);">
      ${tiles}${addTile}${emptyTiles}
    </div>
    <div class="c-meta" style="color:var(--text-3);margin-top:10px;">이동할 때마다 사진 1장씩 채워보세요. 빈 조각이 하나씩 채워집니다.</div>

    <div class="section-label" style="margin-top:26px;">구글포토 앨범</div>
    ${mems.length ? mems.map(m => `
      <div class="card">
        <div class="c-title" onclick="openUrl('${esc(m.url)}')">${esc(m.title)}</div>
        <div class="c-meta">${memberLabel(m.by)} 추가 · 구글포토</div>
        <div class="pill-row">
          <span class="pill" onclick="openUrl('${esc(m.url)}')">앨범 열기</span>
          <span class="pill" onclick="sheetMemory('${t.id}','${m.id}')">수정</span>
          <span class="pill" onclick="delMemory('${t.id}','${m.id}')">삭제</span>
        </div>
      </div>
    `).join('') : `<div class="c-meta" style="color:var(--text-3);padding:4px 2px 10px;">여행 후 구글포토 공유 링크를 모아두세요.</div>`}
    <button class="add-dashed" onclick="sheetMemory('${t.id}')">구글포토 링크 추가</button>
  `;
}

// ---- 사진 처리 (리사이즈 후 dataURL 저장) ----
function resizePhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const max = 1000; let w = img.width, h = img.height;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// 순간 사진 찍기/올리기 (추억 탭 - 어느 날에 담을지 선택)
function pickMoment(tripId, place, day) {
  const t = getTrip(tripId);
  const inp = document.createElement('input');
  // capture 미지정 → iOS가 '사진 찍기 / 사진 보관함 / 파일 선택'을 모두 제공. multiple → 여러 장 한번에
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = () => {
    const files = Array.from(inp.files || []); if (!files.length) return;
    const d = (typeof day === 'number') ? day : 1;
    let done = 0;
    files.forEach((file, idx) => {
      resizePhoto(file, dataUrl => {
        t.moments = t.moments || [];
        t.moments.push({ id: uid(), photo: dataUrl, place: place || '', caption: place || '', day: d, by: ME || 'mom', ts: Date.now() + idx });
        done++;
        if (done === files.length) { persist(); render(); }
      });
    });
  };
  inp.click();
}

function viewMoment(tripId, mid) {
  const t = getTrip(tripId); const m = (t.moments || []).find(x => x.id === mid); if (!m) return;
  openSheet(`
    <h2>${esc(m.place || m.caption || '여행 순간')}</h2>
    <div class="c-meta">Day ${m.day} · ${memberLabel(m.by)}</div>
    ${m.photo ? `<img src="${m.photo}" style="width:100%;border-radius:12px;margin-top:12px;" alt="순간"/>` : ''}
    <button class="btn-primary" style="background:#e24b4a;" onclick="delMoment('${tripId}','${mid}')">삭제</button>
    <button class="btn-ghost" onclick="closeSheet()">닫기</button>
  `);
}
function delMoment(tripId, mid) {
  const t = getTrip(tripId); t.moments = (t.moments || []).filter(x => x.id !== mid); persist(); closeSheet(); render();
}

// ---------------- 항공 ----------------
function renderFlights(t) {
  app.innerHTML = `
    <div class="topbar"><button class="back" onclick="go({name:'trip',tripId:'${t.id}',tab:'plan'})">‹</button><h1>항공</h1></div>
    <div class="page">
      ${t.flights.map(f => `
        <div class="card">
          <div class="c-title">${esc(f.route)}</div>
          <div class="c-meta">${esc(f.airline)} · ${esc(flightDepStr(f))} → ${esc(flightArrStr(f))}</div>
          ${f.code ? `<div class="c-meta">예약번호 ${esc(f.code)}</div>` : ''}
          <div class="pill-row">
            ${f.bookingUrl ? `<span class="pill" onclick="openUrl('${esc(f.bookingUrl)}')">예약 링크</span>` : ''}
            <span class="pill" onclick="sheetFlight('${t.id}','${f.id}')">수정</span>
            <span class="pill" onclick="delFlight('${t.id}','${f.id}')">삭제</span>
          </div>
        </div>`).join('') || `<div class="empty"><span class="ico">✈️</span>항공편을 추가하세요.</div>`}
      <button class="add-dashed" onclick="sheetFlight('${t.id}')">＋ 항공편 추가</button>
    </div>
  `;
}

// ---------------- 숙소 ----------------
function renderHotels(t) {
  app.innerHTML = `
    <div class="topbar"><button class="back" onclick="go({name:'trip',tripId:'${t.id}',tab:'plan'})">‹</button><h1>숙소</h1></div>
    <div class="page">
      ${t.hotels.map(h => `
        <div class="card">
          <div class="c-title">${esc(h.name)}</div>
          ${h.addr ? `<div class="c-meta">${esc(h.addr)}</div>` : ''}
          <div class="c-meta">체크인 ${esc(h.checkin || '-')} · 체크아웃 ${esc(h.checkout || '-')}</div>
          <div class="pill-row">
            <span class="pill" onclick="${h.placeUrl ? `openUrl('${esc(h.placeUrl)}')` : `openMap('${esc(h.name)} ${esc(h.addr || '')}')`}">지도</span>
            <span class="pill" onclick="sheetHotel('${t.id}','${h.id}')">수정</span>
            <span class="pill" onclick="delHotel('${t.id}','${h.id}')">삭제</span>
          </div>
        </div>`).join('') || `<div class="empty"><span class="ico">🏨</span>숙소를 추가하세요.</div>`}
      <button class="add-dashed" onclick="sheetHotel('${t.id}')">＋ 숙소 추가</button>
    </div>
  `;
}

// ---------------- 체크리스트 ----------------
function renderChecklist(t) {
  const list = t.checklist || [];
  const done = list.filter(c => c.done).length;
  app.innerHTML = `
    <div class="topbar"><button class="back" onclick="go({name:'trip',tripId:'${t.id}',tab:'plan'})">‹</button><h1>체크리스트</h1></div>
    <div class="page">
      <div class="c-meta" style="margin-bottom:8px;">${done} / ${list.length} 완료</div>
      ${list.map(c => `
        <div class="checkitem ${c.done ? 'done' : ''}">
          <div class="box" onclick="toggleCheck('${t.id}','${c.id}')">${c.done ? '✓' : ''}</div>
          <div class="label" onclick="toggleCheck('${t.id}','${c.id}')">${esc(c.label)}</div>
          <div class="who">${esc(c.who || '')}</div>
          <span class="linkbtn" onclick="sheetCheck('${t.id}','${c.id}')">수정</span>
        </div>`).join('')}
      <button class="add-dashed" style="margin-top:16px;" onclick="sheetCheck('${t.id}')">＋ 항목 추가</button>
    </div>
  `;
}

// ---- 메모 (전체 모아보기) ----
function renderMemos(t) {
  const memos = [];
  t.days.forEach((d, di) => d.items.forEach(it => { if (it.type === 'memo') memos.push({ di, date: d.date, it }); }));
  app.innerHTML = `
    <div class="topbar"><button class="back" onclick="go({name:'trip',tripId:'${t.id}',tab:'plan'})">‹</button><h1>메모</h1></div>
    <div class="page">
      ${memos.length ? memos.map(m => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="c-meta" style="margin:0;">${fmtDate(m.date)} · ${memberLabel(m.it.by)}</div>
            <div style="display:flex;gap:12px;">
              <span class="linkbtn" onclick="sheetItem('${t.id}',${m.di},null,'${m.it.id}')">수정</span>
              <span class="linkbtn" style="color:var(--text-3)" onclick="delItem('${t.id}',${m.di},'${m.it.id}')">삭제</span>
            </div>
          </div>
          <div style="font-size:16px;margin-top:8px;white-space:pre-wrap;">${esc(m.it.name)}</div>
          ${m.it.photo ? `<img src="${m.it.photo}" style="width:100%;border-radius:12px;margin-top:10px;"/>` : ''}
        </div>
      `).join('') : `<div class="empty"><span class="ico">📝</span>메모가 없어요.<br>아래에서 추가하거나, 일정에서 '＋ 메모 추가'로 적어보세요.</div>`}
      <button class="add-dashed" onclick="sheetItem('${t.id}', 0, 'memo')">＋ 메모 추가</button>
    </div>
  `;
}

// ================= SHEETS (추가/편집) =================
function openSheet(html) {
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop';
  bd.onclick = e => { if (e.target === bd) closeSheet(); };
  bd.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  document.body.appendChild(bd);
  window._sheet = bd;
}
function closeSheet() { if (window._sheet) { window._sheet.remove(); window._sheet = null; } }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function whoPicker(id, def) {
  return `<div class="who-row" id="${id}">
    ${Object.entries(MEMBERS).map(([k, m]) => `<button data-k="${k}" class="${m.cls} ${k === def ? 'on' : ''}" onclick="pickWho('${id}','${k}')">${m.label}</button>`).join('')}
  </div>`;
}
function pickWho(id, k) {
  const wrap = document.getElementById(id);
  wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  wrap.dataset.val = k;
}
function getWho(id, def) { const w = document.getElementById(id); return (w && w.dataset.val) || def; }

// 새 여행
function sheetNewTrip() {
  openSheet(`
    <h2>새 여행 만들기</h2>
    <label class="field-label">여행 이름</label>
    <input id="nt-name" placeholder="예: 오사카 가족여행" />
    <label class="field-label">여행지</label>
    <input id="nt-dest" placeholder="예: 오사카" />
    <label class="field-label">시작일</label>
    <input id="nt-start" type="date" value="2026-10-01" />
    <label class="field-label">종료일</label>
    <input id="nt-end" type="date" value="2026-10-04" />
    <button class="btn-primary" onclick="createTrip()">여행 만들기</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function createTrip() {
  const name = val('nt-name') || '새 여행';
  const dest = val('nt-dest') || name;
  const start = val('nt-start'), end = val('nt-end');
  if (!start || !end || end < start) { alert('날짜를 확인해 주세요.'); return; }
  const days = [];
  let d = new Date(start + 'T00:00:00'), de = new Date(end + 'T00:00:00');
  while (d <= de) { days.push({ date: isoLocal(d), weather: '', items: [] }); d.setDate(d.getDate() + 1); }
  DATA.trips.unshift({ id: uid(), name, dest, start, end, members: ['mom', 'dad', 'son'], flights: [], hotels: [], days, saved: [], checklist: [], memories: [] });
  persist(); closeSheet(); go({ name: 'home', homeTab: 'upcoming' });
}

// 여행 정보 수정 (이름/여행지/날짜)
function sheetTrip(tripId) {
  const t = getTrip(tripId);
  openSheet(`
    <h2>여행 정보 수정</h2>
    <label class="field-label">여행 이름</label>
    <input id="et-name" value="${esc(t.name)}" />
    <label class="field-label">여행지</label>
    <input id="et-dest" value="${esc(t.dest)}" />
    <label class="field-label">시작일</label>
    <input id="et-start" type="date" value="${t.start}" />
    <label class="field-label">종료일</label>
    <input id="et-end" type="date" value="${t.end}" />
    <div class="c-meta" style="color:var(--text-3);margin-top:10px;">날짜를 바꿔도 기존 일정은 같은 날짜에 그대로 유지됩니다.</div>
    <button class="btn-primary" onclick="saveTrip('${tripId}')">저장</button>
    <button class="btn-ghost" style="color:#e24b4a;" onclick="delTrip('${tripId}')">이 여행 삭제</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveTrip(tripId) {
  const t = getTrip(tripId);
  const name = val('et-name') || t.name, dest = val('et-dest') || t.dest;
  const start = val('et-start'), end = val('et-end');
  if (!start || !end || end < start) { alert('날짜를 확인해 주세요.'); return; }
  // 날짜가 바뀌면 days 재구성 (같은 날짜의 일정은 보존)
  if (start !== t.start || end !== t.end) {
    const oldByDate = {}; (t.days || []).forEach(d => { oldByDate[d.date] = d; });
    const newDays = [];
    let d = new Date(start + 'T00:00:00'), de = new Date(end + 'T00:00:00');
    while (d <= de) {
      const iso = isoLocal(d);
      newDays.push(oldByDate[iso] || { date: iso, weather: '', items: [] });
      d.setDate(d.getDate() + 1);
    }
    t.days = newDays;
  }
  t.name = name; t.dest = dest; t.start = start; t.end = end;
  persist(); closeSheet(); render();
}
function delTrip(tripId) {
  if (!confirm('이 여행을 삭제할까요? 되돌릴 수 없어요.')) return;
  DATA.trips = DATA.trips.filter(x => x.id !== tripId);
  cloudDeleteTrip(tripId); // 사용자가 직접 삭제할 때만 클라우드에서 제거
  persist(); closeSheet(); go({ name: 'home' });
}

// 일정 아이템 추가/수정
function sheetItem(tripId, di, kind, itemId) {
  const t = getTrip(tripId);
  const it = itemId ? t.days[di].items.find(x => x.id === itemId) : null;
  const isMemo = it ? it.type === 'memo' : kind === 'memo';
  const typeOpt = (v, l) => `<option value="${v}" ${it && it.type === v ? 'selected' : ''}>${l}</option>`;
  const link0 = it && it.links && it.links[0] ? it.links[0].url : '';
  _attachPhoto = it && it.photo ? it.photo : null; // 메모 사진 임시보관
  openSheet(`
    <h2>${it ? (isMemo ? '메모 수정' : '장소 수정') : (isMemo ? '메모 추가' : '장소 추가')}</h2>
    ${isMemo ? `
    <label class="field-label">메모 내용</label>
    <textarea id="ai-name" placeholder="예: 우산 챙기기 / 현우 알레르기 주의">${it ? esc(it.name) : ''}</textarea>
    <label class="field-label">사진 (선택)</label>
    <div id="memo-photo">${_attachPhoto ? `<img src="${_attachPhoto}" style="width:100%;border-radius:12px;margin-bottom:8px;"/>` : ''}</div>
    <button class="add-dashed" onclick="attachMemoPhoto()">📷 사진 첨부 (촬영·앨범)</button>
    ` : `
    <label class="field-label">장소 이름</label>
    <input id="ai-name" placeholder="예: 시부야 스카이" value="${it ? esc(it.name) : ''}" />
    <label class="field-label">종류</label>
    <select id="ai-type">${typeOpt('sight', '관광')}${typeOpt('food', '맛집')}${typeOpt('move', '이동')}${typeOpt('shopping', '쇼핑')}${typeOpt('activity', '액티비티')}${typeOpt('hotel', '숙소')}</select>
    <label class="field-label">시간</label>
    <input id="ai-time" type="time" value="${it ? esc(it.time || '') : ''}" />
    <label class="field-label">메모 (선택)</label>
    <input id="ai-sub" placeholder="예: 예약 필요" value="${it ? esc(it.sub || '') : ''}" />
    <label class="field-label">참고 링크 (유튜브/인스타, 선택)</label>
    <input id="ai-link" placeholder="https://..." value="${esc(link0)}" />`}
    <label class="field-label">올린 사람</label>
    ${whoPicker('ai-who', it ? it.by : ME)}
    <button class="btn-primary" onclick="saveItem('${tripId}',${di},${isMemo},${it ? `'${itemId}'` : 'null'})">${it ? '저장' : '추가'}</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function attachMemoPhoto() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    if (!inp.files[0]) return;
    resizePhoto(inp.files[0], durl => {
      _attachPhoto = durl;
      const box = document.getElementById('memo-photo');
      if (box) box.innerHTML = `<img src="${durl}" style="width:100%;border-radius:12px;margin-bottom:8px;"/>`;
    });
  };
  inp.click();
}
function saveItem(tripId, di, isMemo, itemId) {
  const t = getTrip(tripId);
  const name = val('ai-name'); if (!name) { alert('내용을 입력해 주세요.'); return; }
  const by = getWho('ai-who', ME || 'mom');
  const buildLinks = () => { const link = val('ai-link'); return link ? [{ kind: link.includes('insta') ? 'instagram' : 'youtube', url: link }] : []; };
  if (itemId) {
    const it = t.days[di].items.find(x => x.id === itemId);
    if (isMemo) Object.assign(it, { name, by, photo: _attachPhoto });
    else { const type = val('ai-type') || 'sight'; Object.assign(it, { time: val('ai-time'), type, name, tag: CAT[type] ? CAT[type].label : '관광', sub: val('ai-sub'), by, links: buildLinks() }); }
  } else {
    let item;
    if (isMemo) item = { id: uid(), time: '', type: 'memo', name, tag: '메모', sub: '', by, photo: _attachPhoto };
    else { const type = val('ai-type') || 'sight'; item = { id: uid(), time: val('ai-time'), type, name, tag: CAT[type] ? CAT[type].label : '관광', sub: val('ai-sub'), by, mapUrl: '', links: buildLinks() }; }
    t.days[di].items.push(item);
  }
  persist(); closeSheet(); render();
}

// 아이템 상세 (삭제)
function sheetItemDetail(tripId, di, itemId) {
  const t = getTrip(tripId); const it = t.days[di].items.find(x => x.id === itemId); if (!it) return;
  openSheet(`
    <h2>${esc(it.name)}</h2>
    <div class="c-meta">${esc(it.tag || '')} ${it.time ? '· ' + esc(it.time) : ''} · ${memberLabel(it.by)}</div>
    ${it.sub ? `<div class="c-meta" style="margin-top:6px;">${esc(it.sub)}</div>` : ''}
    <div class="pill-row" style="margin-top:14px;">
      ${it.type !== 'memo' && it.type !== 'flight' ? `<span class="pill" onclick="openMap('${esc(it.name)}')">지도</span>` : ''}
      ${it.type === 'food' ? `<span class="pill" onclick="nearbyFood('${esc(it.name)}')">근처 맛집</span>` : ''}
      ${(it.links || []).map(l => `<span class="pill" onclick="openUrl('${esc(l.url)}')">${l.kind === 'youtube' ? '유튜브' : '인스타'}</span>`).join('')}
    </div>
    <button class="btn-primary" onclick="closeSheet();sheetItem('${tripId}',${di},null,'${itemId}')">수정</button>
    <button class="btn-primary" style="background:var(--surface-2);color:var(--text);" onclick="closeSheet();pickMoment('${tripId}','${esc(it.name)}',${di + 1})">이 장소 사진 추가 (촬영·앨범)</button>
    <button class="btn-primary" style="background:#e24b4a;" onclick="delItem('${tripId}',${di},'${itemId}')">일정에서 삭제</button>
    <button class="btn-ghost" onclick="closeSheet()">닫기</button>
  `);
}
function delItem(tripId, di, itemId) {
  const t = getTrip(tripId); t.days[di].items = t.days[di].items.filter(x => x.id !== itemId);
  persist(); closeSheet(); render();
}

// 저장함 추가/수정
function sheetSaved(tripId, sid) {
  const t = getTrip(tripId); const s = sid ? t.saved.find(x => x.id === sid) : null;
  const opt = (v, l) => `<option value="${v}" ${s && s.cat === v ? 'selected' : ''}>${l}</option>`;
  const link0 = s && s.links && s.links[0] ? s.links[0].url : '';
  openSheet(`
    <h2>${s ? '저장 항목 수정' : '저장함에 담기'}</h2>
    <label class="field-label">종류</label>
    <select id="sv-cat">${opt('food', '맛집')}${opt('sight', '관광')}${opt('idea', '아이디어')}</select>
    <label class="field-label">이름</label>
    <input id="sv-name" placeholder="예: 스시잔마이" value="${s ? esc(s.name) : ''}" />
    <label class="field-label">메모 (선택)</label>
    <input id="sv-memo" placeholder="예: 신선한 참치, 24시간" value="${s ? esc(s.memo || '') : ''}" />
    <label class="field-label">참고 링크 (유튜브/인스타, 선택)</label>
    <input id="sv-link" placeholder="https://..." value="${esc(link0)}" />
    <label class="field-label">담은 사람</label>
    ${whoPicker('sv-who', s ? s.by : ME)}
    <button class="btn-primary" onclick="saveSaved('${tripId}',${s ? `'${sid}'` : 'null'})">${s ? '저장' : '담기'}</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveSaved(tripId, sid) {
  const t = getTrip(tripId); const name = val('sv-name'); if (!name) { alert('이름을 입력해 주세요.'); return; }
  const link = val('sv-link');
  const links = link ? [{ kind: link.includes('insta') ? 'instagram' : 'youtube', url: link }] : [];
  t.saved = t.saved || [];
  if (sid) {
    const s = t.saved.find(x => x.id === sid);
    Object.assign(s, { cat: val('sv-cat') || 'food', name, memo: val('sv-memo'), by: getWho('sv-who', s.by), links });
  } else {
    t.saved.push({ id: uid(), cat: val('sv-cat') || 'food', name, memo: val('sv-memo'), rank: 0, mapUrl: '', by: getWho('sv-who', ME || 'mom'), likes: [], links });
  }
  persist(); closeSheet(); render();
}
function toggleLike(tripId, sid) {
  const t = getTrip(tripId); const s = t.saved.find(x => x.id === sid); if (!s) return;
  s.likes = s.likes || [];
  // 데모: 현재 '엄마' 기준 토글 (실제 앱에선 로그인 사용자)
  const me = ME || 'mom';
  if (s.likes.includes(me)) s.likes = s.likes.filter(k => k !== me); else s.likes.push(me);
  persist(); render();
}
function cycleRank(tripId, sid) {
  const t = getTrip(tripId); const s = t.saved.find(x => x.id === sid); if (!s) return;
  s.rank = ((s.rank || 0) + 1) % 4; persist(); render();
}
function delSaved(tripId, sid) {
  const t = getTrip(tripId); t.saved = t.saved.filter(x => x.id !== sid); persist(); render();
}

// 추억(구글포토 링크) 추가/수정
function sheetMemory(tripId, mid) {
  const t = getTrip(tripId); const m = mid ? t.memories.find(x => x.id === mid) : null;
  openSheet(`
    <h2>${m ? '구글포토 링크 수정' : '구글포토 링크 추가'}</h2>
    <label class="field-label">앨범 이름</label>
    <input id="mm-title" placeholder="예: 도쿄 전체 앨범" value="${m ? esc(m.title) : ''}" />
    <label class="field-label">구글포토 공유 링크</label>
    <input id="mm-url" placeholder="https://photos.google.com/..." value="${m ? esc(m.url === '#' ? '' : m.url) : ''}" />
    <label class="field-label">올린 사람</label>
    ${whoPicker('mm-who', m ? m.by : ME)}
    <button class="btn-primary" onclick="saveMemory('${tripId}',${m ? `'${mid}'` : 'null'})">${m ? '저장' : '추가'}</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveMemory(tripId, mid) {
  const t = getTrip(tripId); const title = val('mm-title'); const url = val('mm-url');
  if (!title) { alert('앨범 이름을 입력해 주세요.'); return; }
  t.memories = t.memories || [];
  if (mid) Object.assign(t.memories.find(x => x.id === mid), { title, url: url || '#', by: getWho('mm-who', ME || 'mom') });
  else t.memories.push({ id: uid(), title, url: url || '#', by: getWho('mm-who', ME || 'mom') });
  persist(); closeSheet(); render();
}
function delMemory(tripId, mid) {
  const t = getTrip(tripId); t.memories = t.memories.filter(x => x.id !== mid); persist(); render();
}

// 항공 추가/수정
function sheetFlight(tripId, fid) {
  const t = getTrip(tripId); const f = fid ? t.flights.find(x => x.id === fid) : null;
  openSheet(`
    <h2>${f ? '항공편 수정' : '항공편 추가'}</h2>
    <label class="field-label">구간</label>
    <input id="fl-route" placeholder="예: 서울(ICN) → 도쿄(NRT)" value="${f ? esc(f.route) : ''}" />
    <label class="field-label">항공편명</label>
    <input id="fl-air" placeholder="예: OZ102" value="${f ? esc(f.airline) : ''}" />
    <label class="field-label">출발 날짜 (예: 260924 → 2026.09.24)</label>
    <input id="fl-dep-date" inputmode="numeric" placeholder="260924" value="${f ? esc(f.depDate || '') : ''}" />
    <label class="field-label">출발 시간</label>
    <input id="fl-dep-time" type="time" value="${f ? esc(f.depTime || '') : ''}" />
    <label class="field-label">도착 날짜 (예: 260924 → 2026.09.24)</label>
    <input id="fl-arr-date" inputmode="numeric" placeholder="260924" value="${f ? esc(f.arrDate || '') : ''}" />
    <label class="field-label">도착 시간</label>
    <input id="fl-arr-time" type="time" value="${f ? esc(f.arrTime || '') : ''}" />
    <label class="field-label">예약번호 (선택)</label>
    <input id="fl-code" placeholder="예: ABC123" value="${f ? esc(f.code || '') : ''}" />
    <label class="field-label">예약 링크 (선택)</label>
    <input id="fl-url" placeholder="https://..." value="${f ? esc(f.bookingUrl || '') : ''}" />
    <button class="btn-primary" onclick="saveFlight('${tripId}',${f ? `'${fid}'` : 'null'})">${f ? '저장' : '추가'}</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveFlight(tripId, fid) {
  const t = getTrip(tripId); const route2 = val('fl-route'); if (!route2) { alert('구간을 입력해 주세요.'); return; }
  const data = {
    route: route2, airline: val('fl-air'),
    depDate: fmtYmd(val('fl-dep-date')), depTime: val('fl-dep-time'),
    arrDate: fmtYmd(val('fl-arr-date')), arrTime: val('fl-arr-time'),
    code: val('fl-code'), bookingUrl: val('fl-url'),
  };
  if (fid) Object.assign(t.flights.find(x => x.id === fid), data);
  else t.flights.push({ id: uid(), ...data });
  persist(); closeSheet(); render();
}
// 항공 표시 문자열 (신규 필드 우선, 구 데이터 fallback)
function flightDepStr(f) { return f.depDate ? `${f.depDate} ${f.depTime || ''}`.trim() : (f.dep || ''); }
function flightArrStr(f) { return f.arrDate ? `${f.arrDate} ${f.arrTime || ''}`.trim() : (f.arr || ''); }
function delFlight(tripId, fid) { const t = getTrip(tripId); t.flights = t.flights.filter(x => x.id !== fid); persist(); render(); }

// 숙소 추가/수정
function sheetHotel(tripId, hid) {
  const t = getTrip(tripId); const h = hid ? t.hotels.find(x => x.id === hid) : null;
  openSheet(`
    <h2>${h ? '숙소 수정' : '숙소 추가'}</h2>
    <label class="field-label">숙소 이름</label>
    <input id="ho-name" placeholder="예: 시부야 엑셀 호텔" value="${h ? esc(h.name) : ''}" />
    <label class="field-label">주소</label>
    <input id="ho-addr" placeholder="예: 1-12-2 Dogenzaka, Shibuya" value="${h ? esc(h.addr || '') : ''}" />
    <label class="field-label">체크인 (예: 260924 → 2026.09.24)</label>
    <input id="ho-in" inputmode="numeric" placeholder="260924" value="${h ? esc(h.checkin || '') : ''}" />
    <label class="field-label">체크아웃 (예: 260927 → 2026.09.27)</label>
    <input id="ho-out" inputmode="numeric" placeholder="260927" value="${h ? esc(h.checkout || '') : ''}" />
    <label class="field-label">지도 링크 (네이버/구글맵 붙여넣기)</label>
    <input id="ho-url" placeholder="지도 링크를 붙여넣으세요" value="${h ? esc(h.placeUrl || '') : ''}" />
    <div class="c-meta" style="color:var(--text-3);margin-top:6px;">구글맵 링크는 이름이 자동으로 채워져요. 링크는 나중에 눌러서 지도로 바로 열 수 있어요.</div>
    <button class="btn-primary" onclick="saveHotel('${tripId}',${h ? `'${hid}'` : 'null'})">${h ? '저장' : '추가'}</button>
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveHotel(tripId, hid) {
  const t = getTrip(tripId);
  const placeUrl = val('ho-url');
  let name = val('ho-name');
  if (!name && placeUrl) name = nameFromMapUrl(placeUrl); // 구글맵 링크면 이름 자동
  if (!name) { alert('숙소 이름을 입력하거나, 구글맵 링크를 붙여넣어 주세요.'); return; }
  const data = { name, addr: val('ho-addr'), checkin: fmtYmd(val('ho-in')), checkout: fmtYmd(val('ho-out')), placeUrl };
  if (hid) Object.assign(t.hotels.find(x => x.id === hid), data);
  else t.hotels.push({ id: uid(), ...data });
  persist(); closeSheet(); render();
}
function delHotel(tripId, hid) { const t = getTrip(tripId); t.hotels = t.hotels.filter(x => x.id !== hid); persist(); render(); }

// 체크리스트 추가/수정
function sheetCheck(tripId, cid) {
  const t = getTrip(tripId); const c = cid ? t.checklist.find(x => x.id === cid) : null;
  openSheet(`
    <h2>${c ? '항목 수정' : '체크리스트 항목 추가'}</h2>
    <label class="field-label">할 일</label>
    <input id="ck-label" placeholder="예: 엔화 환전" value="${c ? esc(c.label) : ''}" />
    <label class="field-label">담당</label>
    <input id="ck-who" placeholder="예: 엄마 / 공용" value="${c ? esc(c.who || '공용') : '공용'}" />
    <button class="btn-primary" onclick="saveCheck('${tripId}',${c ? `'${cid}'` : 'null'})">${c ? '저장' : '추가'}</button>
    ${c ? `<button class="btn-ghost" style="color:#e24b4a;" onclick="delCheck('${tripId}','${cid}')">삭제</button>` : ''}
    <button class="btn-ghost" onclick="closeSheet()">취소</button>
  `);
}
function saveCheck(tripId, cid) {
  const t = getTrip(tripId); const label = val('ck-label'); if (!label) { alert('할 일을 입력해 주세요.'); return; }
  t.checklist = t.checklist || [];
  if (cid) Object.assign(t.checklist.find(x => x.id === cid), { label, who: val('ck-who') || '공용' });
  else t.checklist.push({ id: uid(), label, done: false, who: val('ck-who') || '공용' });
  persist(); closeSheet(); render();
}
function delCheck(tripId, cid) {
  const t = getTrip(tripId); t.checklist = t.checklist.filter(x => x.id !== cid); persist(); closeSheet(); render();
}
function toggleCheck(tripId, cid) {
  const t = getTrip(tripId); const c = t.checklist.find(x => x.id === cid); if (c) c.done = !c.done;
  persist(); render();
}

// ================= 실시간 동기화 =================
function subscribeRealtime() {
  if (!window.SB) return;
  SB.channel('trips-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, payload => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old && payload.old.id; if (!id) return;
        delete _pushCache[id];
        DATA.trips = DATA.trips.filter(x => x.id !== id);
      } else {
        const row = payload.new; if (!row || !row.data) return;
        _pushCache[row.id] = JSON.stringify(row.data);
        const i = DATA.trips.findIndex(x => x.id === row.id);
        if (i >= 0) DATA.trips[i] = row.data; else DATA.trips.push(row.data);
      }
      saveData(DATA);
      if (!window._sheet) render(); // 편집 중(시트 열림)이면 화면은 방해하지 않음
    })
    .subscribe();
}

// ================= START =================
async function init() {
  render(); // 캐시로 즉시 표시
  if (window.SB) {
    try {
      const { data, error } = await SB.from('trips').select('id,data').order('updated_at', { ascending: true });
      if (error) throw error;
      if (data && data.length) {
        DATA = { trips: data.map(r => r.data) };
        seedCache();
      } else {
        // 클라우드가 비어있음 — 이 기기에 저장된 캐시가 있으면 '복구'로 다시 올림
        let cached = null;
        try { const raw = localStorage.getItem(STORE_KEY); cached = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (cached && cached.trips && cached.trips.length) {
          DATA = cached; _pushCache = {};
          for (const t of DATA.trips) {
            _pushCache[t.id] = JSON.stringify(t);
            await SB.from('trips').upsert({ id: t.id, data: t, updated_at: new Date().toISOString() });
          }
        } else if (!localStorage.getItem('ft_seeded')) {
          // 진짜 첫 실행 → 데모 데이터 업로드
          DATA = JSON.parse(JSON.stringify(SEED));
          for (const t of DATA.trips) {
            _pushCache[t.id] = JSON.stringify(t);
            await SB.from('trips').upsert({ id: t.id, data: t, updated_at: new Date().toISOString() });
          }
        } else {
          DATA = { trips: [] };
          seedCache();
        }
      }
      localStorage.setItem('ft_seeded', '1');
      saveData(DATA);
      render();
    } catch (e) { console.error('cloud init', e); }
    subscribeRealtime();
  }
}
init();
