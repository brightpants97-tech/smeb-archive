import { unstable_cache } from 'next/cache';
import CalendarSection from './calendar-section';
import ScrollObserver from './scroll-observer';
import YoutubeSection from './youtube-modal';
import ThemeToggle from './theme-toggle';

// ── YouTube 전체 영상 가져오기 (pageToken 페이지네이션) ──────────────────────
const getYoutubeVideos = unstable_cache(async () => {
  try {
    const KEY = process.env.YOUTUBE_API_KEY;
    const CH  = process.env.YOUTUBE_CHANNEL_ID;

    // 1단계: search API로 전체 videoId 수집 (50개씩, pageToken 반복)
    const allVideoIds: string[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const params = new URLSearchParams({
        part: 'id',
        channelId: CH!,
        maxResults: '50',
        order: 'date',
        type: 'video',
        key: KEY!,
        ...(pageToken ? { pageToken } : {}),
      });
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.error) { console.error('YT search error:', data.error); break; }
      (data.items || []).forEach((i: any) => {
        if (i.id?.videoId) allVideoIds.push(i.id.videoId);
      });
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (!allVideoIds.length) return [];

    // 2단계: videos API로 통계 가져오기 (50개씩 배치)
    const allVideos: any[] = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const ids = allVideoIds.slice(i, i + 50).join(',');
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${KEY}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      (data.items || []).forEach((item: any) => {
        allVideos.push({
          id: item.id,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
          publishedAt: item.snippet.publishedAt,
          views: parseInt(item.statistics?.viewCount || '0'),
        });
      });
    }

    // 최신순 정렬
    return allVideos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } catch (e) {
    console.error('getYoutubeVideos error:', e);
    return [];
  }
}, ['yt-videos-all-v1'], { revalidate: 3600 });

async function fetchSoopPage(bjid: string, page: number) {
  try {
    const res = await fetch(
      `https://api-channel.sooplive.com/v1.1/channel/${bjid}/vod/all/streamer?startDate=&endDate=&keyword=&orderBy=regDate&perPage=60&page=${page}&field=title,contents,userNick,userId`,
      { headers: { 'Referer': 'https://www.sooplive.com/', 'Origin': 'https://www.sooplive.com', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    );
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
  const CHUNK = 10;
  let p = 2;
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
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': `https://www.sooplive.com/station/${BJID}/board/${BOARD_ID}`,
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    const data = await res.json();
    return (data.notice_data || []).slice(0, 3).map((n: any) => {
      const rawText = (n.content?.summary || n.title_name || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const isGenericTitle = !n.title_name || n.title_name === '공지' || n.title_name.length <= 2;
      const firstSentence = rawText.split(/[.!?\n]/)[0].trim().slice(0, 50);
      const title = isGenericTitle ? (firstSentence || n.title_name) : n.title_name;
      return {
        id: n.title_no, title,
        summary: rawText.slice(0, 120),
        date: n.reg_date?.split(' ')[0] || '',
        likes: n.count?.like_cnt || 0, comments: n.count?.comment_cnt || 0,
        url: `https://www.sooplive.com/station/${BJID}/post/${n.title_no}`,
      };
    });
  } catch { return []; }
}, ['notices-v3'], { revalidate: 300 });

export default async function Home() {
  const [videos, soopData, notices] = await Promise.all([getYoutubeVideos(), getAllVods(), getNotices()]);
  const vods: any[] = soopData.vods || [];
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthVideos = videos.filter((v: any) => v.publishedAt?.startsWith(currentMonth));
  const top10 = [...thisMonthVideos].sort((a: any, b: any) => b.views - a.views).slice(0, 10);

  // ── 월별 유튜브 TOP 10 계산 (전체 영상 기반) ─────────────────────────────
  const monthlyTop10: Record<string, any[]> = {};
  videos.forEach((v: any) => {
    const mk = v.publishedAt?.slice(0, 7);
    if (!mk) return;
    if (!monthlyTop10[mk]) monthlyTop10[mk] = [];
    monthlyTop10[mk].push(v);
  });
  Object.keys(monthlyTop10).forEach(mk => {
    monthlyTop10[mk] = [...monthlyTop10[mk]]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  });

  // ── SOOP 날짜별 VOD 맵 ────────────────────────────────────────────────────
  const soopByDate: Record<string, any[]> = {};
  vods.forEach((v: any) => { if (!soopByDate[v.date]) soopByDate[v.date] = []; soopByDate[v.date].push(v); });

  const monthMap: Record<string, Record<number, any[]>> = {};
  Object.keys(soopByDate).forEach(date => {
    const mk = date.substring(0, 7);
    if (!monthMap[mk]) monthMap[mk] = {};
    monthMap[mk][parseInt(date.split('-')[2], 10)] = soopByDate[date];
  });

  // ── SOOP 월별 TOP 5 ───────────────────────────────────────────────────────
  const monthTop5: Record<string, any[]> = {};
  const allMonthKeys = [...new Set(vods.map((v: any) => v.date.substring(0, 7)))];
  allMonthKeys.forEach(mk => {
    const monthVods = vods.filter((v: any) => v.date.startsWith(mk));
    monthTop5[mk] = [...monthVods].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  });

  const sortedMonths = Object.keys(monthMap).sort();

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;}
        body{font-family:'Pretendard',sans-serif;transition:background 0.3s,color 0.3s;}
        a{text-decoration:none;color:inherit;}
        :root{--bg:#ffffff;--bg-section:#ffffff;--bg-deeper:#F0F0F0;--card:#ffffff;--card-border:rgba(0,0,0,0.08);--text:#1A1A1A;--text-inv:#1A1A1A;--text-muted:#888888;--text-sub:rgba(0,0,0,0.45);--accent:#EB701A;--header-bg:rgba(255,255,255,0.85);--header-border:rgba(0,0,0,0.08);--nav-text:rgba(0,0,0,0.55);--footer-bg:#1A1A1A;}
        [data-theme="dark"]{--bg:#111111;--bg-section:#1A1A1A;--bg-deeper:#0d0d0d;--card:#1e1e1e;--card-border:rgba(255,255,255,0.08);--text:#F0F0F0;--text-inv:#ffffff;--text-muted:#555555;--text-sub:rgba(255,255,255,0.4);--accent:#EB701A;--header-bg:rgba(15,15,15,0.85);--header-border:rgba(255,255,255,0.08);--nav-text:rgba(255,255,255,0.55);--footer-bg:#080808;}
        body{background:var(--bg);color:var(--text);}
        .sec-main{background:var(--bg-section);transition:background 0.3s;}
        .sec-footer{background:var(--footer-bg);transition:background 0.3s;}
        .card{background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--card-border);transition:transform 0.2s,box-shadow 0.2s,background 0.3s;}
        .card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,0.12);}
        .notice-card{display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--card);border-radius:14px;border:1px solid var(--card-border);text-decoration:none;transition:transform 0.15s,box-shadow 0.15s;color:inherit;}
        .notice-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);}
        .site-header{background:var(--header-bg);border-bottom:1px solid var(--header-border);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);transition:background 0.3s,border-color 0.3s;}
        .sec-title{color:var(--text-inv);transition:color 0.3s;}
        .sec-sub-text{color:var(--text-sub);transition:color 0.3s;}
        .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;}
        .eyebrow::before{content:'';display:block;width:24px;height:2px;background:var(--accent);border-radius:2px;}
        .section-title{font-size:clamp(1.8rem,3vw,2.4rem);font-weight:900;letter-spacing:-0.04em;line-height:1.1;}
        .fade-in-up{opacity:0;transform:translateY(32px);transition:opacity 0.65s cubic-bezier(0.22,1,0.36,1),transform 0.65s cubic-bezier(0.22,1,0.36,1);}
        .fade-in-up.visible{opacity:1;transform:translateY(0);}
        .logo-text{color:var(--text-inv);transition:color 0.3s;}
        .nav-link{color:var(--nav-text);transition:color 0.3s;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
      `}</style>
      <ScrollObserver />
      <header className="site-header" style={{position:'sticky',top:0,zIndex:200,height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 clamp(1.5rem,4vw,3rem)',boxShadow:'0 1px 20px rgba(0,0,0,0.08)'}}>
        <div className="logo-text" style={{fontSize:'1.1rem',fontWeight:900,letterSpacing:'-0.03em'}}>SMEB<span style={{color:'#EB701A'}}>.</span></div>
        <nav style={{display:'flex',gap:'1.2rem',alignItems:'center'}}>
          <a href="#top3" className="nav-link" style={{fontSize:'0.8rem',fontWeight:500}}>BEST 10</a>
          <a href="#videos" className="nav-link" style={{fontSize:'0.8rem',fontWeight:500}}>유튜브</a>
          <a href="#soopcal" className="nav-link" style={{fontSize:'0.8rem',fontWeight:500}}>다시보기</a>
          <ThemeToggle />
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{background:'linear-gradient(135deg,#EB701A,#ff8c3a)',color:'#fff',padding:'0.4rem 1.1rem',borderRadius:'100px',fontSize:'0.78rem',fontWeight:700,boxShadow:'0 4px 14px rgba(235,112,26,0.35)'}}>YouTube ↗</a>
          <a href="https://cafe.naver.com/smebsmeb" target="_blank" style={{background:'linear-gradient(135deg,#03C75A,#02b351)',color:'#fff',padding:'0.4rem 1.1rem',borderRadius:'100px',fontSize:'0.78rem',fontWeight:700,boxShadow:'0 4px 14px rgba(3,199,90,0.35)'}}>판카페 ↗</a>
        </nav>
      </header>
      <section className="sec-main" style={{padding:'clamp(60px,10vw,120px) clamp(1.5rem,5vw,3rem)',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:'linear-gradient(rgba(235,112,26,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(235,112,26,0.06) 1px, transparent 1px)',backgroundSize:'40px 40px'}} />
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'800px',height:'400px',background:'radial-gradient(ellipse, rgba(235,112,26,0.12) 0%, transparent 65%)',pointerEvents:'none'}} />
        <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(to right, transparent 0%, #EB701A 40%, #ff8c3a 60%, transparent 100%)'}} />
        <div className="fade-in-up" style={{position:'relative',zIndex:1}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(235,112,26,0.08)',border:'1px solid rgba(235,112,26,0.2)',backdropFilter:'blur(12px)',color:'#EB701A',fontSize:'0.72rem',fontWeight:700,padding:'0.4rem 1rem',borderRadius:'100px',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'1.5rem'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#EB701A',display:'inline-block',animation:'pulse 2s infinite'}} />
            SOOP 스트리머 · 팬 아카이브
          </div>
          <h1 className="sec-title" style={{fontSize:'clamp(3rem,7vw,5.5rem)',fontWeight:900,letterSpacing:'-0.05em',lineHeight:1,marginBottom:'1.2rem'}}>
            <span style={{color:'#EB701A'}}>SMEB</span>{' '}
            <span style={{position:'relative',display:'inline-block'}}>
              ARCHIVE
              <span style={{position:'absolute',bottom:'-4px',left:0,right:0,height:'3px',background:'linear-gradient(to right, #EB701A, transparent)',borderRadius:'2px'}} />
            </span>
          </h1>
          <p className="sec-sub-text" style={{fontSize:'1rem',marginBottom:'2rem'}}>전 프로게이머 스맵 송경호의 유튜브 · SOOP 다시보기</p>
        </div>
      </section>
      <section id="top3" className="sec-main" style={{padding:'0 clamp(1.5rem,5vw,3rem) 0'}}>
        <div style={{maxWidth:'1400px',margin:'0 auto',paddingBottom:'40px'}} className="fade-in-up">
          <div className="eyebrow">월별 BEST</div>
          <h2 className="section-title sec-title" style={{marginBottom:'28px'}}>유튜브 TOP 10</h2>
          <YoutubeSection videos={thisMonthVideos} top10={top10} notices={notices} monthlyTop10={monthlyTop10} today={today.toISOString()} />
        </div>
      </section>
      <section id="soopcal" className="sec-main" style={{padding:'40px clamp(1.5rem,5vw,3rem) 60px',position:'relative'}}>
        <div style={{position:'absolute',bottom:'10%',right:'5%',width:'500px',height:'400px',background:'radial-gradient(ellipse,rgba(235,112,26,0.06) 0%,transparent 70%)',pointerEvents:'none'}} />
        <div style={{maxWidth:'1600px',margin:'0 auto',position:'relative',zIndex:1}} className="fade-in-up">
          <div className="eyebrow">SOOP 다시보기</div>
          <h2 className="section-title sec-title" style={{marginBottom:'40px'}}>다시보기 캘린더</h2>
          <CalendarSection
            sortedMonths={sortedMonths}
            monthMap={monthMap}
            monthTop5={monthTop5}
            today={today.toISOString()}
          />
        </div>
      </section>
      <footer className="sec-footer" style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'2.5rem clamp(1.5rem,5vw,3rem)',textAlign:'center'}}>
        <p style={{fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em',color:'#fff',marginBottom:'10px'}}>SMEB<span style={{color:'#EB701A'}}>.</span></p>
        <p style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.3)',marginBottom:'14px'}}>롤 전 프로게이머 스맵 송경호 · {today.getFullYear()}년 {today.getMonth()+1}월</p>
        <div style={{display:'flex',gap:'1.5rem',justifyContent:'center'}}>
          <a href="https://www.youtube.com/@smeb2774/videos" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>YouTube ↗</a>
          <a href="https://www.sooplive.com/station/townboy" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>SOOP 방송국 ↗</a>
          <a href="https://cafe.naver.com/smebsmeb" target="_blank" style={{fontSize:'0.82rem',color:'#EB701A',fontWeight:600}}>팬카페 ↗</a>
        </div>
      </footer>
    </>
  );
}
