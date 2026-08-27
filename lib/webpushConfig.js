// VAPID 환경 변수 없을 시 안전한 공개키/비밀키 기본값 보장
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEWPpg1t7gyxj6n_Lk7KQbE6_8rAeXOsLidK5gOKe9RuPl_fFdrd_lwxSqUFCcXk0mta-INkVPCbxHNg9kYYUfQ';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'nn63C8kehXlEmG306fZIDk5QnBS5mwj0zRXyiqbOqzs';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@poommath.com';
