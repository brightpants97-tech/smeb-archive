export interface ShareOpponent {
  nickname: string;
  displayName: string;
  win: number;
  draw: number;
  lose: number;
}

export function summarizeRecords(opponents: ShareOpponent[]) {
  const counts = opponents.reduce((sum, o) => ({
    win: sum.win + o.win, draw: sum.draw + o.draw, lose: sum.lose + o.lose,
  }), { win: 0, draw: 0, lose: 0 });
  const total = counts.win + counts.draw + counts.lose;
  return { ...counts, total, winRate: total ? Math.round(counts.win / total * 100) : 0 };
}

// Draw text and shapes locally so third-party profile images cannot taint the PNG canvas.
export async function createRecordImage(opponents: ShareOpponent[]) {
  if (!opponents.length) throw new Error('스트리머를 한 명 이상 선택해주세요.');
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const columns = opponents.length <= 3 ? 1 : 2;
  const rows = Math.ceil(opponents.length / columns);
  canvas.width = 1080;
  canvas.height = 456 + rows * 168 + 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지를 만들 수 없어요.');
  const blue = '#2F6FED', red = '#D94C4C', gray = '#697586', ink = '#172338';
  const font = '"Paperlogy", "Malgun Gothic", sans-serif';
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 700) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 20) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  };
  const fitName = (value: string, width: number) => {
    ctx.font = `800 28px ${font}`;
    if (ctx.measureText(value).width <= width) return value;
    const chars = Array.from(value);
    while (chars.length && ctx.measureText(chars.join('') + '…').width > width) chars.pop();
    return chars.join('') + '…';
  };
  const summary = summarizeRecords(opponents);
  ctx.fillStyle = '#F4F6FA';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  box(0, 0, 1080, 10, '#EB701A', 0);
  text('SMEB ARCHIVE  /  FC ONLINE', 56, 70, 22, '#C35B10', 800);
  text('스맵 상대전적 모아보기', 56, 136, 46, ink, 900);
  text(`선택한 스트리머 ${opponents.length}명 · 총 ${summary.total}경기`, 56, 182, 25, gray);
  box(56, 218, 968, 132, '#FFFFFF');
  const stats = [
    { value: `${summary.win}승`, label: '승리', color: blue },
    { value: `${summary.draw}무`, label: '무승부', color: gray },
    { value: `${summary.lose}패`, label: '패배', color: red },
    { value: `${summary.winRate}%`, label: '합산 승률', color: ink },
  ];
  stats.forEach((stat, i) => {
    text(stat.value, 88 + i * 242, 278, 37, stat.color, 900);
    text(stat.label, 88 + i * 242, 319, 21, gray, 500);
  });
  text('상대별 누적 전적', 56, 410, 26, ink, 800);
  text('승·무·패와 승률은 모두 스맵 기준', 56, 442, 20, gray, 500);
  const width = columns === 1 ? 968 : 474;
  opponents.forEach((opponent, index) => {
    const x = 56 + (index % columns) * 494;
    const y = 468 + Math.floor(index / columns) * 168;
    const s = summarizeRecords([opponent]);
    box(x, y, width, 148, '#FFFFFF');
    text(fitName(opponent.displayName || opponent.nickname, width - 165), x + 24, y + 42, 28, ink, 800);
    ctx.textAlign = 'right';
    text(`${s.total}경기`, x + width - 24, y + 42, 21, gray);
    ctx.textAlign = 'left';
    text(`${s.win}승`, x + 24, y + 88, 25, blue, 800);
    text(`${s.draw}무`, x + 122, y + 88, 25, gray, 800);
    text(`${s.lose}패`, x + 220, y + 88, 25, red, 800);
    ctx.textAlign = 'right';
    text(`${s.winRate}%`, x + width - 24, y + 88, 25, ink, 800);
    ctx.textAlign = 'left';
    const barWidth = width - 48;
    box(x + 24, y + 114, barWidth, 9, '#E8EDF4', 4);
    if (s.total) {
      let offset = x + 24;
      for (const [count, color] of [[s.win, blue], [s.draw, '#A6AFBD'], [s.lose, red]] as const) {
        const w = barWidth * count / s.total;
        if (w) box(offset, y + 114, w, 9, color, 0);
        offset += w;
      }
    }
  });
  const generatedAt = new Date();
  const dateLabel = generatedAt.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  text('2026.08.10 이후 누적 전적 · 페이지에서 조회한 데이터 기준', 56, canvas.height - 74, 20, gray, 500);
  text(`이미지 생성 ${dateLabel} KST`, 56, canvas.height - 39, 18, gray, 500);
  ctx.textAlign = 'right';
  text('smebarchive.xyz/fc-record', 1024, canvas.height - 39, 20, '#C35B10', 700);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 생성에 실패했어요. 다시 시도해주세요.')), 'image/png');
  });
  const date = generatedAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return { blob, filename: `스맵-상대전적-${opponents.length}명-${date}.png` };
}
