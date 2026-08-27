'use client';

import { useEffect, useState } from 'react';

export default function KakaoInAppHandler() {
  const [isKakaoIos, setIsKakaoIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent || '';
    const isKakao = userAgent.includes('KAKAOTALK');

    if (isKakao) {
      const isAndroid = /Android/i.test(userAgent);
      const isIos = /iPhone|iPad|iPod/i.test(userAgent);

      if (isAndroid) {
        // 🚀 안드로이드: 크롬 브라우저로 자동 탈출 (1초 설치 가능 브라우저로 전환)
        const targetUrl = location.href.replace(/https?:\/\//i, '');
        location.href = `intent://${targetUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      } else if (isIos) {
        // 🍎 아이폰: 사파리 외부 브라우저 열기 안내 팝업 노출
        setIsKakaoIos(true);
      }
    }
  }, []);

  if (!isKakaoIos) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-400 text-slate-900 px-4 py-3 shadow-lg flex items-center justify-between text-xs font-bold animate-in slide-in-from-top">
      <div className="flex items-center gap-2">
        <span className="text-base">🧭</span>
        <span>
          카카오톡 내에서는 앱 바로가기 추가가 제한됩니다. 우측 하단 <b>[⋮]</b>을 눌러 <b>[Safari로 열기]</b>를 선택해 주세요!
        </span>
      </div>
      <button
        onClick={() => setIsKakaoIos(false)}
        className="text-slate-700 hover:text-black font-black px-2 py-1 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
