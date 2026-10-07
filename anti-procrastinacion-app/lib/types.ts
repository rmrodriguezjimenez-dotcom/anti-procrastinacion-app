export type TaskCategory =
  | "work"
  | "personal"
  | "family"
  | "finance"
  | "home"
  | "shopping"
  | "appointments"
  | "projects"
  | "health"
  | "other";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskSource = "manual" | "voice_web" | "whatsapp" | "ai";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  source: TaskSource;
  estimated_minutes: number | null;
  recurrence: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ParsedTask = {
  title: string;
  notes?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  due_at?: string | null;
  estimated_minutes?: number | null;
  recurrence?: string | null;
};
