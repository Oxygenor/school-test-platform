import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = await req.json();

  if (password !== process.env.TEACHER_LOGIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Неправильний пароль' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}