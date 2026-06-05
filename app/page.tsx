import { unstable_cache } from 'next/cache';
import CalendarSection from './calendar-section';
import ScrollObserver from './scroll-observer';
import YoutubeSection from './youtube-modal';
import ThemeToggle from './theme-toggle';
import PromptCopyCard from './prompt-copy-card';
import HeroLiveCard from './hero-live-card';

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

  const soopByDate: Record<string, any[]> = {};
  vods.forEach((v: any) => { if (!soopByDate[v.date]) soopByDate[v.date] = []; soopByDate[v.date].push(v); });
  const monthMap: Record<string, Record<number, any[]>> = {};
  Object.keys(soopByDate).forEach(date => { const mk = date.substring(0, 7); if (!monthMap[mk]) monthMap[mk] = {}; monthMap[mk][parseInt(date.split('-')[2], 10)] = soopByDate[date]; });
  const monthTop5: Record<string, any[]> = {};
  [...new Set(vods.map((v: any) => v.date.substring(0, 7)))].forEach(mk => { const mv = vods.filter((v: any) => v.date.startsWith(mk)); monthTop5[mk] = [...mv].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5); });
  const sortedMonths = Object.keys(monthMap).sort();

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;overflow-x:hidden;}
        body{font-family:'Pretendard',sans-serif;transition:background 0.3s,color 0.3s;overflow-x:hidden;}
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
        .site-header{background:var(--header-bg);border-bottom:1px solid var(--header-border);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);transition:background 0.3s,border-color 0.3s;}
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

        /* Gemini 섹션 반응형 그리드 */
        .gemini-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 0; align-items: stretch; margin-top: 0; }
        .gemini-flow-arrow { display: flex; align-items: center; justify-content: center; padding: 0 10px; color: var(--text-muted); font-size: 1.4rem; font-weight: 200; flex-shrink: 0; }
        .gemini-open-btn { transition: opacity 0.2s, box-shadow 0.2s; }
        .gemini-open-btn:hover { opacity: 0.88; box-shadow: 0 8px 28px rgba(66,133,244,0.45) !important; }
        .gemini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 32px; }
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
          .mob-hero { padding: clamp(40px,8vw,80px) 1.2rem !important; }
          .mob-hero h1 span { font-size: clamp(3.5rem,22vw,8rem) !important; } .mob-hero h1 em { font-size: clamp(2rem,13vw,5rem) !important; }
          .mob-section { padding: 0 1.2rem !important; }
          .mob-cal-section { padding: 24px 1.2rem 40px !important; }
          .gemini-flow { grid-template-columns: 1fr !important; }
          .gemini-flow-arrow { transform: rotate(90deg); padding: 4px 0; }
          .gemini-grid { grid-template-columns: 1fr !important; }
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
            <text x="0" y="76" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="900" fontSize="84" letterSpacing="-3" fill="var(--text-inv)">SME</text>
            <text x="192" y="76" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="900" fontSize="84" fill="#EB701A">B</text>
            <rect x="0" y="80" width="248" height="2.5" fill="var(--text-inv)" rx="1.5"/>
            <text x="2" y="93" fontFamily="'Helvetica Neue',Arial,sans-serif" fontWeight="400" fontSize="11" letterSpacing="4" fill="var(--text-muted)">ARCHIVE</text>
          </svg>
        </a>
        <nav className="mob-nav" style={{display:'flex',gap:'1.2rem',alignItems:'center'}}>
          <a href="#top3" className="nav-link mob-hide" style={{fontSize:'0.92rem',fontWeight:600}}>BEST 10</a>
          <a href="#videos" className="nav-link mob-hide" style={{fontSize:'0.92rem',fontWeight:600}}>유튜브</a>
          <a href="#soopcal" className="nav-link mob-hide" style={{fontSize:'0.92rem',fontWeight:600}}>다시보기</a>
          <ThemeToggle />
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{background:'linear-gradient(135deg,#EB701A,#ff8c3a)',color:'#fff',padding:'0.55rem 1.3rem',borderRadius:'100px',fontSize:'0.88rem',fontWeight:700,boxShadow:'0 4px 14px rgba(235,112,26,0.35)'}}>YouTube ↗</a>
          <a href="/rewind/2025" style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'linear-gradient(135deg,#1a1a2e,#2d1b69)',color:'#fff',padding:'0.55rem 1.3rem',borderRadius:'100px',fontSize:'0.88rem',fontWeight:700,boxShadow:'0 4px 14px rgba(45,27,105,0.4)',textDecoration:'none',whiteSpace:'nowrap' as const,border:'1px solid rgba(255,255,255,0.15)'}}>✨ 2025 레포트</a>
          <a href="https://cafe.naver.com/smebsmeb" target="_blank" className="mob-hide" style={{background:'linear-gradient(135deg,#03C75A,#02b351)',color:'#fff',padding:'0.55rem 1.3rem',borderRadius:'100px',fontSize:'0.88rem',fontWeight:700,boxShadow:'0 4px 14px rgba(3,199,90,0.35)'}}>팬카페 ↗</a>
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


      <section className="mob-hero" style={{padding:'clamp(3rem,8vw,6rem) clamp(1rem,3vw,2.5rem)',background:'#0d0d0d',position:'relative',overflow:'hidden'}}>
        <div className="fade-in-up" style={{display:'flex',alignItems:'center',gap:'clamp(2rem,4vw,4rem)',flexWrap:'wrap'}}>
          <div style={{flexGrow:1,flexShrink:1,minWidth:'280px'}}>
            <h1 style={{margin:0,lineHeight:0.86,fontWeight:900}}>
              <span style={{display:'block',fontSize:'clamp(4.5rem,28vw,22rem)',color:'#EB701A',letterSpacing:'-0.04em'}}>SMEB</span>
              <em style={{display:'block',fontSize:'clamp(2.8rem,14vw,11rem)',color:'#ffffff',fontStyle:'italic',letterSpacing:'-0.05em'}}>ARCHIVE</em>
            </h1>
          </div>
          <div className="mob-hide hero-card" style={{flexShrink:0,width:'clamp(240px,22vw,300px)'}}>
            <HeroLiveCard />
          </div>
        </div>
      </section>

      <section id="top3" className="sec-main mob-section" style={{padding:'0 clamp(1.5rem,5vw,3rem) 0'}}>
        <div style={{maxWidth:'1400px',margin:'0 auto',paddingBottom:'40px'}} className="fade-in-up">
          <div style={{margin:'0 calc(-1 * clamp(1.5rem,5vw,3rem)) 28px',background:'#EB701A',padding:'28px clamp(1.5rem,5vw,3rem)',overflow:'hidden',position:'relative',borderRadius:'20px'}}>
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,0,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.06) 1px,transparent 1px)',backgroundSize:'36px 36px',pointerEvents:'none'}} />
          <h2 style={{fontSize:'clamp(2rem,5vw,4rem)',fontWeight:900,letterSpacing:'-0.06em',lineHeight:1,color:'#1A1A1A',position:'relative',zIndex:1}}>
            유튜브 <em style={{fontStyle:'italic'}}>TOP 10</em>
          </h2>
        </div>
          <YoutubeSection videos={videos} top10={top10} notices={notices} monthlyTop10={monthlyTop10} today={today.toISOString()} />
          {/* ─── Gemini 콘텐츠 분석 섹션 ─── */}
          <div style={{marginTop:'40px'}}>

            {/* 섹션 헤더 — 오렌지 풀블리드 */}
            <div style={{margin:'0 calc(-1 * clamp(1.5rem,5vw,3rem)) 28px',background:'#EB701A',padding:'28px clamp(1.5rem,5vw,3rem)',overflow:'hidden',position:'relative',borderRadius:'20px'}}>
              <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,0,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.06) 1px,transparent 1px)',backgroundSize:'36px 36px',pointerEvents:'none'}} />
              <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',flexWrap:'wrap' as const}}>
                <h2 style={{fontSize:'clamp(2rem,5vw,4rem)',fontWeight:900,letterSpacing:'-0.06em',lineHeight:1,color:'#1A1A1A'}}>
                  AI <em style={{fontStyle:'italic'}}>콘텐츠 분석</em>
                </h2>
                <div style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(0,0,0,0.12)',borderRadius:'100px',padding:'6px 14px',flexShrink:0}}>
                  <span style={{fontSize:'0.85rem'}}>✨</span>
                  <span style={{fontSize:'0.75rem',fontWeight:800,color:'rgba(0,0,0,0.6)',letterSpacing:'0.04em'}}>Powered by Gemini</span>
                </div>
              </div>
            </div>

            {/* ── 3단계 흐름 카드 ── */}
            <div className="gemini-flow">

              {/* ① 설정 */}
              <div style={{
                padding:'24px 22px',
                background:'linear-gradient(135deg,rgba(66,133,244,0.07) 0%,rgba(66,133,244,0.02) 100%)',
                border:'1px solid rgba(66,133,244,0.15)',
                borderRadius:'20px',
                display:'flex',flexDirection:'column' as const,gap:'16px',
              }}>
                {/* 스텝 헤더 */}
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{
                    width:'36px',height:'36px',borderRadius:'50%',flexShrink:0,
                    background:'linear-gradient(135deg,#4285f4,#34a853)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'0.72rem',fontWeight:900,color:'#fff',letterSpacing:'-0.02em',
                  }}>01</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase' as const,color:'#4285f4'}}>STEP 1</div>
                    <p style={{fontSize:'1.05rem',fontWeight:800,color:'var(--text)',margin:0,letterSpacing:'-0.03em',lineHeight:1}}>설정</p>
                  </div>
                  <span style={{flexShrink:0,fontSize:'0.62rem',fontWeight:700,color:'#4285f4',background:'rgba(66,133,244,0.1)',borderRadius:'100px',padding:'3px 10px',whiteSpace:'nowrap' as const,border:'1px solid rgba(66,133,244,0.2)'}}>최초 1회만</span>
                </div>
                {/* 경로 */}
                <div style={{display:'flex',flexDirection:'column' as const,gap:'6px',paddingLeft:'4px'}}>
                  {['Gemini 설정 열기','개인 인텔리전스','연결된 앱','Google Workspace 활성화'].map((step, i, arr) => (
                    <div key={i}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <div style={{width:'6px',height:'6px',borderRadius:'50%',flexShrink:0,background:i===arr.length-1?'#4285f4':'var(--card-border)',border:i===arr.length-1?'none':'2px solid rgba(66,133,244,0.3)'}} />
                        <span style={{fontSize:'0.82rem',color:i===arr.length-1?'var(--text)':'var(--text-muted)',fontWeight:i===arr.length-1?700:400}}>{step}</span>
                      </div>
                      {i<arr.length-1 && <div style={{marginLeft:'2px',paddingLeft:'2px',height:'10px',borderLeft:'1.5px dashed rgba(66,133,244,0.25)'}} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* → */}
              <div className="gemini-flow-arrow">→</div>

              {/* ② 복사 (메인 CTA) */}
              <div style={{
                padding:'24px 22px',
                background:'linear-gradient(135deg,rgba(235,112,26,0.09) 0%,rgba(235,112,26,0.03) 100%)',
                border:'2px solid rgba(235,112,26,0.28)',
                borderRadius:'20px',
                display:'flex',flexDirection:'column' as const,gap:'16px',
                position:'relative' as const,
              }}>
                {/* 매달 배지 */}
                <div style={{position:'absolute' as const,top:'-12px',left:'50%',transform:'translateX(-50%)',background:'#EB701A',color:'#fff',fontSize:'0.62rem',fontWeight:800,padding:'3px 14px',borderRadius:'100px',whiteSpace:'nowrap' as const,letterSpacing:'0.08em',boxShadow:'0 4px 12px rgba(235,112,26,0.35)'}}>
                  ✦ 매달 반복
                </div>
                {/* 스텝 헤더 */}
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{
                    width:'36px',height:'36px',borderRadius:'50%',flexShrink:0,
                    background:'linear-gradient(135deg,#EB701A,#ff8c3a)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'0.72rem',fontWeight:900,color:'#fff',letterSpacing:'-0.02em',
                  }}>02</div>
                  <div>
                    <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase' as const,color:'#EB701A'}}>STEP 2</div>
                    <p style={{fontSize:'1.05rem',fontWeight:800,color:'var(--text)',margin:0,letterSpacing:'-0.03em',lineHeight:1}}>분석 질문 복사</p>
                  </div>
                </div>
                {/* 프롬프트 복사 카드 */}
                <PromptCopyCard
                  monthlyTop10={monthlyTop10}
                  monthTop5={monthTop5}
                  sortedMonths={sortedMonths}
                  currentMonth={currentMonth}
                />
              </div>

              {/* → */}
              <div className="gemini-flow-arrow">→</div>

              {/* ③ 분석 */}
              <div style={{
                padding:'24px 22px',
                background:'linear-gradient(135deg,rgba(66,133,244,0.07) 0%,rgba(52,168,83,0.05) 50%,rgba(251,188,5,0.04) 100%)',
                border:'1px solid rgba(66,133,244,0.15)',
                borderRadius:'20px',
                display:'flex',flexDirection:'column' as const,gap:'16px',
              }}>
                {/* 스텝 헤더 */}
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{
                    width:'36px',height:'36px',borderRadius:'50%',flexShrink:0,
                    background:'linear-gradient(135deg,#4285f4,#34a853,#fbbc05,#ea4335)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',
                  }}>✨</div>
                  <div>
                    <div style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase' as const,color:'#4285f4'}}>STEP 3</div>
                    <p style={{fontSize:'1.05rem',fontWeight:800,color:'var(--text)',margin:0,letterSpacing:'-0.03em',lineHeight:1}}>Gemini 분석</p>
                  </div>
                </div>
                {/* Gemini 열기 버튼 */}
                <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer"
                  className="gemini-open-btn"
                  style={{
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                    background:'linear-gradient(135deg,#4285f4,#34a853)',
                    color:'#fff',borderRadius:'14px',padding:'14px 20px',
                    textDecoration:'none',fontWeight:700,fontSize:'0.92rem',
                    boxShadow:'0 6px 20px rgba(66,133,244,0.3)',
                  }}
                >
                  Gemini 열기 ↗
                </a>
                {/* PRO 팁 */}
                <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
                  <span style={{flexShrink:0,fontSize:'0.6rem',fontWeight:800,letterSpacing:'0.08em',color:'#fff',background:'linear-gradient(135deg,#4285f4,#a855f7)',borderRadius:'100px',padding:'2px 8px',whiteSpace:'nowrap' as const,marginTop:'2px'}}>PRO</span>
                  <p style={{fontSize:'0.75rem',color:'var(--text-muted)',lineHeight:1.55,margin:0}}>
                    로그인 후 <span style={{color:'#a855f7',fontWeight:700}}>Pro 모드</span>로 변경하면 더 구체적인 분석을 받을 수 있어요
                  </p>
                </div>
              </div>

            </div>
          </div>
          {/* ─── /Gemini 섹션 ─── */}
        </div>
      </section>

      <section id="soopcal" className="sec-main mob-cal-section" style={{padding:'0 clamp(1.5rem,5vw,3rem) 60px',position:'relative'}}>
        <div style={{position:'absolute',bottom:'10%',right:'5%',width:'500px',height:'400px',background:'radial-gradient(ellipse,rgba(235,112,26,0.06) 0%,transparent 70%)',pointerEvents:'none'}} />
        <div style={{maxWidth:'1600px',margin:'0 auto',position:'relative',zIndex:1}} className="fade-in-up">
          <div style={{margin:'0 calc(-1 * clamp(1.5rem,5vw,3rem)) 28px',background:'#EB701A',padding:'28px clamp(1.5rem,5vw,3rem)',overflow:'hidden',position:'relative',borderRadius:'20px'}}>
            <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,0,0,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.06) 1px,transparent 1px)',backgroundSize:'36px 36px',pointerEvents:'none'}} />
            <h2 style={{fontSize:'clamp(2rem,5vw,4rem)',fontWeight:900,letterSpacing:'-0.06em',lineHeight:1,color:'#1A1A1A',position:'relative',zIndex:1}}>
              SOOP <em style={{fontStyle:'italic'}}>다시보기</em>
            </h2>
          </div>
          <CalendarSection sortedMonths={sortedMonths} monthMap={monthMap} monthTop5={monthTop5} today={today.toISOString()} />
        </div>
      </section>

      <footer className="sec-footer" style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'2.5rem clamp(1.2rem,5vw,3rem)',textAlign:'center'}}>
        <p style={{fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em',color:'#fff',marginBottom:'10px'}}>SMEB<span style={{color:'#EB701A'}}>.</span></p>
        <p style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.3)',marginBottom:'14px'}}>롤 전 프로게이머 스맵 송경호 · {today.getFullYear()}년 {today.getMonth()+1}월</p>
        <div style={{display:'flex',gap:'1.5rem',justifyContent:'center',flexWrap:'wrap'}}>
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>YouTube ↗</a>
          <a href="https://www.sooplive.com/station/townboy" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>SOOP 방송국 ↗</a>
          <a href="https://cafe.naver.com/smebsmeb" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>팬카페 ↗</a>
        </div>
      </footer>
    </>
  );
}
