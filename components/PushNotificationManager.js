'use client';

import { useState, useEffect } from 'react';
import { VAPID_PUBLIC_KEY } from '@/lib/webpushConfig';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager({ user }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // 📲 홈 화면 바로가기 설치 상태
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 이미 앱(홈 화면 추가 상태)으로 실행 중인지 확인
      const isApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      setIsStandalone(Boolean(isApp));

      // 안드로이드 / 크롬 PWA 설치 이벤트 감지
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
      });

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true);
        checkExistingSubscription();
      }
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setIsSubscribed(true);
      }
    } catch (e) {
      console.warn('Subscription check error:', e);
    }
  };

  const handleSubscribe = async () => {
    if (!isSupported) {
      alert('현재 브라우저에서는 웹 푸시 알림을 지원하지 않습니다. (아이폰은 Safari에서 \'홈 화면에 추가\' 후 이용해 주세요)');
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해 주세요.');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 서버에 구독 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          userId: user?.id || null,
        }),
      });

      setIsSubscribed(true);
      alert('🔔 품수학 학원 실시간 알림이 활성화되었습니다! [내 폰으로 테스트 알림] 버튼을 눌러 테스트해 보세요.');
    } catch (err) {
      console.error(err);
      alert('알림 활성화 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 내 핸드폰으로 즉시 테스트 알림 발송
  const handleSendTestPush = async () => {
    if (!user?.id) return alert('로그인 사용자 정보가 없습니다.');
    setTestSending(true);

    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [user.id],
          title: '🔔 [품수학] 알림 테스트',
          message: `${user.name}님, 핸드폰 실시간 알림이 완벽하게 연결되었습니다! 🎯`,
          url: '/',
        }),
      });

      const data = await res.json();
      if (data.count === 0) {
        alert('발송 대상 기기를 찾지 못했습니다. [알림 다시 켜기] 버튼을 눌러 디바이스를 재등록해 주세요.');
      } else {
        alert('📲 핸드폰으로 테스트 알림을 발송했습니다! 화면 상단 배너를 확인해 보세요.');
      }
    } catch (err) {
      alert('테스트 발송 실패: ' + err.message);
    } finally {
      setTestSending(false);
    }
  };

  // 📲 홈 화면 바로가기 설치 버튼 클릭 핸들러
  const handleInstallApp = async () => {
    if (deferredPrompt) {
      // 안드로이드 / 크롬
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // 아이폰(iOS) 안내 모달 열기
      setShowIosGuide(true);
    }
  };

  return (
    <div className="space-y-2">
      {/* 1. 홈 화면 바로가기 추가 안내 배너 (홈 화면에 아직 추가 안 된 경우 표시) */}
      {!isStandalone && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <div className="flex items-center gap-3">
            <img src="/apple-touch-icon.png" alt="품수학 아이콘" className="w-8 h-8 rounded-xl bg-white p-0.5 shadow-sm" />
            <div>
              <span className="font-extrabold text-amber-300 block">
                📲 핸드폰 홈 화면에 품수학 앱을 추가해 보세요!
              </span>
              <span className="text-[11px] text-slate-300">
                인터넷 주소창 없이 진짜 앱처럼 켜지고 알림도 더 빠르고 안정적으로 울립니다.
              </span>
            </div>
          </div>

          <button
            onClick={handleInstallApp}
            className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-xl shadow-xs transition whitespace-nowrap"
          >
            + 홈 화면에 바로가기 추가
          </button>
        </div>
      )}

      {/* 2. 실시간 푸시 알림 제어 배너 */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-5 py-3.5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 text-xs animate-in fade-in">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔔</span>
          <div>
            <span className="font-extrabold block">
              {isSubscribed ? '✅ 실시간 알림이 켜져 있습니다.' : '새 공지 및 1:1 질문 답변이 올라오면 핸드폰으로 바로 알림을 받아보세요!'}
            </span>
            <span className="text-[11px] text-blue-100 font-medium">
              {isSubscribed ? '공지 및 1:1 질문 등록 시 핸드폰 상단으로 즉시 알림이 울립니다.' : '알림을 켜두시면 학원 소식을 놓치지 않고 확인할 수 있습니다.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSubscribed && (
            <button
              onClick={handleSendTestPush}
              disabled={testSending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold px-3.5 py-1.5 rounded-xl shadow-xs transition whitespace-nowrap disabled:bg-slate-400"
            >
              {testSending ? '발송 중...' : '📲 내 폰으로 테스트 알림'}
            </button>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-white text-indigo-900 font-black px-4 py-1.5 rounded-xl hover:bg-indigo-50 transition shadow-sm whitespace-nowrap disabled:bg-slate-300"
          >
            {loading ? '설정 중...' : (isSubscribed ? '🔄 알림 재등록' : '알림 켜기 ↗')}
          </button>
        </div>
      </div>

      {/* 🔍 아이폰 홈 화면 추가 3초 안내 모달 */}
      {showIosGuide && (
        <div
          onClick={() => setShowIosGuide(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <img src="/apple-touch-icon.png" alt="품수학" className="w-10 h-10 rounded-2xl shadow-sm" />
              <div>
                <h3 className="text-base font-black text-slate-900">아이폰 홈 화면 추가 방법</h3>
                <p className="text-[11px] text-slate-400 font-bold">딱 3초면 바탕화면에 앱이 생성됩니다!</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">1</span>
                <span>사파리 화면 맨 밑에 있는 <b>[공유 버튼]</b> (네모에서 위로 솟은 화살표 모양 ⎋)을 누릅니다.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">2</span>
                <span>메뉴를 아래로 살짝 올려 <b>[➕ 홈 화면에 추가]</b>를 누릅니다.</span>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">3</span>
                <span>우측 상단의 <b>[추가]</b>를 누르면 바탕화면에 <b>품수학</b> 앱 아이콘이 바로 생깁니다! 🎉</span>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-xs shadow-md transition"
            >
              확인했습니다 닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
