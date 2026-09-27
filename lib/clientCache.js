/**
 * ⚡ 앱 전역 초고속 인메모리 & 세션 캐시 매니저 (SWR 패턴 지원)
 * 한 번 불러온 데이터를 0초 만에 즉시 띄우고, 백그라운드에서 최신 데이터를 갱신합니다.
 */

const memoryCache = new Map();

export function getClientCache(key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`pum_cache_${key}`);
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
      sessionStorage.setItem(`pum_cache_${key}`, JSON.stringify(data));
    } catch (e) {}
  }
}

export function invalidateClientCache(key) {
  if (key) {
    memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`pum_cache_${key}`);
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
      } catch (e) {}
    }
  }
}
