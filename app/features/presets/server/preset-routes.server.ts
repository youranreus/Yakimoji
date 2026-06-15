import {
  handleChannelPresetAction,
  listChannelPresetsForUser,
  type ChannelPresetView,
} from "./channel-presets.server";
import { requireRole } from "../../auth/server/authz.server";
import { data } from "react-router";
import { getRequestContext } from "../../auth/server/request-context.server";
import {
  requireUserSession,
  type AuthenticatedSession,
} from "../../auth/server/session.server";

type PresetRouteContext = {
  requestId: string;
  releaseStage: string;
  serviceName: string;
};

export type PresetRouteViewModel = {
  requestId: string;
  runtime: string;
  serviceName: string;
  user: {
    id: number;
    displayName: string;
    email: string;
  };
  channelPresets: ChannelPresetView[];
};

export const presetRouteTestHooks = {
  requireUserSessionImpl: requireUserSession,
  requireRoleImpl: requireRole,
  listChannelPresetsForUserImpl: listChannelPresetsForUser,
  handleChannelPresetActionImpl: handleChannelPresetAction,
};

export function setPresetRouteTestHooks(
  hooks: Partial<typeof presetRouteTestHooks>,
) {
  presetRouteTestHooks.requireUserSessionImpl =
    hooks.requireUserSessionImpl ?? requireUserSession;
  presetRouteTestHooks.requireRoleImpl =
    hooks.requireRoleImpl ?? requireRole;
  presetRouteTestHooks.listChannelPresetsForUserImpl =
    hooks.listChannelPresetsForUserImpl ?? listChannelPresetsForUser;
  presetRouteTestHooks.handleChannelPresetActionImpl =
    hooks.handleChannelPresetActionImpl ?? handleChannelPresetAction;
}

export async function loadPresetRouteViewModel(args: {
  request: Request;
  context: PresetRouteContext;
}) {
  const authenticated = (await presetRouteTestHooks.requireUserSessionImpl(
    args.request,
  )) as AuthenticatedSession;

  await presetRouteTestHooks.requireRoleImpl(authenticated, "creator", {
    type: "channel_preset",
    id: "preset-list",
  });

  return {
    requestId: args.context.requestId,
    runtime: args.context.releaseStage,
    serviceName: args.context.serviceName,
    user: {
      id: authenticated.user.id,
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
    },
    channelPresets: await presetRouteTestHooks.listChannelPresetsForUserImpl(
      authenticated.user.id,
    ),
  } satisfies PresetRouteViewModel;
}

export async function handlePresetRouteAction(request: Request) {
  const authenticated = (await presetRouteTestHooks.requireUserSessionImpl(
    request,
  )) as AuthenticatedSession;

  await presetRouteTestHooks.requireRoleImpl(authenticated, "creator", {
    type: "channel_preset",
    id: "preset-create",
  });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "create_channel_preset") {
    const { requestId } = getRequestContext();

    throw data(
      {
        ok: false,
        resource: "channel_preset",
        code: "channel_preset_invalid_intent",
        message: "当前入口只支持创建最小预设。",
        request_id: requestId,
      },
      {
        status: 400,
        headers: {
          "X-Request-Id": requestId,
        },
      },
    );
  }

  return presetRouteTestHooks.handleChannelPresetActionImpl(
    authenticated.user.id,
    formData,
  );
}
