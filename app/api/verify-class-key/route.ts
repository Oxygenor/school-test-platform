import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { classId, classKey } = await req.json();

    if (![6, 7, 10].includes(Number(classId))) {
      return NextResponse.json({ ok: false, error: 'Некоректний клас' }, { status: 400 });
    }

    const expectedKey =
      Number(classId) === 6
        ? process.env.CLASS_6_KEY
        : Number(classId) === 7
        ? process.env.CLASS_7_KEY
        : process.env.CLASS_10_KEY;

    if (!expectedKey) {
      return NextResponse.json({ ok: false, error: 'Ключ класу не налаштований на сервері' }, { status: 500 });
    }

    if (String(classKey || '').trim() !== expectedKey) {
      return NextResponse.json({ ok: false, error: 'Неправильний ключ класу' }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Внутрішня помилка сервера' }, { status: 500 });
  }
}