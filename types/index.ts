export type ClassId = 6 | 7 | 10;
export type Variant = 1 | 2;
export type SessionStatus = 'writing' | 'blocked' | 'finished';

export interface StudentSession {
  id: string;
  class_id: ClassId;
  full_name: string;
  variant: Variant;
  work_type: string;
  status: SessionStatus;
  block_reason: string | null;
  blocked_at: string | null;
  unlocked_at: string | null;
  started_at: string;
  updated_at: string;
}

export interface WorkItem {
  class_id: ClassId;
  variant: Variant;
  title: string;
  workType: string;
  durationMinutes: number;
  tasks: string[];
}