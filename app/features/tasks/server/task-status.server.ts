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

const taskStatusTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  created: [
    "resolving_source",
    "matching_preset",
    "awaiting_preset_decision",
    "queued",
    "processing",
    "awaiting_human_review",
    "failed",
    "cancelled",
  ],
  resolving_source: [
    "matching_preset",
    "awaiting_preset_decision",
    "queued",
    "processing",
    "awaiting_human_review",
    "failed",
    "cancelled",
  ],
  matching_preset: [
    "awaiting_preset_decision",
    "queued",
    "processing",
    "awaiting_human_review",
    "failed",
    "cancelled",
  ],
  awaiting_preset_decision: [
    "queued",
    "processing",
    "awaiting_human_review",
    "failed",
    "cancelled",
  ],
  queued: ["processing", "awaiting_human_review", "failed", "cancelled"],
  processing: ["awaiting_human_review", "completed", "failed", "cancelled"],
  awaiting_human_review: [
    "queued",
    "processing",
    "completed",
    "failed",
    "cancelled",
  ],
  failed: [],
  completed: [],
  cancelled: [],
};

export function canTransitionTaskStatus(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
) {
  return taskStatusTransitions[fromStatus].includes(toStatus);
}

export function assertTaskStatusTransition(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
) {
  if (fromStatus === toStatus) {
    throw new Error("Invalid task status transition");
  }

  if (!canTransitionTaskStatus(fromStatus, toStatus)) {
    throw new Error("Invalid task status transition");
  }
}
