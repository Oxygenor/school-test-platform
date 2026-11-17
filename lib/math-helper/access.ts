import { verifyPrepToken } from './prep-token';
import { classIdToGrade, classIdToName, isMathSubject } from './topics';

/** Доступ до бази, потрібний помічнику. Реалізація для Supabase — у access-db.ts. */
export interface PrepDb {
  /** Учень активний і належить до класу. */
  findStudent(studentId: string, classId: number): Promise<{ id: string; fullName: string } | null>;
  teacherHasClass(teacherId: string, classId: number): Promise<boolean>;
  /** Предмети з увімкненою підготовкою для класу й учителя. */
  listPrepSubjects(classId: number, teacherId: string): Promise<string[]>;
  /** У учня є незавершена сесія іспиту (writing/blocked). */
  hasActiveExam(studentId: string): Promise<boolean>;
  /** Скільки запитів до моделі учень зробив після `sinceIso`; null — якщо лічильник недоступний. */
  countRecentRequests(studentId: string, sinceIso: string): Promise<number | null>;
  insertLog(row: PrepLogRow): Promise<void>;
}

export interface PrepLogRow {
  classId: number;
  teacherId: string;
  studentId: string;
  studentName: string;
  subject: string;
  message: string;
  mode: string;
  model: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
}

export interface PrepContext {
  classId: number;
  className: string;
  grade: number;
  teacherId: string;
  studentId: string;
  /** Лише для вчительської статистики; не передається в Anthropic. */
  studentName: string;
  subject: string;
  subjects: string[];
}

export type AccessResult =
  | { ok: true; ctx: PrepContext }
  | { ok: false; status: number; error: string };

export const ACCESS_ERRORS = {
  noSession: 'Сесія підготовки завершилась. Увійди ще раз за кодом від учителя.',
  disabled: 'Учитель зараз не відкрив підготовку з цього предмета.',
  examActive: 'Під час контрольної помічник недоступний. Повернись до роботи.',
  notMath: 'Помічник допомагає лише з математикою, алгеброю та геометрією.',
};

/**
 * Перевіряє право на підготовку на сервері. Викликається на КОЖЕН запит до бота
 * (ще до звернення до Anthropic), тож вимкнення підготовки діє одразу.
 */
export async function checkPrepAccess(
  token: string | null,
  subject: string | null,
  db: PrepDb,
): Promise<AccessResult> {
  const claims = verifyPrepToken(token);
  if (!claims) return { ok: false, status: 401, error: ACCESS_ERRORS.noSession };

  const [student, hasClass] = await Promise.all([
    db.findStudent(claims.sid, claims.cid),
    db.teacherHasClass(claims.tid, claims.cid),
  ]);
  if (!student || !hasClass) return { ok: false, status: 401, error: ACCESS_ERRORS.noSession };

  const [subjectsAll, examActive] = await Promise.all([
    db.listPrepSubjects(claims.cid, claims.tid),
    db.hasActiveExam(claims.sid),
  ]);
  if (examActive) return { ok: false, status: 403, error: ACCESS_ERRORS.examActive };

  const subjects = subjectsAll.filter(isMathSubject);
  if (subject !== null) {
    if (!subjectsAll.includes(subject)) return { ok: false, status: 403, error: ACCESS_ERRORS.disabled };
    if (!isMathSubject(subject)) return { ok: false, status: 403, error: ACCESS_ERRORS.notMath };
  }

  return {
    ok: true,
    ctx: {
      classId: claims.cid,
      className: classIdToName(claims.cid),
      grade: classIdToGrade(claims.cid),
      teacherId: claims.tid,
      studentId: claims.sid,
      studentName: student.fullName,
      subject: subject ?? '',
      subjects,
    },
  };
}
