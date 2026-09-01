'use client';
import { useState, useEffect } from 'react';

export default function TestServerBanner() {
  const [isTestServer, setIsTestServer] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isDev =
        hostname.includes('dev') ||
        hostname.includes('-git-') ||
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

      if (isDev) {
        setIsTestServer(true);
        if (!document.title.startsWith('[테스트]')) {
          document.title = `[테스트 서버] ${document.title}`;
        }
      }
    }
  }, []);

  if (!isTestServer) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white text-xs font-black py-1.5 px-4 text-center shadow-xs sticky top-0 z-50 flex items-center justify-center gap-2 tracking-wide">
      <span className="bg-white text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse shadow-xs">
        TEST SERVER
      </span>
      <span>🧪 [품수학 테스트 서버] 신규 기능 사전 검증 모드입니다.</span>
    </div>
  );
}
