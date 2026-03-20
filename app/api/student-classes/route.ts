import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Повертає всі класи які є в системі (для сторінки вибору класу учнем)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('teacher_classes')
    .select('class_id')
    .order('class_id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const unique = [...new Set((data || []).map((r) => r.class_id))];
  return NextResponse.json({ ok: true, classes: unique });
}
