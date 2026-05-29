'use client';
import { useEffect } from 'react';

export default function ScrollObserver() {
  useEffect(() => {
    const elements = document.querySelectorAll('.fade-in-up');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    );

    elements.forEach(el => {
      // 이미 화면에 보이는 요소는 즉시 처리
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('visible');
      } else {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  return null;
}