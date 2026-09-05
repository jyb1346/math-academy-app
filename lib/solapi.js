import crypto from 'crypto';

const ACTIVE_API_KEY = 'NCSQAXAB7S9TSUIN';
const ACTIVE_API_SECRET = '8KBJHFRN6NV1DIVMDNOL84KWX0SDFJIS';
const ACTIVE_SENDER_NUMBER = '01027053409';
const ACTIVE_KAKAO_PFID = 'KA01PF260831093804945uPxRUYsn8qj';
const ACTIVE_KAKAO_TEMPLATE_ID = 'KA01TP260901085150042icX0U1Jrpr1';

// Vercel 환경변수에 예전 구버전 키가 남아있을 경우를 방지하여 검증 후 최신 키 적용
const envKey = process.env.SOLAPI_API_KEY;
const envSecret = process.env.SOLAPI_API_SECRET;

const API_KEY = (envKey && envKey !== 'NCSFTZAGNVNEA2L9') ? envKey : ACTIVE_API_KEY;
const API_SECRET = (envSecret && !envSecret.startsWith('TIWBN') && !envSecret.startsWith('MDAKY')) ? envSecret : ACTIVE_API_SECRET;
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || ACTIVE_SENDER_NUMBER;
const KAKAO_PFID = process.env.SOLAPI_KAKAO_PFID || ACTIVE_KAKAO_PFID;
const KAKAO_TEMPLATE_ID = process.env.SOLAPI_KAKAO_TEMPLATE_ID || ACTIVE_KAKAO_TEMPLATE_ID;

export function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', API_SECRET).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Solapi 메시지 발송 함수
 * 1차: 카카오 알림톡(ATA) 전송 시도 -> 실패 시 2차 LMS/SMS 문자로 자동 즉시 대체 발송
 */
export async function sendSolapiMessage({ to, text, title, kakaoOptions }) {
  const cleanTo = cleanPhoneNumber(to);
  if (!cleanTo || cleanTo.length < 10) {
    throw new Error('수신자 전화번호가 올바르지 않습니다.');
  }

  const cleanFrom = cleanPhoneNumber(SENDER_NUMBER);
  const pfId = kakaoOptions?.pfId || KAKAO_PFID;
  const templateId = kakaoOptions?.templateId || KAKAO_TEMPLATE_ID;

  // 1차 시도: 카카오 알림톡
  if (pfId && templateId) {
    try {
      const alimtalkPayload = {
        message: {
          to: cleanTo,
          from: cleanFrom,
          text: text,
          subject: title || '[품수학 일일 학습 피드백]',
          kakaoOptions: {
            pfId,
            templateId,
            variables: kakaoOptions?.variables || {},
            disableSms: false,
          },
        },
      };

      const res = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: {
          'Authorization': getSolapiAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alimtalkPayload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { ...data, sendType: 'ALIMTALK' };
      }
      console.warn('⚠️ Kakao Alimtalk attempt rejected by Solapi, will retry as LMS:', data);
    } catch (err) {
      console.warn('⚠️ Kakao Alimtalk error, falling back to SMS/LMS:', err);
    }
  }

  // 2차 시도 (또는 기본): 일반 LMS/SMS 문자 메시지 전송
  const lmsPayload = {
    message: {
      to: cleanTo,
      from: cleanFrom,
      text: text,
      subject: title || '[품수학 일일 학습 피드백]',
    },
  };

  const lmsRes = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': getSolapiAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(lmsPayload),
  });

  const lmsData = await lmsRes.json().catch(() => ({}));
  if (!lmsRes.ok) {
    let errorMsg = lmsData.errorMessage || lmsData.message || lmsData.errorCode;
    if (lmsData.errorCode === 'NotEnoughBalance' || lmsRes.status === 402) {
      errorMsg = '솔라피 발송 잔액이 부족합니다. [솔라피(solapi.com) ➡️ 캐시 충전] 후 이용해 주세요.';
    } else {
      errorMsg = `Solapi 오류: ${errorMsg || '알 수 없는 오류'} (상태코드: ${lmsRes.status})`;
    }
    throw new Error(errorMsg);
  }

  return { ...lmsData, sendType: 'LMS' };
}
