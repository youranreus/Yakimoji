import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { database } from "../../../../database/context";
import * as schema from "../../../../database/schema";
import { taskEvents, tasks } from "../../../../database/schema";

import {
  assertTaskStatusTransition,
  initialTaskStatus,
  type TaskStatus,
} from "./task-status.server";

export type TaskEventType =
  | "task.created"
  | "task.resolving_source"
  | "task.matching_preset"
  | "task.preset_decision_requested"
  | "task.queued"
  | "task.processing"
  | "task.human_review_requested"
  | "task.review_required"
  | "task.review_resolved"
  | "task.failed"
  | "task.completed"
  | "task.cancelled"
  | "task.manual_intervention"
  | "task.recovered"
  | "task.retry_requested"
  | "task.retry_spawned";

type AppendTaskEventArgs = {
  taskId: string;
  eventType: TaskEventType;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  requestId: string;
  reasonCode?: string | null;
  actorUserId?: number | null;
  payload?: Record<string, unknown>;
  createdAt?: Date;
  db?: PostgresJsDatabase<typeof schema>;
};

type TransitionTaskStatusArgs = Omit<AppendTaskEventArgs, "requestId" | "reasonCode"> & {
  requestId?: string;
  reasonCode?: string | null;
};

export async function appendTaskEvent(args: AppendTaskEventArgs) {
  if (
    (args.toStatus === "failed" || args.toStatus === "cancelled") &&
    !args.reasonCode
  ) {
    throw new Error("Terminal task events require a machine-readable reason code");
  }

  const db = args.db ?? database();
  const eventId = `event_${randomUUID().replace(/-/g, "")}`;
  const createdAt = args.createdAt ?? new Date();

  await db.insert(taskEvents).values({
    id: eventId,
    taskId: args.taskId,
    eventType: args.eventType,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    reasonCode: args.reasonCode ?? null,
    requestId: args.requestId,
    actorUserId: args.actorUserId ?? null,
    payload: args.payload ?? {},
    createdAt,
  });

  return {
    id: eventId,
    createdAt,
  };
}

export async function transitionTaskStatus(args: TransitionTaskStatusArgs) {
  const requestId = args.requestId ?? "req_unavailable";

  assertTaskStatusTransition(args.fromStatus, args.toStatus);

  const db = args.db ?? database();
  const createdAt = args.createdAt ?? new Date();

  return db.transaction(async (tx) => {
    const [updatedTask] = await tx
      .update(tasks)
      .set({
        status: args.toStatus,
        updatedAt: createdAt,
      })
      .where(and(eq(tasks.id, args.taskId), eq(tasks.status, args.fromStatus)))
      .returning({
        id: tasks.id,
        status: tasks.status,
      });

    if (!updatedTask) {
      throw new Error("Task status changed before transition could be applied");
    }

    await appendTaskEvent({
      taskId: args.taskId,
      eventType: args.eventType,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      reasonCode: args.reasonCode ?? null,
      requestId,
      actorUserId: args.actorUserId ?? null,
      payload: args.payload ?? {},
      createdAt,
      db: tx,
    });

    return updatedTask;
  });
}

export async function recordTaskCreation(args: {
  taskId: string;
  requestId: string;
  actorUserId?: number | null;
  payload?: Record<string, unknown>;
  createdAt?: Date;
  db?: PostgresJsDatabase<typeof schema>;
}) {
  return appendTaskEvent({
    taskId: args.taskId,
    eventType: "task.created",
    fromStatus: initialTaskStatus,
    toStatus: initialTaskStatus,
    requestId: args.requestId,
    actorUserId: args.actorUserId ?? null,
    payload: args.payload ?? {},
    createdAt: args.createdAt,
    db: args.db,
  });
}

export async function getTaskLifecycleSnapshot(taskId: string) {
  const db = database();
  const [task] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) {
    return null;
  }

  const [latestEvent] = await db
    .select({
      id: taskEvents.id,
      taskId: taskEvents.taskId,
      eventType: taskEvents.eventType,
      fromStatus: taskEvents.fromStatus,
      toStatus: taskEvents.toStatus,
      reasonCode: taskEvents.reasonCode,
      requestId: taskEvents.requestId,
      actorUserId: taskEvents.actorUserId,
      payload: taskEvents.payload,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.createdAt))
    .limit(1);

  return {
    task: {
      id: task.id,
      status: task.status as TaskStatus,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    latestEvent:
      latestEvent == null
        ? null
        : {
            ...latestEvent,
            payload: latestEvent.payload as Record<string, unknown>,
          },
  };
}
