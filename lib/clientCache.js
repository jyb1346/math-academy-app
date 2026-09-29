/**
 * ⚡ 앱 전역 초고속 인메모리, 세션 & 로컬스토리지 캐시 매니저 (SWR 패턴 지원)
 * 브라우저를 닫고 다시 열어도 0.0초 만에 기존 과제표/데이터를 즉시 띄우고, 백그라운드에서 최신 데이터를 갱신합니다.
 */

const memoryCache = new Map();

export function getClientCache(key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  if (typeof window !== 'undefined') {
    try {
      const stored =
        sessionStorage.getItem(`pum_cache_${key}`) ||
        localStorage.getItem(`pum_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(key, parsed);
        return parsed;
      }
    } catch (e) {}
  }
  return null;
}

export function setClientCache(key, data) {
  if (!key || data === undefined) return;
  memoryCache.set(key, data);
  if (typeof window !== 'undefined') {
    try {
      const json = JSON.stringify(data);
      sessionStorage.setItem(`pum_cache_${key}`, json);
      localStorage.setItem(`pum_cache_${key}`, json);
    } catch (e) {}
  }
}

export function invalidateClientCache(key) {
  if (key) {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`pum_cache_${key}`);
        localStorage.removeItem(`pum_cache_${key}`);
      } catch (e) {}
    }
  } else {
    memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('pum_cache_')) {
            sessionStorage.removeItem(k);
          }
        });
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('pum_cache_')) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {}
    }
  }
}
