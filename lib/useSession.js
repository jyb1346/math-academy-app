'use client';

import { useEffect, useState } from 'react';

/**
 * 서버 세션 쿠키를 제거하고 로컬 캐시도 지운다. 로그아웃 버튼에서 공용으로 사용.
 */
export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // 네트워크 오류가 나도 로컬 캐시는 지워서 로그인 화면으로 보낸다
  }
  try {
    localStorage.removeItem('user');
  } catch (e) {
    // ignore
  }
}

/**
 * 서버 세션(httpOnly 쿠키)을 기준으로 현재 로그인 사용자를 확인하는 훅.
 * localStorage의 'user'는 이름 등을 즉시 그려주는 화면용 캐시일 뿐이며,
 * 실제 권한 판단은 반드시 이 훅의 결과(서버가 검증한 값)를 기준으로 해야 한다.
 *
 * 반환값:
 *  - loading: 세션 확인 중
 *  - user: 로그인 사용자 정보 ({ id, name, role, ... }) 또는 null(비로그인/세션만료)
 */
export function useSession() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        return data.user || null;
      })
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        if (user) {
          try {
            localStorage.setItem('user', JSON.stringify(user));
          } catch (e) {
            // localStorage 접근 불가 환경은 무시 (화면 캐시 용도일 뿐)
          }
        } else {
          try {
            localStorage.removeItem('user');
          } catch (e) {
            // ignore
          }
        }
        setState({ loading: false, user });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
