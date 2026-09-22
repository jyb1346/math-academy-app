import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://wsazsslkilcxvotiufoj.supabase.co';
const PROD_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_GuHOF4Jv4vl7RHqrHN50Zw_11HqO7bI';

const TEST_URL = 'https://phjlxdsnfqfkoiweirhs.supabase.co';
const TEST_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoamx4ZHNuZnFma29pd2VpcmhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzM3OTIsImV4cCI6MjEwMzgwOTc5Mn0.9xlqhS6QQcEBpkxbi7TR-M_oOTSmIfjp653FsrRAFhM';

function getSupabaseConfig() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isDev =
      hostname.includes('dev') ||
      hostname.includes('-git-') ||
      hostname.includes('localhost') ||
      hostname.includes('127.0.0.1') ||
      process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';

    if (isDev) {
      return { url: TEST_URL, key: TEST_ANON_KEY };
    }
  } else if (
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF === 'dev' ||
    process.env.NODE_ENV === 'development'
  ) {
    return { url: TEST_URL, key: TEST_ANON_KEY };
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || PROD_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PROD_ANON_KEY,
  };
}

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);

/**
 * 🌐 서버 사이드 API 라우트에서 요청 Origin/Host 기반으로 적절한 Supabase 클라이언트를 반환하는 헬퍼
 */
export function getSupabaseForServer(req) {
  if (req) {
    const host = req.headers.get('host') || req.headers.get('referer') || '';
    if (
      host.includes('dev') ||
      host.includes('-git-') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' ||
      process.env.VERCEL_GIT_COMMIT_REF === 'dev' ||
      process.env.NODE_ENV === 'development'
    ) {
      return createClient(TEST_URL, TEST_ANON_KEY);
    }
  }
  return supabase;
}
