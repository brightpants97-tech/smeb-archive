'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const ORANGE = '#EB701A';

interface IssueImage {
  dataUrl: string;
  size: 'auto' | 'large' | 'medium' | 'small';
  caption?: string;
}

const SIZE_LABEL: Record<IssueImage['size'], string> = {
  auto: '자동 (장수에 맞춰)',
  large: '크게',
  medium: '중간',
  small: '작게',
};

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
      setImages(prev => [...prev, ...compressed.map(dataUrl => ({ dataUrl, size: 'auto' as const }))]);
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
          1장이면 크게, 2장이면 중간, 3장이면 작게 자동으로 배치되고, 이미지별로 크기를 직접 지정할 수도 있어요.
        </p>

        {loading ? (
          <p style={{ color: '#999', fontSize: '0.85rem' }}>불러오는 중...</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '20px' }}>
              {images.map((img, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #eee' }}>
                  <img src={img.dataUrl} alt="" style={{ width: '96px', height: '64px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid #eee' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
                    <label style={{ fontSize: '0.74rem', color: '#999' }}>표시 크기</label>
                    <select
                      value={img.size}
                      onChange={e => setSize(idx, e.target.value as IssueImage['size'])}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.84rem', width: 'fit-content' }}
                    >
                      {(Object.keys(SIZE_LABEL) as IssueImage['size'][]).map(s => (
                        <option key={s} value={s}>{SIZE_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => removeImage(idx)} style={{
                    padding: '8px 14px', borderRadius: '8px', border: '1px solid #f0c0c0',
                    background: '#fff5f5', color: '#e05252', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>삭제</button>
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
