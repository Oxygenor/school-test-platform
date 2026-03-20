import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const { name, password } = await req.json();

  if (!name?.trim() || !password?.trim()) {
    return NextResponse.json({ ok: false, error: "Введіть ім'я та пароль" }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('id, name')
    .eq('name', name.trim())
    .eq('password_hash', password_hash)
    .single();

  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Неправильне ім'я або пароль" }, { status: 401 });
  }

  const { data: session } = await supabaseAdmin
    .from('teacher_sessions')
    .insert({ teacher_id: teacher.id })
    .select('token')
    .single();

  return NextResponse.json({ ok: true, token: session?.token, name: teacher.name });
}
