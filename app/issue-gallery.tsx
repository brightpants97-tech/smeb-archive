'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface IssueImage {
  dataUrl: string;
  size: 'auto' | 'large' | 'medium' | 'small';
  scale?: number;
  position?: string;
  fit?: 'cover' | 'contain';
  caption?: string;
}

// 1장→크게, 2장→중간, 3장→작게. 관리자가 개별 이미지에 수동으로 크기를 지정하면 그걸 우선 적용
function effectiveIssueSize(img: IssueImage, count: number): 'large' | 'medium' | 'small' {
  if (img.size && img.size !== 'auto') return img.size;
  if (count <= 1) return 'large';
  if (count === 2) return 'medium';
  return 'small';
}

// 기본 크기(large/medium/small)에 관리자가 지정한 스케일(50~150%)을 곱해 실제 폭(%)을 계산
const ISSUE_BASE_WIDTH: Record<'large' | 'medium' | 'small', number> = { large: 100, medium: 48.5, small: 31.5 };
function issueWidthPercent(img: IssueImage, count: number): number {
  const base = ISSUE_BASE_WIDTH[effectiveIssueSize(img, count)];
  const scale = (img.scale ?? 100) / 100;
  return Math.min(100, Math.max(18, base * scale));
}

export default function IssueGallery({ images }: { images: IssueImage[] }) {
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 확대 모드일 때는 배경 스크롤을 막아서 뷰포트 중앙에 그대로 고정되도록 함
  useEffect(() => {
    if (zoomIdx === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [zoomIdx]);

  if (images.length === 0) return null;
  const zoomed = zoomIdx !== null ? images[zoomIdx] : null;

  const lightbox = zoomed && (
    <div
      className="issue-lightbox"
      onClick={() => setZoomIdx(null)}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="issue-lightbox-close"
        onClick={() => setZoomIdx(null)}
        aria-label="닫기"
      >✕</button>
      <img
        src={zoomed.dataUrl}
        alt={zoomed.caption || '최근 이슈'}
        className="issue-lightbox-img"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );

  return (
    <>
      <div className="issue-grid">
        {images.map((img, idx) => (
          <button
            key={idx}
            type="button"
            className={`issue-item size-${effectiveIssueSize(img, images.length)}`}
            style={{ flex: `0 1 ${issueWidthPercent(img, images.length)}%` }}
            onClick={() => setZoomIdx(idx)}
            aria-label="이미지 확대"
          >
            <div className={`issue-item-frame${img.fit === 'contain' ? ' fit-contain' : ''}`}>
              <img
                src={img.dataUrl}
                alt={img.caption || '최근 이슈'}
                loading="lazy"
                style={{ objectFit: img.fit === 'contain' ? 'contain' : 'cover', objectPosition: img.position || 'center' }}
              />
            </div>
          </button>
        ))}
      </div>

      {mounted && zoomed && createPortal(lightbox, document.body)}
    </>
  );
}
