import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const { name, password, subjects, registrationCode } = await req.json();

  const validCode = process.env.TEACHER_REGISTRATION_CODE;
  if (!validCode || registrationCode !== validCode) {
    return NextResponse.json({ ok: false, error: 'Невірний код реєстрації' }, { status: 403 });
  }

  if (!name?.trim() || !password?.trim()) {
    return NextResponse.json({ ok: false, error: "Введіть ім'я та пароль" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ ok: false, error: 'Пароль мінімум 4 символи' }, { status: 400 });
  }
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ ok: false, error: 'Оберіть хоча б один предмет' }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .insert({ name: name.trim(), password_hash, subjects })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: "Таке ім'я вже зайняте" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: session } = await supabaseAdmin
    .from('teacher_sessions')
    .insert({ teacher_id: data.id })
    .select('token')
    .single();

  return NextResponse.json({ ok: true, token: session?.token, name: data.name });
}
