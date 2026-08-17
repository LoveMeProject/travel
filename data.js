// ===== 가족 여행 앱 · 목데이터 + localStorage =====
// 실제 추가/수정한 내용은 브라우저에 저장됩니다(폰에서도 유지).

const MEMBERS = {
  mom: { name: 'Ahn', label: '엄마', cls: 'mom' },
  dad: { name: 'Euro', label: '아빠', cls: 'dad' },
  son: { name: 'HyunWoo', label: '현우', cls: 'son' },
};

const SEED = {
  trips: [
    {
      id: 't1',
      name: '도쿄 가족여행',
      dest: '도쿄',
      start: '2026-09-24',
      end: '2026-09-27',
      members: ['mom', 'dad', 'son'],
      // 항공
      flights: [
        { id: 'f1', route: '서울(ICN) → 도쿄(NRT)', airline: 'OZ 102', dep: '09.24 18:30', arr: '09.24 21:00', bookingUrl: '', code: 'ABC123' },
        { id: 'f2', route: '도쿄(NRT) → 서울(ICN)', airline: 'OZ 105', dep: '09.27 01:30', arr: '09.27 04:10', bookingUrl: '', code: 'ABC123' },
      ],
      // 숙소
      hotels: [
        { id: 'h1', name: '시부야 엑셀 호텔 도큐', addr: '1-12-2 Dogenzaka, Shibuya', checkin: '09.24', checkout: '09.27', bookingUrl: 'https://www.booking.com', mapUrl: 'https://maps.google.com/?q=Shibuya+Excel+Hotel+Tokyu' },
      ],
      // 일정: day별 아이템
      days: [
        {
          date: '2026-09-24', weather: '흐림 24°',
          items: [
            { id: 'i1', time: '18:30', type: 'flight', name: '서울 → 도쿄 (OZ102)', tag: '항공', sub: '예약번호 ABC123', by: 'dad', mapUrl: '' },
            { id: 'i2', time: '22:00', type: 'hotel', name: '시부야 호텔 체크인', tag: '숙소', sub: '', by: 'mom', mapUrl: 'https://maps.google.com/?q=Shibuya+Excel+Hotel+Tokyu' },
          ],
        },
        {
          date: '2026-09-25', weather: '맑음 27°',
          items: [
            { id: 'i3', time: '10:00', type: 'sight', name: '시부야 스카이', tag: '관광', sub: '★4.6 · 현우 저장', by: 'son', rating: 4.6, mapUrl: 'https://maps.google.com/?q=Shibuya+Sky', links: [{ kind: 'youtube', url: 'https://youtube.com' }], distToNext: '2.1km · 지하철 8분' },
            { id: 'i4', time: '12:30', type: 'food', name: '이치란 라멘 시부야점', tag: '점심', sub: '도보 3분', by: 'mom', rank: 1, mapUrl: 'https://maps.google.com/?q=Ichiran+Shibuya' },
            { id: 'i5', time: '15:00', type: 'sight', name: '메이지 신궁', tag: '관광', sub: '숲길 산책', by: 'dad', mapUrl: 'https://maps.google.com/?q=Meiji+Shrine' },
          ],
        },
        { date: '2026-09-26', weather: '구름 26°', items: [] },
        { date: '2026-09-27', weather: '맑음 25°', items: [
            { id: 'i6', time: '01:30', type: 'flight', name: '도쿄 → 서울 (OZ105)', tag: '항공', sub: '', by: 'dad', mapUrl: '' },
        ] },
      ],
      // 저장함: 발견/검색한 장소
      saved: [
        { id: 's1', cat: 'food', name: '스시잔마이 본점', memo: '신선한 참치, 24시간', rank: 1, mapUrl: 'https://maps.google.com/?q=Sushizanmai+Tsukiji', by: 'mom', likes: ['mom', 'son'], links: [] },
        { id: 's2', cat: 'food', name: '아후리 라멘', memo: '유자 시오라멘 유명', rank: 2, mapUrl: 'https://maps.google.com/?q=Afuri+Ramen', by: 'son', likes: ['son'], links: [{ kind: 'instagram', url: 'https://instagram.com' }] },
        { id: 's3', cat: 'food', name: '멘야 무사시', memo: '진한 츠케멘', rank: 3, mapUrl: 'https://maps.google.com/?q=Menya+Musashi', by: 'dad', likes: [], links: [] },
        { id: 's4', cat: 'sight', name: '팀랩 플래닛', memo: '몰입형 전시, 예매 필수', rank: 0, mapUrl: 'https://maps.google.com/?q=teamLab+Planets', by: 'son', likes: ['mom', 'dad', 'son'], links: [{ kind: 'youtube', url: 'https://youtube.com' }] },
        { id: 's5', cat: 'idea', name: '아사쿠사 기모노 체험', memo: '인스타에서 봄', rank: 0, mapUrl: '', by: 'mom', likes: ['mom'], links: [{ kind: 'instagram', url: 'https://instagram.com' }] },
      ],
      // 체크리스트
      checklist: [
        { id: 'c1', label: '여권 유효기간 확인', done: true, who: '공용' },
        { id: 'c2', label: '유심/이심 준비', done: true, who: '아빠' },
        { id: 'c3', label: '엔화 환전', done: false, who: '엄마' },
        { id: 'c4', label: '현우 카메라 충전', done: false, who: '현우' },
        { id: 'c5', label: '팀랩 티켓 예매', done: false, who: '공용' },
      ],
      // 여행 순간 (이동할 때마다 1장씩)
      moments: [
        { id: 'mo1', place: '공항 가는 길', caption: '출발!', day: 1, by: 'son', ts: 1, photo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23b5d4f4'/%3E%3Ctext x='50%25' y='52%25' font-size='90' text-anchor='middle'%3E✈️%3C/text%3E%3C/svg%3E" },
        { id: 'mo2', place: '시부야 스카이', caption: '전망 최고', day: 2, by: 'mom', ts: 2, photo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%239fe1cb'/%3E%3Ctext x='50%25' y='52%25' font-size='90' text-anchor='middle'%3E🌆%3C/text%3E%3C/svg%3E" },
        { id: 'mo3', place: '이치란 라멘', caption: '점심', day: 2, by: 'dad', ts: 3, photo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23fac775'/%3E%3Ctext x='50%25' y='52%25' font-size='90' text-anchor='middle'%3E🍜%3C/text%3E%3C/svg%3E" },
      ],
      // 추억 (여행 후 구글포토)
      memories: [],
    },
    {
      id: 't2',
      name: '제주도 겨울여행',
      dest: '제주',
      start: '2026-01-15',
      end: '2026-01-18',
      members: ['mom', 'dad', 'son'],
      flights: [], hotels: [], days: [], saved: [], checklist: [],
      memories: [
        { id: 'm1', title: '제주 전체 앨범', url: 'https://photos.google.com', by: 'mom' },
        { id: 'm2', title: '한라산 등반', url: 'https://photos.google.com', by: 'dad' },
        { id: 'm3', title: '현우 사진첩', url: 'https://photos.google.com', by: 'son' },
      ],
    },
    {
      id: 't3',
      name: '도쿄 여름여행',
      dest: '도쿄',
      start: '2025-07-20',
      end: '2025-07-25',
      members: ['mom', 'dad', 'son'],
      flights: [], hotels: [], days: [],
      saved: [
        { id: 's10', cat: 'food', name: '우오가시 니혼이치 (재방문)', memo: '작년 최애 스시', rank: 1, mapUrl: '', by: 'dad', likes: [], links: [] },
      ],
      checklist: [],
      memories: [
        { id: 'm10', title: '도쿄 여름 앨범', url: 'https://photos.google.com', by: 'mom' },
      ],
    },
  ],
};

// ---- 저장소 ----
const STORE_KEY = 'family_travel_v1';
function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(SEED));
}
function saveData(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
}
function resetData() {
  localStorage.removeItem(STORE_KEY);
}
function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }

// ---- 유틸 ----
function isoLocal(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
function fmtRange(s, e) {
  const ds = new Date(s + 'T00:00:00'), de = new Date(e + 'T00:00:00');
  const y = ds.getFullYear();
  return `${y}.${ds.getMonth() + 1}.${ds.getDate()} – ${de.getMonth() + 1}.${de.getDate()}`;
}
function nights(s, e) {
  const ds = new Date(s + 'T00:00:00'), de = new Date(e + 'T00:00:00');
  const n = Math.round((de - ds) / 86400000);
  return `${n}박${n + 1}일`;
}
function dday(s) {
  const today = new Date('2026-08-09T00:00:00');
  const ds = new Date(s + 'T00:00:00');
  const diff = Math.round((ds - today) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return null;
}
function tripStatus(t) {
  const today = new Date('2026-08-09T00:00:00');
  const s = new Date(t.start + 'T00:00:00'), e = new Date(t.end + 'T00:00:00');
  if (today < s) return 'upcoming';
  if (today > e) return 'past';
  return 'ongoing';
}
function weekday(iso) {
  const d = new Date(iso + 'T00:00:00');
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
}
