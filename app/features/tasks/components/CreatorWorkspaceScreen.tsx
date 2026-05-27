import { Form, useActionData } from "react-router";

import { ChannelPresetWorkbench } from "~/features/presets/components/ChannelPresetWorkbench";
import type { ChannelPresetActionResult } from "~/features/presets/server/channel-presets.server";
import { WorkspaceShell } from "~/shared/ui/WorkspaceShell";

import type { TaskIntakeActionResult } from "../server/task-intake.server";
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
  const taskActionData =
    actionData &&
    ((actionData.ok && !("resource" in actionData)) ||
      (!actionData.ok && !("resource" in actionData)))
      ? actionData
      : null;

  return (
    <WorkspaceShell
      runtime={loaderData.runtime}
      serviceName={loaderData.serviceName}
      requestId={loaderData.requestId}
      user={loaderData.user}
      roles={loaderData.roles}
      navigation={loaderData.navigation}
      panels={loaderData.panels}
      actionData={taskActionData}
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
