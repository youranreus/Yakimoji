import { Form, useActionData } from "react-router";

import { ChannelPresetWorkbench } from "~/features/presets/components/ChannelPresetWorkbench";
import type { ChannelPresetActionResult } from "~/features/presets/server/channel-presets.server";
import { WorkspaceShell } from "~/shared/ui/WorkspaceShell";

import type { TaskActionError } from "../server/task-errors.server";
import type {
  TaskCreatedPayload,
  TaskIntakeActionResult,
  TaskPreviewPayload,
} from "../server/task-intake.server";
import type { WorkspaceViewModel } from "../server/workspace-view.server";
import { TaskSyncBridge } from "./TaskSyncBridge";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskListPanel } from "./TaskListPanel";

type CreatorWorkspaceScreenProps = {
  loaderData: WorkspaceViewModel;
};

export function CreatorWorkspaceScreen({
  loaderData,
}: CreatorWorkspaceScreenProps) {
  const actionData = useActionData<
    TaskIntakeActionResult | ChannelPresetActionResult
  >();
  type WorkspaceTaskActionData =
    | TaskPreviewPayload
    | TaskCreatedPayload
    | TaskActionError;
  const isTaskIntakeActionData = (
    value: TaskIntakeActionResult | ChannelPresetActionResult | null | undefined,
  ): value is WorkspaceTaskActionData =>
    Boolean(
      value &&
        ((value.ok &&
          ("mode" in value) &&
          (value.mode === "preview" || value.mode === "created")) ||
          (!value.ok &&
            !("resource" in value) &&
            !["review_submission_invalid", "retry_unavailable"].includes(value.code))),
    );
  const taskActionData =
    isTaskIntakeActionData(actionData) ? actionData : null;
  const workspaceMode =
    loaderData.selectedTask?.accessMode === "support" &&
    !loaderData.roles.includes("creator")
      ? "support"
      : "creator";

  return (
    <WorkspaceShell
      workspaceMode={workspaceMode}
      runtime={loaderData.runtime}
      serviceName={loaderData.serviceName}
      requestId={loaderData.requestId}
      user={loaderData.user}
      roles={loaderData.roles}
      navigation={loaderData.navigation}
      panels={loaderData.panels}
      actionData={taskActionData}
      channelPresets={loaderData.channelPresets}
      presetPanel={<ChannelPresetWorkbench presets={loaderData.channelPresets} />}
      taskListPanel={
        <TaskSyncBridge taskId={loaderData.selectedTask?.id ?? null}>
          <TaskListPanel
            taskList={loaderData.taskList}
            selectedTaskId={loaderData.selectedTask?.id ?? null}
          />
        </TaskSyncBridge>
      }
      taskDetailPanel={<TaskDetailPanel task={loaderData.selectedTask} />}
      logoutForm={
        <Form method="post" action="/logout">
          <button className="secondary-action" type="submit">
            退出登录
          </button>
        </Form>
      }
    />
  );
}
