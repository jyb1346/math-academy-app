import crypto from 'crypto';

const API_KEY = process.env.SOLAPI_API_KEY || 'NCSFTZAGNVNEA2L9';
const API_SECRET = process.env.SOLAPI_API_SECRET || 'TIWBNSL5AV25QNXLEFV4CWMOWG0DYZKO';
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || '01027053409';

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
 * Solapi 메시지 발송 함수 (알림톡 우선, 미설정 또는 실패 시 SMS/LMS 자동 발송)
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

  // 카카오 알림톡 옵션이 제공된 경우
  if (kakaoOptions && kakaoOptions.pfId && kakaoOptions.templateId) {
    payload.message.kakaoOptions = {
      pfId: kakaoOptions.pfId,
      templateId: kakaoOptions.templateId,
      variables: kakaoOptions.variables || {},
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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || `Solapi 발송 실패 (상태코드: ${response.status})`);
  }

  return data;
}
