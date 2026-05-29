import { NextResponse } from 'next/server';

const BJID = process.env.SOOP_BJID;
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
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
      cache: 'no-store',
    });

    const data = await res.json();
    const notices = (data.notice_data || []).slice(0, 3).map((n: any) => ({
      id: n.title_no,
      title: n.title_name,
      summary: n.content?.summary || '',
      date: n.reg_date?.split(' ')[0] || '',
      likes: n.count?.like_cnt || 0,
      comments: n.count?.comment_cnt || 0,
      url: `https://www.sooplive.com/station/${BJID}/post/${n.title_no}`,
    }));

    return NextResponse.json({ notices });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}