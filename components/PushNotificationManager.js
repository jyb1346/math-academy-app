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

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkExistingSubscription();
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
      alert('🔔 품수학 학원 실시간 알림이 활성화되었습니다! 아래 \'내 폰으로 테스트 알림\' 버튼을 눌러 테스트해 보세요.');
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
          title: '🔔 [품수학 학원] 알림 테스트',
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

  if (!isSupported) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-5 py-3.5 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-3 text-xs animate-in fade-in">
      <div className="flex items-center gap-2.5">
        <span className="text-xl">🔔</span>
        <div>
          <span className="font-extrabold block">
            {isSubscribed ? '✅ 실시간 알림이 켜져 있습니다.' : '새 공지 및 1:1 질문 답변이 올라오면 핸드폰으로 바로 알림을 받아보세요!'}
          </span>
          <span className="text-[11px] text-blue-100 font-medium">
            {isSubscribed ? '공지 및 1:1 질문 등록 시 핸드폰 상단으로 즉시 알림이 울립니다.' : '아이폰(iOS) 사용자는 사파리에서 [홈 화면에 추가] 후 알림을 켜주세요.'}
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
  );
}
