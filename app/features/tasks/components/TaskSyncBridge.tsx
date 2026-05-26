import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useRevalidator } from "react-router";

import {
  defaultTaskSyncPollingIntervalMs,
  taskSyncEventName,
} from "../task-sync.shared";

type TaskSyncBridgeProps = {
  taskId?: string | null;
  children: ReactNode;
};

type SyncState = "connecting" | "live" | "polling" | "retrying";

function buildSyncUrl(search: string, taskId?: string | null) {
  const params = new URLSearchParams(search);

  if (taskId) {
    params.set("taskId", taskId);
  } else {
    params.delete("taskId");
  }

  return `/workspace/task-sync?${params.toString()}`;
}

function getSyncCopy(state: SyncState) {
  switch (state) {
    case "live":
      return {
        title: "正在同步",
        body: "任务列表和详情会通过 SSE 事件触发受控刷新。",
      };
    case "polling":
      return {
        title: "已回退轮询",
        body: "当前环境未维持 SSE，系统改用最小状态摘要轮询。",
      };
    case "retrying":
      return {
        title: "连接断开，正在重试",
        body: "同步层会继续尝试恢复 SSE，同时避免在组件内维护第二套状态。",
      };
    case "connecting":
    default:
      return {
        title: "正在建立同步",
        body: "系统正在准备状态同步通道。",
      };
  }
}

export function TaskSyncBridge({
  taskId = null,
  children,
}: TaskSyncBridgeProps) {
  const location = useLocation();
  const revalidator = useRevalidator();
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [transport, setTransport] = useState<"sse" | "polling">("sse");
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const cursorRef = useRef<string | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;

    return () => {
      disposedRef.current = true;
    };
  }, []);

  useEffect(() => {
    const stopPolling = () => {
      if (pollingTimerRef.current !== null) {
        window.clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };

    const stopSse = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };

    const revalidate = (nextCursor?: string | null) => {
      if (nextCursor) {
        cursorRef.current = nextCursor;
      }

      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    };

    const startPolling = () => {
      stopSse();
      stopPolling();
      setTransport("polling");
      setSyncState("polling");

      const poll = async () => {
        if (document.visibilityState === "hidden" || disposedRef.current) {
          pollingTimerRef.current = window.setTimeout(
            poll,
            defaultTaskSyncPollingIntervalMs,
          );
          return;
        }

        try {
          const params = new URLSearchParams(location.search);
          params.set("transport", "polling");

          if (taskId) {
            params.set("taskId", taskId);
          }

          if (cursorRef.current) {
            params.set("cursor", cursorRef.current);
          }

          const response = await fetch(
            `/workspace/task-sync?${params.toString()}`,
            {
              credentials: "same-origin",
            },
          );

          if (!response.ok) {
            throw new Error(`Polling request failed with ${response.status}`);
          }

          const payload = (await response.json()) as {
            cursor: string;
            changedTaskIds: string[];
          };

          cursorRef.current = payload.cursor;

          if (payload.changedTaskIds.length > 0) {
            revalidate(payload.cursor);
          }
        } catch {
          setSyncState("retrying");
        } finally {
          pollingTimerRef.current = window.setTimeout(
            poll,
            defaultTaskSyncPollingIntervalMs,
          );
        }
      };

      void poll();
    };

    if (typeof EventSource === "undefined") {
      startPolling();
      return () => {
        stopPolling();
        stopSse();
      };
    }

    stopPolling();
    stopSse();
    setTransport("sse");
    setSyncState("connecting");

    const syncUrl = new URL(
      buildSyncUrl(location.search, taskId),
      window.location.origin,
    );

    if (cursorRef.current) {
      syncUrl.searchParams.set("cursor", cursorRef.current);
    }

    const source = new EventSource(syncUrl.toString(), {
      withCredentials: true,
    });

    source.addEventListener(taskSyncEventName, (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        cursor: string;
      };

      setSyncState("live");
      revalidate(payload.cursor);
    });

    source.onopen = () => {
      setTransport("sse");
      setSyncState("live");
    };

    source.onerror = () => {
      setSyncState("retrying");
      startPolling();
    };

    eventSourceRef.current = source;

    return () => {
      stopPolling();
      stopSse();
    };
  }, [location.pathname, location.search, revalidator, taskId]);

  const syncCopy = getSyncCopy(syncState);

  return (
    <div className="task-sync-bridge">
      <section className="shell-panel task-sync-status" aria-live="polite">
        <div className="task-sync-status-topline">
          <div>
            <p className="eyebrow">Live Sync</p>
            <h2>{syncCopy.title}</h2>
          </div>
          <span className={`status-pill status-pill-${transport === "sse" ? "info" : "warning"}`}>
            {transport === "sse" ? "SSE 优先" : "轮询兜底"}
          </span>
        </div>
        <p className="task-panel-copy">{syncCopy.body}</p>
      </section>
      {children}
    </div>
  );
}
