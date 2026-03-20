import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const token = req.headers.get('x-teacher-token');
  if (token) {
    await supabaseAdmin.from('teacher_sessions').delete().eq('token', token);
  }
  return NextResponse.json({ ok: true });
}
