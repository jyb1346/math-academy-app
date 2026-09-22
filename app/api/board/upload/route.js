import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'zip', 'txt'];

// POST /api/board/upload — multipart/form-data { file } → { url, name }
export async function POST(req) {
  const { error } = requireRole(req, ['TEACHER', 'HEAD_TEACHER']);
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: '파일 크기는 20MB를 초과할 수 없습니다.' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: '허용되지 않는 파일 형식입니다.' }, { status: 400 });
  }

  const db = getSupabaseAdmin(req);
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
  const filePath = `board_files/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await db.storage.from('attachments').upload(filePath, Buffer.from(arrayBuffer), {
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage.from('attachments').getPublicUrl(filePath);

  return NextResponse.json({ url: urlData?.publicUrl, name: file.name });
}
