// ===== Supabase 연결 설정 =====
// anon/publishable 공개키 — 브라우저에 넣는 공개용이라 노출돼도 안전합니다.
const SUPABASE_URL = 'https://evwtpovsqvbdbtrqzjfk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jSRc83fjg4-issRvs17mFQ_LFqAtSkh';

window.SB = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
