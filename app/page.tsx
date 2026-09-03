import { unstable_cache } from 'next/cache';
import CalendarSection from './calendar-section';
import ScrollObserver from './scroll-observer';
import YoutubeSection from './youtube-modal';
import ThemeToggle from './theme-toggle';
import ScheduleEmbed from './schedule-embed';

const getYoutubeVideos = unstable_cache(async () => {
  try {
    const KEY = process.env.YOUTUBE_API_KEY!;
    const CH  = process.env.YOUTUBE_CHANNEL_ID!;
    const now       = new Date();
    const thisYear  = now.getFullYear();
    const cutoffISO = `${thisYear - 1}-01-01T00:00:00Z`;
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CH}&key=${KEY}`,
      { cache: 'no-store' }
    );
    const chData = await chRes.json();
    const uploadPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadPlaylistId) return [];
    const allVideoIds: string[] = [];
    let pageToken: string | undefined;
    let reachedCutoff = false;
    do {
      const params = new URLSearchParams({ part: 'contentDetails', playlistId: uploadPlaylistId, maxResults: '50', key: KEY, ...(pageToken ? { pageToken } : {}) });
      const res  = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.error) { console.error('YT playlistItems error:', data.error); break; }
      for (const item of data.items || []) {
        const videoId = item.contentDetails?.videoId;
        const publishedAt = item.contentDetails?.videoPublishedAt || '';
        if (!videoId) continue;
        if (publishedAt && publishedAt < cutoffISO) { reachedCutoff = true; break; }
        allVideoIds.push(videoId);
      }
      pageToken = reachedCutoff ? undefined : data.nextPageToken;
    } while (pageToken);
    if (!allVideoIds.length) return [];
    const allVideos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const ids = allVideoIds.slice(i, i + 50).join(',');
      const res  = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${KEY}`, { cache: 'no-store' });
      const data = await res.json();
      for (const item of data.items || []) {
        allVideos.push({ id: item.id, title: item.snippet.title, thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '', publishedAt: item.snippet.publishedAt, views: parseInt(item.statistics?.viewCount || '0') });
      }
    }
    return allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } catch (e) { console.error('getYoutubeVideos error:', e); return []; }
}, ['yt-videos-playlist-v2'], { revalidate: 3600 });

async function fetchSoopPage(bjid: string, page: number) {
  try {
    const res = await fetch(`https://api-channel.sooplive.com/v1.1/channel/${bjid}/vod/all/streamer?startDate=&endDate=&keyword=&orderBy=regDate&perPage=60&page=${page}&field=title,contents,userNick,userId`, { headers: { 'Referer': 'https://www.sooplive.com/', 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    const data = await res.json();
    return { contents: data.contents || [], totalPages: data.meta?.totalPages || 1 };
  } catch { return { contents: [], totalPages: 1 }; }
}

const getAllVods = unstable_cache(async () => {
  const BJID = process.env.SOOP_BJID || 'townboy';
  const allReviews: any[] = [];
  const first = await fetchSoopPage(BJID, 1);
  const totalPages = first.totalPages;
  if (!first.contents.length) return { vods: [], months: [] };
  for (const v of first.contents) {
    if (v.ucc?.fileType !== 'REVIEW') continue;
    allReviews.push({ id: v.titleNo, title: v.titleName, thumb: v.ucc?.thumb || '', date: v.regDate?.split(' ')[0] || '', views: v.count?.readCnt || 0, duration: v.ucc?.totalFileDuration || 0 });
  }
  const CHUNK = 10; let p = 2;
  while (p <= totalPages) {
    const pages = Array.from({ length: Math.min(CHUNK, totalPages - p + 1) }, (_, i) => p + i);
    const results = await Promise.all(pages.map(pg => fetchSoopPage(BJID, pg)));
    for (const { contents } of results) {
      for (const v of contents) {
        if (v.ucc?.fileType !== 'REVIEW') continue;
        allReviews.push({ id: v.titleNo, title: v.titleName, thumb: v.ucc?.thumb || '', date: v.regDate?.split(' ')[0] || '', views: v.count?.readCnt || 0, duration: v.ucc?.totalFileDuration || 0 });
      }
    }
    p += CHUNK;
  }
  const years = [...new Set(allReviews.map(v => v.date.substring(0, 4)))].sort();
  const months: string[] = [];
  years.forEach(y => { for (let mo = 1; mo <= 12; mo++) months.push(`${y}-${String(mo).padStart(2, '0')}`); });
  return { vods: allReviews, months };
}, ['soop-vods-v3'], { revalidate: 3600 });

const getNotices = unstable_cache(async () => {
  try {
    const BJID = process.env.SOOP_BJID || 'townboy';
    const BOARD_ID = '76988470';
    const url = `https://chapi.sooplive.com/api/${BJID}/board/${BOARD_ID}?per_page=3&start_date=&end_date=&field=title,contents,user_nick,user_id,hashtags&keyword=&type=all&order_by=reg_date&board_number=${BOARD_ID}&page=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json, text/plain, */*', 'Referer': `https://www.sooplive.com/station/${BJID}/board/${BOARD_ID}`, 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36' }, cache: 'no-store' });
    const data = await res.json();
    return (data.notice_data || []).slice(0, 3).map((n: any) => {
      const rawText = (n.content?.summary || n.title_name || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const isGenericTitle = !n.title_name || n.title_name === '공지' || n.title_name.length <= 2;
      const firstSentence = rawText.split(/[.!?\n]/)[0].trim().slice(0, 50);
      const title = isGenericTitle ? (firstSentence || n.title_name) : n.title_name;
      return { id: n.title_no, title, summary: rawText.slice(0, 120), date: n.reg_date?.split(' ')[0] || '', likes: n.count?.like_cnt || 0, comments: n.count?.comment_cnt || 0, url: `https://www.sooplive.com/station/${BJID}/post/${n.title_no}` };
    });
  } catch { return []; }
}, ['notices-v3'], { revalidate: 300 });

export default async function Home() {
    const getLiveStatus = async () => {
    try {
      const res = await fetch(
        `https://live.sooplive.com/api/get_broad_state_list.php?szBjId=${process.env.SOOP_BJID || 'townboy'}`,
        { headers: { 'Referer': 'https://www.sooplive.com/', 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      );
      const data = await res.json();
      const info = data?.CHANNEL?.BROAD_INFOS?.[0]?.list?.[0];
      const isLive = info && info.nState !== -2 && info.nState !== undefined && info.nState !== '';
      return { isLive: !!isLive, title: info?.szBroadTitle || '', viewers: info?.nCurrentView || 0, broadNo: info?.nBroadNo || '' };
    } catch { return { isLive: false, title: '', viewers: 0, broadNo: '' }; }
  };

  const [videos, soopData, notices, liveStatus] = await Promise.all([getYoutubeVideos(), getAllVods(), getNotices(), getLiveStatus()]);
  const vods: any[] = soopData.vods || [];
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthVideos = videos.filter((v: any) => v.publishedAt?.startsWith(currentMonth));
  const top10 = [...thisMonthVideos].sort((a: any, b: any) => b.views - a.views).slice(0, 10);

  const monthlyTop10: Record<string, any[]> = {};
  videos.forEach((v: any) => {
    const mk = v.publishedAt?.slice(0, 7); if (!mk) return;
    if (!monthlyTop10[mk]) monthlyTop10[mk] = [];
    monthlyTop10[mk].push(v);
  });
  Object.keys(monthlyTop10).forEach(mk => { monthlyTop10[mk] = [...monthlyTop10[mk]].sort((a, b) => b.views - a.views).slice(0, 10); });

  // 월별 YouTube 전체 (프롬프트용)
  const monthlyAll: Record<string, any[]> = {};
  videos.forEach((v: any) => {
    const mk = v.publishedAt?.slice(0, 7); if (!mk) return;
    if (!monthlyAll[mk]) monthlyAll[mk] = [];
    monthlyAll[mk].push(v);
  });
  Object.keys(monthlyAll).forEach(mk => { monthlyAll[mk] = [...monthlyAll[mk]].sort((a, b) => b.views - a.views); });

  const soopByDate: Record<string, any[]> = {};
  vods.forEach((v: any) => { if (!soopByDate[v.date]) soopByDate[v.date] = []; soopByDate[v.date].push(v); });
  const monthMap: Record<string, Record<number, any[]>> = {};
  Object.keys(soopByDate).forEach(date => { const mk = date.substring(0, 7); if (!monthMap[mk]) monthMap[mk] = {}; monthMap[mk][parseInt(date.split('-')[2], 10)] = soopByDate[date]; });
  const monthTop5: Record<string, any[]> = {};
  [...new Set(vods.map((v: any) => v.date.substring(0, 7)))].forEach(mk => { const mv = vods.filter((v: any) => v.date.startsWith(mk)); monthTop5[mk] = [...mv].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5); });

  // 월별 SOOP 전체 (프롬프트용)
  const soopMonthAll: Record<string, any[]> = {};
  [...new Set(vods.map((v: any) => v.date.substring(0, 7)))].forEach(mk => {
    soopMonthAll[mk] = vods.filter((v: any) => v.date.startsWith(mk)).sort((a: any, b: any) => (b.views || 0) - (a.views || 0));
  });
  const sortedMonths = Object.keys(monthMap).sort();

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css');
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;overflow-x:hidden;}
        body{font-family:'Paperlogy',-apple-system,sans-serif;transition:background 0.3s,color 0.3s;overflow-x:hidden;}
        a{text-decoration:none;color:inherit;}
        :root{--bg:#F5EFE2;--bg-section:#F5EFE2;--bg-deeper:#E8DDD0;--card:rgba(255,251,244,0.80);--card-border:rgba(0,0,0,0.09);--card-shadow:0 4px 24px rgba(0,0,0,0.09),0 1px 6px rgba(0,0,0,0.06);--card-shadow-hover:0 16px 56px rgba(0,0,0,0.16),0 4px 16px rgba(0,0,0,0.10);--text:#1A1A1A;--text-inv:#1A1A1A;--text-muted:#888888;--text-sub:rgba(0,0,0,0.45);--accent:#EB701A;--header-bg:rgba(245,239,226,0.88);--header-border:rgba(0,0,0,0.07);--nav-text:rgba(0,0,0,0.55);--footer-bg:#111111;--radius-card:24px;--radius-lg:32px;}
        [data-theme="dark"]{--bg:#0a0a0a;--bg-section:#111111;--bg-deeper:#080808;--card:rgba(28,28,28,0.80);--card-border:rgba(255,255,255,0.08);--card-shadow:0 4px 24px rgba(0,0,0,0.40),0 1px 6px rgba(0,0,0,0.25);--card-shadow-hover:0 20px 60px rgba(0,0,0,0.55),0 6px 20px rgba(0,0,0,0.30);--text:#EDEDED;--text-inv:#ffffff;--text-muted:#666666;--text-sub:rgba(255,255,255,0.35);--accent:#EB701A;--header-bg:rgba(8,8,8,0.92);--header-border:rgba(255,255,255,0.05);--nav-text:rgba(255,255,255,0.5);--footer-bg:#050505;--radius-card:24px;--radius-lg:32px;}
        body{background:var(--bg);color:var(--text);}
        .sec-main{background:var(--bg-section);transition:background 0.3s;}
        .sec-footer{background:var(--footer-bg);transition:background 0.3s;}
        .card{background:var(--card);border-radius:var(--radius-card,24px);overflow:hidden;border:1px solid var(--card-border);box-shadow:var(--card-shadow);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);transition:transform 0.25s cubic-bezier(0.22,1,0.36,1),box-shadow 0.25s cubic-bezier(0.22,1,0.36,1),background 0.3s;}
        .card:hover{transform:translateY(-6px) scale(1.01);box-shadow:var(--card-shadow-hover);}
        .notice-card{display:flex;flex-direction:column;gap:8px;padding:20px;background:var(--card);border-radius:var(--radius-card,24px);border:1px solid var(--card-border);box-shadow:var(--card-shadow);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);text-decoration:none;transition:transform 0.2s cubic-bezier(0.22,1,0.36,1),box-shadow 0.2s cubic-bezier(0.22,1,0.36,1);color:inherit;}
        .notice-card:hover{transform:translateY(-4px) scale(1.01);box-shadow:var(--card-shadow-hover);}
        .site-header{background:transparent;border-bottom:1px solid transparent;backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);transition:background 0.35s,border-color 0.35s,backdrop-filter 0.35s,-webkit-backdrop-filter 0.35s;}
        .site-header.scrolled{background:var(--header-bg);border-bottom:1px solid var(--header-border);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);}
        .sec-title{color:var(--text-inv);transition:color 0.3s;}
        .sec-sub-text{color:var(--text-sub);transition:color 0.3s;}
        .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:0.7rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;background:rgba(235,112,26,0.08);padding:4px 10px 4px 8px;border-radius:100px;}
        .eyebrow::before{content:'';display:block;width:24px;height:2px;background:var(--accent);border-radius:2px;}
        .section-title{font-size:clamp(1.8rem,3vw,2.6rem);font-weight:800;letter-spacing:-0.05em;line-height:1.05;font-stretch:condensed;}
        .fade-in-up{opacity:0;transform:translateY(32px);transition:opacity 0.65s cubic-bezier(0.22,1,0.36,1),transform 0.65s cubic-bezier(0.22,1,0.36,1);}
        .fade-in-up.visible{opacity:1;transform:translateY(0);}
        .logo-text{color:var(--text-inv);transition:color 0.3s;}
        .nav-link{color:var(--nav-text);transition:color 0.3s;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}

        
        .gemini-open-btn { transition: opacity 0.2s, box-shadow 0.2s; }
        .gemini-open-btn:hover { opacity: 0.88; box-shadow: 0 8px 28px rgba(66,133,244,0.45) !important; }
        .gemini-steps { display: flex; flex-direction: column; gap: 0; }
        .gemini-step-row { display: flex; align-items: flex-start; gap: 12px; }

        /* 모바일 반응형 */
        @media (max-width: 768px) {
          .mob-hide { display: none !important; }
          .mob-hide-card { display: none !important; }
          .mob-video-grid .card:nth-child(n+4) { display: none !important; }
          .mob-notice-list .notice-card:nth-child(n+3) { display: none !important; }
          .mob-video-grid { gap: 6px !important; }
          .mob-notice-list { gap: 8px !important; }
          .mob-nav { gap: 0.6rem !important; }
          .mob-nav a, .mob-nav button { font-size: 0.72rem !important; padding: 0.35rem 0.7rem !important; }
          .mob-hero { padding: clamp(20px,5vw,40px) 1.2rem !important; }
          .mob-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse 70% 80% at 15% 50%, rgba(235,112,26,0.12) 0%, transparent 70%);
            pointer-events: none;
            z-index: 0;
          }
          .mob-hero::after {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 128px 128px;
            opacity: 0.35;
            pointer-events: none;
            mix-blend-mode: overlay;
            z-index: 0;
          }
          .mob-hero > * { position: relative; z-index: 1; }
          .mob-hero h1 span { font-size: clamp(1.8rem,10vw,3rem) !important; } .mob-hero h1 em { font-size: clamp(1.1rem,6vw,2rem) !important; }
          .mob-section { padding: 0 1.2rem !important; }
          .mob-cal-section { padding: 24px 1.2rem 40px !important; }
          /* tools-btn 제거됨 */
          .gemini-step-row { gap: 10px !important; }
          @media (max-width: 960px) {
            .hero-card { display: none !important; }
          }
        }
      `}</style>
      <ScrollObserver />
      <div style={{height:'72px'}} />
      <header className="site-header" style={{position:'fixed',top:0,left:0,right:0,zIndex:200,height:'72px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 clamp(1rem,4vw,3rem)',boxShadow:'0 1px 20px rgba(0,0,0,0.08)'}}>
        <a href="/" style={{textDecoration:'none',display:'flex',alignItems:'center'}}>
          <svg width="120" height="32" viewBox="0 0 340 90" xmlns="http://www.w3.org/2000/svg" aria-label="SMEB Archive">
            <text x="0" y="76" fontFamily="'Paperlogy',sans-serif" fontWeight="900" fontSize="84" letterSpacing="-3" fill="var(--text-inv)">SME</text>
            <text x="192" y="76" fontFamily="'Paperlogy',sans-serif" fontWeight="900" fontSize="84" fill="#EB701A">B</text>
            <rect x="0" y="80" width="248" height="2.5" fill="var(--text-inv)" rx="1.5"/>
            <text x="2" y="93" fontFamily="'Paperlogy',sans-serif" fontWeight="400" fontSize="11" letterSpacing="4" fill="var(--text-muted)">ARCHIVE</text>
          </svg>
        </a>
        <nav className="mob-nav" style={{display:'flex',gap:'1.4rem',alignItems:'center'}}>
          <a href="/rewind/2026" className="nav-link mob-hide" style={{fontSize:'0.88rem',fontWeight:600}}>연간결산</a>
          <a href="/apps" className="nav-link mob-hide" style={{fontSize:'0.88rem',fontWeight:600}}>도구</a>
          <ThemeToggle />
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{background:'#EB701A',color:'#fff',padding:'0.5rem 1.1rem',borderRadius:'100px',fontSize:'0.85rem',fontWeight:700,textDecoration:'none'}}>YouTube ↗</a>
        </nav>
      </header>

      {liveStatus.isLive && (
        <a
          href={`https://www.sooplive.com/${process.env.SOOP_BJID || 'townboy'}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:'12px',
            background:'linear-gradient(90deg,#e8000a,#c0000a)',
            color:'#fff', padding:'10px 20px', textDecoration:'none',
            borderBottom:'1px solid rgba(255,255,255,0.15)',
            position:'fixed', top:'72px', zIndex:199,
          }}
        >
          <span style={{
            display:'inline-flex', alignItems:'center', gap:'6px',
            background:'rgba(255,255,255,0.2)', borderRadius:'100px',
            padding:'3px 10px', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.06em',
          }}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#fff',display:'inline-block',animation:'pulse 1.2s infinite'}} />
            LIVE
          </span>
          <span style={{fontSize:'0.88rem', fontWeight:600, maxWidth:'60vw', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
            {liveStatus.title || '스맵임 방송 중'}
          </span>
          {liveStatus.viewers > 0 && (
            <span style={{fontSize:'0.78rem', opacity:0.85, fontWeight:500, flexShrink:0}}>
              👁 {Number(liveStatus.viewers).toLocaleString()}명 시청 중
            </span>
          )}
          <span style={{fontSize:'0.78rem', opacity:0.75, flexShrink:0}}>→ 바로가기</span>
        </a>
      )}


      <section className="mob-hero" style={{padding:'clamp(1rem,2.5vw,1.8rem) clamp(1rem,3vw,2.5rem)',background:'#0d0d0d',position:'relative',overflow:'hidden'}}>
        <div className="fade-in-up" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap' as const}}>
          <div>
            <h1 style={{margin:0,lineHeight:1,fontWeight:900,display:'flex',alignItems:'baseline',gap:'clamp(0.4rem,1vw,0.7rem)',flexWrap:'wrap' as const}}>
              <span style={{fontSize:'clamp(2rem,6vw,4rem)',color:'#EB701A',letterSpacing:'-0.04em'}}>SMEB</span>
              <em style={{fontSize:'clamp(1.2rem,3.5vw,2.4rem)',color:'#ffffff',fontStyle:'italic',letterSpacing:'-0.04em',opacity:0.9}}>ARCHIVE</em>
            </h1>
            <p style={{margin:'6px 0 0',fontSize:'clamp(0.7rem,1.5vw,0.82rem)',color:'rgba(255,255,255,0.35)',letterSpacing:'0.04em'}}>스맵 송경호 팬 아카이브</p>
          </div>
        </div>
      </section>

      <section id="top3" className="sec-main mob-section" style={{padding:'0 clamp(1.5rem,5vw,3rem) 0'}}>
        <div style={{maxWidth:'1400px',margin:'0 auto',paddingBottom:'40px'}} className="fade-in-up">
<div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'24px',paddingBottom:'14px',borderBottom:'2px solid #EB701A',width:'fit-content'}}>
          <span style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.18em',color:'var(--text-muted)',textTransform:'uppercase'}}>YOUTUBE</span>
          <h2 style={{fontSize:'clamp(1.6rem,3.5vw,2.6rem)',fontWeight:900,letterSpacing:'-0.04em',lineHeight:1,color:'var(--text)',margin:0}}>유튜브 TOP 10</h2>
        </div>
          <YoutubeSection videos={videos} top10={top10} notices={notices} monthlyTop10={monthlyTop10} today={today.toISOString()} />

          {/* ─── 일정표 ─── */}
          <div id="schedule" style={{marginTop:'0',paddingTop:'48px',borderTop:'1px solid var(--card-border)'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'24px',paddingBottom:'14px',borderBottom:'2px solid #EB701A',width:'fit-content'}}>
              <span style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.18em',color:'var(--text-muted)',textTransform:'uppercase'}}>SCHEDULE</span>
              <h2 style={{fontSize:'clamp(1.6rem,3.5vw,2.6rem)',fontWeight:900,letterSpacing:'-0.04em',lineHeight:1,color:'var(--text)',margin:0}}>일정표</h2>
            </div>
            <ScheduleEmbed />
          </div>

          {/* ─── SOOP 다시보기 헤더 ─── */}
          <div id="soopcal" style={{marginTop:'0',paddingTop:'48px',borderTop:'1px solid var(--card-border)'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'4px',marginBottom:'24px',paddingBottom:'14px',borderBottom:'2px solid #EB701A',width:'fit-content'}}>
              <span style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.18em',color:'var(--text-muted)',textTransform:'uppercase'}}>SOOP VOD</span>
              <h2 style={{fontSize:'clamp(1.6rem,3.5vw,2.6rem)',fontWeight:900,letterSpacing:'-0.04em',lineHeight:1,color:'var(--text)',margin:0}}>SOOP 다시보기</h2>
            </div>
            <CalendarSection sortedMonths={sortedMonths} monthMap={monthMap} monthTop5={monthTop5} today={today.toISOString()} />
          </div>
        </div>
      </section>

      <footer className="sec-footer" style={{borderTop:'1px solid rgba(255,255,255,0.08)',padding:'1.6rem clamp(1.2rem,5vw,3rem)'}}>
        <div style={{maxWidth:'1400px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap' as const,gap:'12px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'1rem',fontWeight:900,letterSpacing:'-0.03em',color:'#fff'}}>SMEB<span style={{color:'#EB701A'}}>.</span></span>
            <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.25)',borderLeft:'1px solid rgba(255,255,255,0.12)',paddingLeft:'10px'}}>스맵 송경호 아카이브</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'20px'}}>
            <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{fontSize:'0.78rem',fontWeight:600,color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>YouTube</a>
            <a href="https://www.sooplive.com/station/townboy" target="_blank" style={{fontSize:'0.78rem',fontWeight:600,color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>SOOP</a>
            <a href="https://cafe.naver.com/smebsmeb" target="_blank" style={{fontSize:'0.78rem',fontWeight:600,color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>팬카페</a>
          </div>
        </div>
      </footer>
    </>
  );
}
