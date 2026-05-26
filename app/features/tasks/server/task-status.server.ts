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

export type TaskStatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "danger"
  | "success";

export type TaskStageState =
  | "completed"
  | "current"
  | "upcoming"
  | "attention"
  | "terminal";

export type TaskStageView = {
  id: string;
  label: string;
  description: string;
  state: TaskStageState;
};

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

const taskStageDefinitions = [
  {
    id: "created",
    label: "任务已创建",
    description: "任务记录已经写入工作台，等待进入后续阶段。",
    statuses: ["created"] as const,
  },
  {
    id: "source",
    label: "来源识别",
    description: "系统正在确认来源信息并建立处理上下文。",
    statuses: ["resolving_source"] as const,
  },
  {
    id: "preset",
    label: "预设匹配",
    description: "系统正在匹配可复用预设，必要时等待人工决策。",
    statuses: ["matching_preset", "awaiting_preset_decision"] as const,
  },
  {
    id: "queue",
    label: "进入队列",
    description: "任务已排队，等待处理资源就绪。",
    statuses: ["queued"] as const,
  },
  {
    id: "processing",
    label: "处理中",
    description: "任务正在执行处理流程。",
    statuses: ["processing"] as const,
  },
  {
    id: "review",
    label: "等待人工复核",
    description: "系统需要人工确认后才能继续推进。",
    statuses: ["awaiting_human_review"] as const,
  },
  {
    id: "delivery",
    label: "完成交付",
    description: "任务已完成，可进入交付访问环节。",
    statuses: ["completed"] as const,
  },
] as const;

const taskStageIndexByStatus = new Map<TaskStatus, number>(
  taskStageDefinitions.flatMap((stage, index) =>
    stage.statuses.map((status) => [status, index] satisfies [TaskStatus, number]),
  ),
);

const taskStatusPresentations: Record<
  TaskStatus,
  {
    label: string;
    description: string;
    tone: TaskStatusTone;
  }
> = {
  created: {
    label: "待开始",
    description: "任务已建立，等待系统进入下一阶段。",
    tone: "neutral",
  },
  resolving_source: {
    label: "正在识别来源",
    description: "系统正在确认来源与基础识别结果。",
    tone: "info",
  },
  matching_preset: {
    label: "正在匹配预设",
    description: "系统正在尝试命中可复用的处理预设。",
    tone: "info",
  },
  awaiting_preset_decision: {
    label: "等待预设决策",
    description: "需要创作者确认预设或手动继续。",
    tone: "warning",
  },
  queued: {
    label: "已进入队列",
    description: "任务已排队，等待处理资源分配。",
    tone: "info",
  },
  processing: {
    label: "正在处理",
    description: "任务正在执行处理流程。",
    tone: "info",
  },
  awaiting_human_review: {
    label: "等待人工复核",
    description: "系统需要人工确认后才能继续推进。",
    tone: "warning",
  },
  failed: {
    label: "处理失败",
    description: "任务已进入失败终态，需要结合追踪信息排查。",
    tone: "danger",
  },
  completed: {
    label: "已完成",
    description: "任务已完成处理，可进入交付访问。",
    tone: "success",
  },
  cancelled: {
    label: "已取消",
    description: "任务已被取消，不会继续推进。",
    tone: "danger",
  },
};

function resolveTimelineAnchorStatus(
  status: TaskStatus,
  lastActiveStatus?: TaskStatus | null,
) {
  if (status === "failed" || status === "cancelled") {
    return lastActiveStatus ?? null;
  }

  if (status === "completed") {
    return "completed";
  }

  return status;
}

export function getTaskStatusPresentation(status: TaskStatus) {
  return taskStatusPresentations[status];
}

export function getTaskCurrentStageLabel(
  status: TaskStatus,
  options: {
    lastActiveStatus?: TaskStatus | null;
  } = {},
) {
  const anchorStatus = resolveTimelineAnchorStatus(status, options.lastActiveStatus);

  if ((status === "failed" || status === "cancelled") && anchorStatus == null) {
    return taskStatusPresentations[status].label;
  }

  const stageIndex =
    anchorStatus == null ? undefined : taskStageIndexByStatus.get(anchorStatus);

  return stageIndex == null
    ? taskStatusPresentations[status].label
    : taskStageDefinitions[stageIndex].label;
}

export function buildTaskStageTimeline(
  status: TaskStatus,
  options: {
    lastActiveStatus?: TaskStatus | null;
  } = {},
): TaskStageView[] {
  const anchorStatus = resolveTimelineAnchorStatus(status, options.lastActiveStatus);
  const activeStageIndex =
    anchorStatus == null ? -1 : (taskStageIndexByStatus.get(anchorStatus) ?? -1);

  return taskStageDefinitions.map((stage, index) => {
    let state: TaskStageState = "upcoming";

    if (anchorStatus == null && (status === "failed" || status === "cancelled")) {
      if (index === taskStageDefinitions.length - 1) {
        state = "terminal";
      }
    } else if (index < activeStageIndex) {
      state = "completed";
    } else if (index === activeStageIndex) {
      if (
        status === "awaiting_human_review" ||
        status === "awaiting_preset_decision"
      ) {
        state = "attention";
      } else if (status === "failed" || status === "cancelled") {
        state = "terminal";
      } else if (status === "completed" && stage.id === "delivery") {
        state = "completed";
      } else {
        state = "current";
      }
    }

    if (status === "completed" && index <= activeStageIndex) {
      state = "completed";
    }

    return {
      id: stage.id,
      label: stage.label,
      description: stage.description,
      state,
    };
  });
}

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
