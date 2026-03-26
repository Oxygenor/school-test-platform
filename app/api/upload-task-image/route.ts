import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTeacher } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const teacher = await requireTeacher(req);
  if (!teacher) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, error: 'Немає файлу' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Дозволені лише зображення (jpg, png, gif, webp)' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'Файл більше 5 МБ' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${teacher.id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from('task-images')
    .upload(fileName, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data } = supabaseAdmin.storage.from('task-images').getPublicUrl(fileName);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
