'use client';

import { useEffect, useRef, useState } from 'react';
import { createRecordImage, summarizeRecords, type ShareOpponent } from './record-image';

interface Preview { url: string; file: File; canShare: boolean }

export default function RecordShareDialog({ opponents, onClose }: { opponents: ShareOpponent[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const selectedOpponents = opponents.filter(o => selected.has(o.nickname));
  const visible = opponents.filter(o => `${o.displayName} ${o.nickname}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const summary = summarizeRecords(selectedOpponents);

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { mounted.current = false; document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const { blob, filename } = await createRecordImage(selectedOpponents);
      if (!mounted.current) return;
      const file = new File([blob], filename, { type: 'image/png' });
      const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      setPreview({ url: URL.createObjectURL(blob), file, canShare });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '이미지를 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const share = async () => {
    if (!preview) return;
    setError('');
    setSharing(true);
    try {
      await navigator.share({ files: [preview.file], title: '스맵 FC 온라인 상대전적' });
    } catch (e) {
      if (mounted.current && !(e instanceof Error && e.name === 'AbortError')) setError('공유 창을 열지 못했어요. PNG로 저장한 뒤 첨부해주세요.');
    } finally {
      if (mounted.current) setSharing(false);
    }
  };

  return (
    <dialog ref={dialog} className="record-share-dialog" aria-labelledby="record-share-title" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        .record-share-dialog { width: min(680px, calc(100% - 24px)); max-height: 90dvh; padding: 0; margin: auto; border: 0; border-radius: 20px; color: #172338; background: #fff; font-family: 'Paperlogy', sans-serif; box-shadow: 0 24px 80px #17233840; }
        .record-share-dialog::backdrop { background: #17233899; }
        .record-share-dialog button, .record-share-dialog a, .record-share-dialog input { font: inherit; }
        .record-share-dialog button, .record-share-dialog a { cursor: pointer; }
        .record-share-dialog button:disabled { opacity: .5; cursor: not-allowed; }
        .record-share-dialog :focus-visible { outline: 3px solid #2F6FED; outline-offset: 3px; }
        .record-share-inner { padding: 24px; }
        .record-share-action { display: inline-flex; align-items: center; justify-content: center; padding: 12px 16px; border: 1px solid #dbe1ea; border-radius: 10px; background: #fff; color: #172338; text-decoration: none; font-weight: 800 !important; font-size: .85rem !important; }
        .record-share-primary { background: #EB701A; color: #fff; border-color: #EB701A; }
        .record-share-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 310px; overflow-y: auto; padding: 4px; margin: 12px -4px; }
        .record-share-option { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid #e0e5ee; border-radius: 10px; cursor: pointer; min-width: 0; }
        .record-share-option:has(input:checked) { border-color: #EB701A; background: #fff5eb; }
        .record-share-footer { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
        @media(max-width: 480px) { .record-share-inner { padding: 18px; } .record-share-options { grid-template-columns: 1fr; max-height: 34dvh; } .record-share-footer > * { flex: 1; } }
      `}</style>
      <div className="record-share-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 id="record-share-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>전적 이미지 만들기</h2>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ border: 0, background: '#f3f5f8', borderRadius: 8, width: 36, height: 36, flexShrink: 0 }}>✕</button>
        </div>
        <p style={{ color: '#606d80', fontSize: '.8rem', lineHeight: 1.7, margin: '10px 0 18px' }}>
          원하는 상대의 누적 전적을 한 장에 담아보세요. 승·무·패와 승률은 모두 스맵 기준이에요.
        </p>
        {preview ? (
          <>
            <div style={{ padding: 10, borderRadius: 12, background: '#eef1f6', maxHeight: '52dvh', overflowY: 'auto' }}>
              {/* PNG is generated locally; a regular img preserves the blob URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={`선택한 ${selectedOpponents.length}명의 상대전적 공유 이미지. ${summary.win}승 ${summary.draw}무 ${summary.lose}패, 승률 ${summary.winRate}%`} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6 }} />
            </div>
            <div className="record-share-footer">
              <button type="button" className="record-share-action" disabled={sharing} onClick={() => { setPreview(null); setError(''); }}>선택 수정</button>
              <a className="record-share-action record-share-primary" href={preview.url} download={preview.file.name}>PNG 저장</a>
              {preview.canShare && <button type="button" className="record-share-action" disabled={sharing} onClick={share}>{sharing ? '공유 중…' : '이미지 공유'}</button>}
            </div>
            <p style={{ color: '#606d80', fontSize: '.72rem', lineHeight: 1.6 }}>저장한 이미지를 카카오톡이나 커뮤니티에 첨부할 수 있어요.</p>
          </>
        ) : (
          <>
            <label htmlFor="record-share-search" style={{ display: 'block', fontSize: '.78rem', fontWeight: 800, marginBottom: 6 }}>스트리머 찾기</label>
            <input id="record-share-search" type="search" value={query} disabled={busy} onChange={e => setQuery(e.target.value)} placeholder="이름 또는 FC 닉네임 검색" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #dbe1ea', borderRadius: 10, fontSize: '.85rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span role="status" style={{ fontSize: '.8rem', fontWeight: 800 }}>{selectedOpponents.length}명 선택</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="record-share-action" disabled={busy || !visible.length} onClick={() => setSelected(current => new Set([...current, ...visible.map(o => o.nickname)]))}>{query.trim() ? '검색 결과 선택' : '전체 선택'}</button>
                <button type="button" className="record-share-action" disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>선택 해제</button>
              </div>
            </div>
            <div className="record-share-options" role="group" aria-label="이미지에 담을 스트리머">
              {visible.map(o => (
                <label key={o.nickname} className="record-share-option">
                  <input type="checkbox" disabled={busy} checked={selected.has(o.nickname)} onChange={() => setSelected(current => {
                    const next = new Set(current);
                    if (next.has(o.nickname)) next.delete(o.nickname); else next.add(o.nickname);
                    return next;
                  })} style={{ width: 18, height: 18, accentColor: '#EB701A', flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', overflowWrap: 'anywhere', fontSize: '.85rem', fontWeight: 800 }}>{o.displayName || o.nickname}</span>
                    <span style={{ display: 'block', color: '#606d80', fontSize: '.72rem', marginTop: 5 }}>{o.win}승 {o.draw}무 {o.lose}패 · 승률 {summarizeRecords([o]).winRate}%</span>
                  </span>
                </label>
              ))}
            </div>
            {!visible.length && <p style={{ color: '#606d80', fontSize: '.85rem' }}>검색 결과가 없어요. 다른 이름으로 검색해주세요.</p>}
            <div style={{ padding: 14, borderRadius: 10, background: '#f3f6fb', fontSize: '.82rem', lineHeight: 1.8 }}>
              선택 합계 <strong>{summary.total}경기 · {summary.win}승 {summary.draw}무 {summary.lose}패 · 승률 {summary.winRate}%</strong>
              <div style={{ fontSize: '.72rem', color: '#606d80' }}>2026년 8월 10일 이후 누적 전적</div>
            </div>
            <div className="record-share-footer">
              <button type="button" className="record-share-action record-share-primary" disabled={!selectedOpponents.length || busy} onClick={generate} style={{ width: '100%' }}>{busy ? '이미지 만드는 중…' : `${selectedOpponents.length}명 전적 이미지 만들기`}</button>
            </div>
          </>
        )}
        {error && <p role="alert" style={{ color: '#b72f35', fontSize: '.82rem', lineHeight: 1.6 }}>{error}</p>}
      </div>
    </dialog>
  );
}
