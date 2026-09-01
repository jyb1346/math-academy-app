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
  } else if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' || process.env.VERCEL_GIT_COMMIT_REF === 'dev') {
    return { url: TEST_URL, key: TEST_ANON_KEY };
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || PROD_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PROD_ANON_KEY,
  };
}

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);
