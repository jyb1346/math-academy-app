import crypto from 'crypto';

const API_KEY = process.env.SOLAPI_API_KEY || 'NCSQAXAB7S9TSUIN';
const API_SECRET = process.env.SOLAPI_API_SECRET || 'MDAKYKOGTOHBGHAWVEA5UOP3J4V3I8OI';
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || '01027053409';
const KAKAO_PFID = process.env.SOLAPI_KAKAO_PFID || 'KA01PF260831093804945uPxRUYsn8qj';
const KAKAO_TEMPLATE_ID = process.env.SOLAPI_KAKAO_TEMPLATE_ID || 'KA01TP260901085150042icX0U1Jrpr1';

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
 * Solapi 메시지 발송 함수 (알림톡 우선, 심사 중이거나 미설정 시 LMS/SMS 자동 발송)
 */
export async function sendSolapiMessage({ to, text, title, kakaoOptions }) {
  const cleanTo = cleanPhoneNumber(to);
  if (!cleanTo || cleanTo.length < 10) {
    throw new Error('수신자 전화번호가 올바르지 않습니다.');
  }

  const authHeader = getSolapiAuthHeader();
  const payload = {
    message: {
      to: cleanTo,
      from: cleanPhoneNumber(SENDER_NUMBER),
      text: text,
    },
  };

  if (title) {
    payload.message.subject = title;
  }

  // 카카오 알림톡 옵션 설정 (카카오 심사 완료 시 자동으로 알림톡으로 전송됨)
  const pfId = kakaoOptions?.pfId || KAKAO_PFID;
  const templateId = kakaoOptions?.templateId || KAKAO_TEMPLATE_ID;

  if (pfId && templateId) {
    payload.message.kakaoOptions = {
      pfId,
      templateId,
      variables: kakaoOptions?.variables || {},
      disableSms: false, // 알림톡 실패/미승인 시 SMS/LMS 자동 대체 발송
    };
  }

  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errorMessage || data.message || data.errorCode || `Solapi 발송 실패 (상태코드: ${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}
