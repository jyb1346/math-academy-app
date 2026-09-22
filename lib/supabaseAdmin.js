import { createClient } from '@supabase/supabase-js';
import { PROD_URL, TEST_URL, isTestEnvironment } from './supabase';

/**
 * ⚠️ service_role 키를 쓰는 서버 전용 클라이언트. RLS를 완전히 우회하므로
 * app/api/**\/route.js 안에서만 사용하고, 'use client' 컴포넌트에서는 절대 import 금지.
 */
export function getSupabaseAdmin(req) {
  const useTest = isTestEnvironment(req);
  const url = useTest ? TEST_URL : PROD_URL;
  const key = useTest ? process.env.SUPABASE_SERVICE_ROLE_KEY_TEST : process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      useTest
        ? 'SUPABASE_SERVICE_ROLE_KEY_TEST 환경변수가 설정되지 않았습니다.'
        : 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
