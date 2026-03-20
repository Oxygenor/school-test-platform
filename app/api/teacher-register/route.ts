import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/teacher-auth';

export async function POST(req: Request) {
  const { name, password } = await req.json();

  if (!name?.trim() || !password?.trim()) {
    return NextResponse.json({ ok: false, error: "Введіть ім'я та пароль" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ ok: false, error: 'Пароль мінімум 4 символи' }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from('teachers')
    .insert({ name: name.trim(), password_hash })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: "Таке ім'я вже зайняте" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Автоматично створюємо токен після реєстрації
  const { data: session } = await supabaseAdmin
    .from('teacher_sessions')
    .insert({ teacher_id: data.id })
    .select('token')
    .single();

  return NextResponse.json({ ok: true, token: session?.token, name: data.name });
}
