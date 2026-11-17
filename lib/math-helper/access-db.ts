import { supabaseAdmin } from '@/lib/supabase';
import type { PrepDb, PrepLogRow } from './access';

// Колонки з міграції supabase-migration-math-helper.sql. Якщо міграцію ще
// не застосовано, код працює зі старою схемою prep_logs.
let extendedLogColumns: boolean | null = null;

function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204' || /student_id|column/i.test(error.message ?? '');
}

export const supabasePrepDb: PrepDb = {
  async findStudent(studentId, classId) {
    const { data } = await supabaseAdmin
      .from('students')
      .select('id, full_name')
      .eq('id', studentId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .maybeSingle();
    return data ? { id: data.id, fullName: data.full_name } : null;
  },

  async teacherHasClass(teacherId, classId) {
    const { data } = await supabaseAdmin
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .maybeSingle();
    return !!data;
  },

  async listPrepSubjects(classId, teacherId) {
    const { data } = await supabaseAdmin
      .from('works')
      .select('subject')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('prep_enabled', true);
    return Array.from(new Set((data || []).map((w) => w.subject as string)));
  },

  async hasActiveExam(studentId) {
    const { data } = await supabaseAdmin
      .from('student_sessions')
      .select('id')
      .eq('student_id', studentId)
      .in('status', ['writing', 'blocked'])
      .limit(1);
    return !!data && data.length > 0;
  },

  async countRecentRequests(studentId, sinceIso) {
    if (extendedLogColumns === false) return null;
    const { count, error } = await supabaseAdmin
      .from('prep_logs')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', sinceIso);
    if (error) {
      if (isMissingColumn(error)) extendedLogColumns = false;
      return null;
    }
    extendedLogColumns = true;
    return count ?? 0;
  },

  async insertLog(row: PrepLogRow) {
    const base = {
      class_id: row.classId,
      teacher_id: row.teacherId,
      student_name: row.studentName,
      subject: row.subject,
      message: row.message,
    };
    if (extendedLogColumns !== false) {
      const { error } = await supabaseAdmin.from('prep_logs').insert({
        ...base,
        student_id: row.studentId,
        mode: row.mode,
        model: row.model,
        input_tokens: row.usage?.input ?? null,
        output_tokens: row.usage?.output ?? null,
        cache_read_tokens: row.usage?.cacheRead ?? null,
        cache_write_tokens: row.usage?.cacheWrite ?? null,
      });
      if (!error) {
        extendedLogColumns = true;
        return;
      }
      if (isMissingColumn(error)) extendedLogColumns = false;
    }
    await supabaseAdmin.from('prep_logs').insert(base);
  },
};
