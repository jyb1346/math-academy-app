'use client';

import { useState, useEffect } from 'react';

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
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (e) {
      console.warn('Service worker registration failed:', e);
    }
  };

  const handleSubscribe = async () => {
    if (!isSupported) {
      alert('현재 브라우저에서는 웹 푸시 알림을 지원하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해 주세요.');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error('VAPID Public Key가 설정되지 않았습니다.');
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(sub);

      // 서버에 구독 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          userId: user?.id || null,
        }),
      });

      alert('🔔 품수학 학원 실시간 알림이 활성화되었습니다!');
    } catch (err) {
      console.error(err);
      alert('알림 활성화 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported || permission === 'granted') {
    return null; // 이미 허용되었거나 지원 안되면 배너 숨김
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-base">🔔</span>
        <span className="font-bold">
          새 공지 및 1:1 질문 답변이 올라오면 핸드폰으로 바로 알림을 받아보세요!
        </span>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="bg-white text-indigo-900 font-extrabold px-3.5 py-1.5 rounded-xl hover:bg-indigo-50 transition shadow-xs whitespace-nowrap"
      >
        {loading ? '설정 중...' : '알림 켜기 ↗'}
      </button>
    </div>
  );
}
