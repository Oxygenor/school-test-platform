import { supabaseAdmin } from './supabase';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + 'school-platform-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface TeacherInfo {
  id: string;
  name: string;
}

export async function getTeacherFromToken(token: string | null): Promise<TeacherInfo | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from('teacher_sessions')
    .select('teacher_id, teachers!inner(id, name)')
    .eq('token', token)
    .single();
  if (!data) return null;
  const t = data.teachers as any;
  return { id: t.id, name: t.name };
}

export async function requireTeacher(req: Request): Promise<TeacherInfo | null> {
  const token = req.headers.get('x-teacher-token');
  return getTeacherFromToken(token);
}
