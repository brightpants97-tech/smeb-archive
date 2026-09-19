'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';

interface IssueImage {
  dataUrl: string;
  size: 'auto' | 'large' | 'medium' | 'small';
  scale?: number;
  position?: string;
  fit?: 'cover' | 'contain';
  caption?: string;
}

const SIZE_LABEL: Record<IssueImage['size'], string> = {
  auto: '자동 (장수에 맞춰)',
  large: '크게',
  medium: '중간',
  small: '작게',
};

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'top left', label: '↖ 좌상단' },
  { value: 'top', label: '↑ 상단' },
  { value: 'top right', label: '↗ 우상단' },
  { value: 'left', label: '← 좌측' },
  { value: 'center', label: '● 중앙' },
  { value: 'right', label: '→ 우측' },
  { value: 'bottom left', label: '↙ 좌하단' },
  { value: 'bottom', label: '↓ 하단' },
  { value: 'bottom right', label: '↘ 우하단' },
];

function compressImage(file: File, maxWidth = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 컨텍스트를 만들 수 없어요.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

export default function IssuesAdminClient() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [images, setImages] = useState<IssueImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('fc_admin_pw');
    if (saved) {
      setPassword(saved);
      verify(saved);
    }
  }, []);

  const verify = async (pw: string) => {
    setChecking(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/fconline/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || '로그인에 실패했어요.');
        sessionStorage.removeItem('fc_admin_pw');
      } else {
        setAuthed(true);
        sessionStorage.setItem('fc_admin_pw', pw);
        loadImages();
      }
    } catch {
      setAuthError('로그인 중 문제가 생겼어요.');
    } finally {
      setChecking(false);
    }
  };

  const loadImages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site/issues');
      const data = await res.json();
      setImages(data.images || []);
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = 3 - images.length;
    if (remaining <= 0) {
      setError('이미지는 최대 3장까지 등록할 수 있어요. 먼저 삭제해주세요.');
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    try {
      const compressed = await Promise.all(toAdd.map(f => compressImage(f)));
      setImages(prev => [...prev, ...compressed.map(dataUrl => ({ dataUrl, size: 'auto' as const, scale: 100, position: 'center', fit: 'cover' as const }))]);
    } catch (e: any) {
      setError(e?.message || '이미지 처리 중 문제가 생겼어요.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const setSize = (idx: number, size: IssueImage['size']) => {
    setImages(prev => prev.map((img, i) => (i === idx ? { ...img, size } : img)));
  };

  const setScale = (idx: number, scale: number) => {
    setImages(prev => prev.map((img, i) => (i === idx ? { ...img, scale } : img)));
  };

  const setPosition = (idx: number, position: string) => {
    setImages(prev => prev.map((img, i) => (i === idx ? { ...img, position } : img)));
  };

  const setFit = (idx: number, fit: IssueImage['fit']) => {
    setImages(prev => prev.map((img, i) => (i === idx ? { ...img, fit } : img)));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/site/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '저장에 실패했어요.');
      } else {
        setSaveMsg('저장했어요! 메인페이지에 반영됐어요.');
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch {
      setError('저장 중 문제가 생겼어요.');
    } finally {
      setSaving(false);
    }
  };

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
        <div style={{ width: '320px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: ORANGE, marginBottom: '8px' }}>ADMIN</p>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '20px', color: '#111' }}>최근 이슈 관리 로그인</h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verify(password); }}
            placeholder="비밀번호"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px',
              border: '1px solid #ddd', fontSize: '0.9rem', marginBottom: '10px',
              outline: 'none', boxSizing: 'border-box' as const,
            }}
          />
          {authError && <p style={{ color: '#e05252', fontSize: '0.8rem', marginBottom: '10px' }}>{authError}</p>}
          <button
            onClick={() => verify(password)}
            disabled={checking || !password}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: ORANGE, color: '#fff', fontWeight: 700, cursor: 'pointer',
              opacity: checking || !password ? 0.6 : 1,
            }}
          >{checking ? '확인 중...' : '로그인'}</button>
          <Link href="/" style={{ display: 'block', marginTop: '16px', fontSize: '0.8rem', color: '#999', textAlign: 'center' as const }}>← 메인으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#fff', padding: 'clamp(32px,6vw,64px) clamp(1.5rem,6vw,5rem)', fontFamily: "'Pretendard', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: '0.8rem', color: '#999', textDecoration: 'none' }}>← 메인으로</Link>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '10px 0 6px', color: '#111' }}>최근 이슈 관리</h1>
        <p style={{ fontSize: '0.82rem', color: '#999', marginBottom: '24px' }}>
          메인페이지 [최근 이슈] 섹션에 표시할 이미지를 최대 3장까지 등록해요.
          1장이면 크게, 2장이면 중간, 3장이면 작게 자동으로 배치되고, 이미지별로 기본 크기·스케일(50~150%)·순서를 직접 조절할 수 있어요.
          "전체 보기"를 선택하면 잘리는 부분 없이 사진 전체가 여백과 함께 보여요.
        </p>

        {loading ? (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>불러오는 중...</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '20px' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '14px', padding: '14px', borderRadius: '12px', border: '1px solid #eee' }}>
                  <div style={{
                    width: '110px', height: '78px', borderRadius: '8px', flexShrink: 0, border: '1px solid #eee', overflow: 'hidden',
                    background: img.fit === 'contain' ? '#f5f5f5' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={img.dataUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: img.fit === 'contain' ? 'contain' : 'cover', objectPosition: img.position || 'center' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '10px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#999' }}>기본 크기</label>
                        <select
                          value={img.size}
                          onChange={e => setSize(idx, e.target.value as IssueImage['size'])}
                          style={{ padding: '7px 9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.82rem' }}
                        >
                          {(Object.keys(SIZE_LABEL) as IssueImage['size'][]).map(s => (
                            <option key={s} value={s}>{SIZE_LABEL[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#999' }}>표시 방식</label>
                        <select
                          value={img.fit === 'contain' ? 'contain' : 'cover'}
                          onChange={e => setFit(idx, e.target.value as IssueImage['fit'])}
                          style={{ padding: '7px 9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.82rem' }}
                        >
                          <option value="cover">꽉 채우기(크롭)</option>
                          <option value="contain">전체 보기(레터박스)</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px', opacity: img.fit === 'contain' ? 0.4 : 1 }}>
                        <label style={{ fontSize: '0.72rem', color: '#999' }}>사진 속 위치(크롭)</label>
                        <select
                          value={img.position || 'center'}
                          onChange={e => setPosition(idx, e.target.value)}
                          disabled={img.fit === 'contain'}
                          style={{ padding: '7px 9px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.82rem' }}
                        >
                          {POSITION_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                        <label style={{ fontSize: '0.72rem', color: '#999' }}>순서</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => moveImage(idx, -1)} disabled={idx === 0} style={{
                            padding: '7px 10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff',
                            fontSize: '0.82rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.4 : 1,
                          }}>◀</button>
                          <button onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} style={{
                            padding: '7px 10px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff',
                            fontSize: '0.82rem', cursor: idx === images.length - 1 ? 'default' : 'pointer', opacity: idx === images.length - 1 ? 0.4 : 1,
                          }}>▶</button>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#999', flexShrink: 0 }}>스케일 {img.scale ?? 100}%</label>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={5}
                        value={img.scale ?? 100}
                        onChange={e => setScale(idx, Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => removeImage(idx)} style={{
                        padding: '6px 12px', borderRadius: '8px', border: '1px solid #f0c0c0',
                        background: '#fff5f5', color: '#e05252', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                      }}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <p style={{ color: '#999', fontSize: '0.85rem' }}>등록된 이미지가 없어요.</p>
              )}
            </div>

            {images.length < 3 && (
              <div style={{ marginBottom: '20px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => handleFiles(e.target.files)}
                  style={{ fontSize: '0.85rem' }}
                />
                <p style={{ fontSize: '0.72rem', color: '#bbb', marginTop: '6px' }}>{3 - images.length}장 더 등록할 수 있어요.</p>
              </div>
            )}

            {error && <p style={{ color: '#e05252', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</p>}
            {saveMsg && <p style={{ color: '#2FAE6B', fontSize: '0.82rem', marginBottom: '12px', fontWeight: 700 }}>{saveMsg}</p>}

            <button onClick={save} disabled={saving} style={{
              padding: '12px 24px', borderRadius: '10px', border: 'none',
              background: ORANGE, color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>{saving ? '저장 중...' : '저장하기'}</button>
          </>
        )}
      </div>
    </main>
  );
}
