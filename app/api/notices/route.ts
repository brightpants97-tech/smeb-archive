import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID || 'townboy';
const BOARD_ID = '76988470';

export async function GET() {
  try {
    const url = `https://chapi.sooplive.com/api/${BJID}/board/${BOARD_ID}?per_page=3&start_date=&end_date=&field=title,contents,user_nick,user_id,hashtags&keyword=&type=all&order_by=reg_date&board_number=${BOARD_ID}&page=1`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': `https://www.sooplive.com/station/${BJID}/board/${BOARD_ID}`,
        'Origin': 'https://www.sooplive.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    const data = await res.json();
    const notices = (data.notice_data || []).slice(0, 3).map((n: any) => {
      const rawText = (n.content?.summary || n.title_name || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // title_name이 '공지' 같은 카테고리명이면 내용 첫 문장을 제목으로
      const isGenericTitle = !n.title_name || n.title_name === '공지' || n.title_name.length <= 2;
      const firstSentence = rawText.split(/[.!?\n]/)[0].trim().slice(0, 50);
      const title = isGenericTitle ? (firstSentence || n.title_name) : n.title_name;

      return {
        id: n.title_no,
        title,
        summary: rawText.slice(0, 120),
        date: n.reg_date?.split(' ')[0] || '',
        likes: n.count?.like_cnt || 0,
        comments: n.count?.comment_cnt || 0,
        url: `https://www.sooplive.com/station/${BJID}/post/${n.title_no}`,
      };
    });

    return NextResponse.json({ notices });
  } catch (error) {
    return NextResponse.json({ notices: [], error: String(error) });
  }
}
