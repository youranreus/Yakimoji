export const taskStatuses = [
  "created",
  "resolving_source",
  "matching_preset",
  "awaiting_preset_decision",
  "queued",
  "processing",
  "awaiting_human_review",
  "failed",
  "completed",
  "cancelled",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.includes(value as TaskStatus);
}

export const initialTaskStatus: TaskStatus = "created";
