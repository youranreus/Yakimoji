import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";

import { database } from "../../../../database/context";
import { taskEvents, tasks } from "../../../../database/schema";

import {
  getTaskStatusPresentation,
  type TaskStatus,
} from "./task-status.server";
import {
  defaultTaskSyncPollingIntervalMs,
  defaultTaskSyncSseRetryMs,
  taskSyncEventName,
} from "../task-sync.shared";

type VisibleTaskRecord = {
  id: string;
  status: TaskStatus;
  updatedAt: Date;
};

type EventRecord = {
  id: string;
  taskId: string;
  eventType: string;
  toStatus: TaskStatus;
  requestId: string;
  createdAt: Date;
};

export type TaskSyncSnapshot = {
  taskId: string;
  status: TaskStatus;
  statusLabel: string;
  latestEventType: string | null;
  latestEventAt: string;
  updatedAt: string;
  requestId: string | null;
};

export type TaskSyncDeltaEvent = {
  event: typeof taskSyncEventName;
  data: {
    cursor: string;
    changedTaskIds: string[];
    taskIds: string[];
    latestEventAt: string;
    transport: "sse" | "polling";
  };
};

export type TaskSyncEnvelope = {
  ok: true;
  mode: "delta" | "heartbeat";
  transport: "sse" | "polling";
  cursor: string;
  intervalMs: number;
  changedTaskIds: string[];
  visibleTaskIds: string[];
  snapshots: TaskSyncSnapshot[];
  event: TaskSyncDeltaEvent | null;
};

const defaultVisibleTaskLimit = 10;

export const taskSyncTestHooks = {
  listVisibleTasksForUserImpl: listVisibleTasksForUser,
  listEventsSinceForTaskIdsImpl: listEventsSinceForTaskIds,
  listLatestEventsForTaskIdsImpl: listLatestEventsForTaskIds,
};

export function setTaskSyncTestHooks(
  hooks: Partial<typeof taskSyncTestHooks>,
) {
  taskSyncTestHooks.listVisibleTasksForUserImpl =
    hooks.listVisibleTasksForUserImpl ?? listVisibleTasksForUser;
  taskSyncTestHooks.listEventsSinceForTaskIdsImpl =
    hooks.listEventsSinceForTaskIdsImpl ?? listEventsSinceForTaskIds;
  taskSyncTestHooks.listLatestEventsForTaskIdsImpl =
    hooks.listLatestEventsForTaskIdsImpl ?? listLatestEventsForTaskIds;
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  const date = new Date(cursor);

  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueTaskIds(taskIds: readonly string[]) {
  return [...new Set(taskIds)];
}

function uniqueVisibleTasks(tasksForSync: VisibleTaskRecord[]) {
  const seen = new Set<string>();

  return tasksForSync.filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }

    seen.add(task.id);
    return true;
  });
}

function mapSnapshot(
  task: VisibleTaskRecord,
  latestEvent: EventRecord | null,
): TaskSyncSnapshot {
  return {
    taskId: task.id,
    status: task.status,
    statusLabel: getTaskStatusPresentation(task.status).label,
    latestEventType: latestEvent?.eventType ?? null,
    latestEventAt: (latestEvent?.createdAt ?? task.updatedAt).toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    requestId: latestEvent?.requestId ?? null,
  };
}

function buildDeltaEvent(args: {
  changedTaskIds: string[];
  cursor: string;
  latestEventAt: string;
  transport: "sse" | "polling";
}): TaskSyncDeltaEvent | null {
  if (args.changedTaskIds.length === 0) {
    return null;
  }

  return {
    event: taskSyncEventName,
    data: {
      cursor: args.cursor,
      changedTaskIds: args.changedTaskIds,
      taskIds: args.changedTaskIds,
      latestEventAt: args.latestEventAt,
      transport: args.transport,
    },
  };
}

async function listVisibleTasksForUser(args: {
  userId: number;
  selectedTaskId?: string | null;
  page?: number;
  pageSize?: number;
  limit?: number;
}): Promise<VisibleTaskRecord[]> {
  const db = database();
  const limit = args.limit ?? args.pageSize ?? defaultVisibleTaskLimit;
  const page = Math.max(args.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const rows = (await db
    .select({
      id: tasks.id,
      status: tasks.status,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.creatorUserId, args.userId))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .offset(offset)) as VisibleTaskRecord[];

  if (!args.selectedTaskId || rows.some((task) => task.id === args.selectedTaskId)) {
    return rows;
  }

  const [selectedTask] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.creatorUserId, args.userId),
        eq(tasks.id, args.selectedTaskId),
      ),
    )
    .limit(1);

  return selectedTask ? uniqueVisibleTasks([...rows, selectedTask as VisibleTaskRecord]) : rows;
}

async function listEventsSinceForTaskIds(args: {
  userId: number;
  taskIds: string[];
  since: Date;
}) {
  if (args.taskIds.length === 0) {
    return [];
  }

  const db = database();
  const rows = await db
    .select({
      id: taskEvents.id,
      taskId: taskEvents.taskId,
      eventType: taskEvents.eventType,
      toStatus: taskEvents.toStatus,
      requestId: taskEvents.requestId,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .innerJoin(tasks, eq(taskEvents.taskId, tasks.id))
    .where(
      and(
        eq(tasks.creatorUserId, args.userId),
        inArray(taskEvents.taskId, args.taskIds),
        gt(taskEvents.createdAt, args.since),
      ),
    )
    .orderBy(asc(taskEvents.createdAt));

  return rows as EventRecord[];
}

async function listLatestEventsForTaskIds(args: { taskIds: string[] }) {
  if (args.taskIds.length === 0) {
    return new Map<string, EventRecord>();
  }

  const db = database();
  const rows = await db
    .select({
      id: taskEvents.id,
      taskId: taskEvents.taskId,
      eventType: taskEvents.eventType,
      toStatus: taskEvents.toStatus,
      requestId: taskEvents.requestId,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .where(inArray(taskEvents.taskId, args.taskIds))
    .orderBy(desc(taskEvents.createdAt));

  const latestByTaskId = new Map<string, EventRecord>();

  for (const row of rows as EventRecord[]) {
    if (!latestByTaskId.has(row.taskId)) {
      latestByTaskId.set(row.taskId, row);
    }
  }

  return latestByTaskId;
}

async function buildSnapshots(tasksForSync: VisibleTaskRecord[]) {
  const latestEvents = await taskSyncTestHooks.listLatestEventsForTaskIdsImpl({
    taskIds: tasksForSync.map((task) => task.id),
  });

  return tasksForSync.map((task) =>
    mapSnapshot(task, latestEvents.get(task.id) ?? null),
  );
}

export async function getTaskSyncEnvelope(args: {
  userId: number;
  selectedTaskId?: string | null;
  page?: number;
  pageSize?: number;
  cursor?: string | null;
  transport: "sse" | "polling";
  pollingIntervalMs?: number;
}) {
  const visibleTasks = await taskSyncTestHooks.listVisibleTasksForUserImpl({
    userId: args.userId,
    selectedTaskId: args.selectedTaskId ?? null,
    page: args.page,
    pageSize: args.pageSize,
  });
  const visibleTaskIds = uniqueTaskIds(visibleTasks.map((task) => task.id));
  const intervalMs = args.pollingIntervalMs ?? defaultTaskSyncPollingIntervalMs;
  const parsedCursor = parseCursor(args.cursor);

  if (!parsedCursor) {
    const snapshots = await buildSnapshots(visibleTasks);
    const cursor = snapshots.reduce(
      (latest, snapshot) =>
        snapshot.latestEventAt > latest ? snapshot.latestEventAt : latest,
      new Date(0).toISOString(),
    );

    return {
      ok: true,
      mode: "heartbeat",
      transport: args.transport,
      cursor,
      intervalMs,
      changedTaskIds: [],
      visibleTaskIds,
      snapshots,
      event: null,
    } satisfies TaskSyncEnvelope;
  }

  const changedEvents = await taskSyncTestHooks.listEventsSinceForTaskIdsImpl({
    userId: args.userId,
    taskIds: visibleTaskIds,
    since: parsedCursor,
  });
  const changedTaskIds = uniqueTaskIds(changedEvents.map((event) => event.taskId));
  const changedTaskSet = new Set(changedTaskIds);
  const snapshots = await buildSnapshots(
    visibleTasks.filter((task) => changedTaskSet.has(task.id)),
  );
  const latestEventAt =
    changedEvents.at(-1)?.createdAt.toISOString() ?? parsedCursor.toISOString();
  const cursor =
    changedEvents.at(-1)?.createdAt.toISOString() ?? parsedCursor.toISOString();

  return {
    ok: true,
    mode: changedTaskIds.length > 0 ? "delta" : "heartbeat",
    transport: args.transport,
    cursor,
    intervalMs,
    changedTaskIds,
    visibleTaskIds,
    snapshots,
    event: buildDeltaEvent({
      changedTaskIds,
      cursor,
      latestEventAt,
      transport: args.transport,
    }),
  } satisfies TaskSyncEnvelope;
}

export function getTaskSyncPollingIntervalMs() {
  return defaultTaskSyncPollingIntervalMs;
}

export function getTaskSyncSseRetryMs() {
  return defaultTaskSyncSseRetryMs;
}

export function encodeTaskSyncSseEvent(event: TaskSyncDeltaEvent) {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
