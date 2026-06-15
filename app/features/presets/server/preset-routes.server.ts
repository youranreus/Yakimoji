import { data } from "react-router";

import {
  getChannelPresetByIdForUser,
  handleChannelPresetAction,
  listChannelPresetsForUser,
  type ChannelPresetActionResult,
  type ChannelPresetView,
} from "./channel-presets.server";
import { requireRole } from "../../auth/server/authz.server";
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

type PresetRouteRuntimeContext = {
  requestId: string;
  runtime: string;
  serviceName: string;
  user: {
    id: number;
    displayName: string;
    email: string;
  };
};

export type PresetListRouteViewModel = PresetRouteRuntimeContext & {
  channelPresets: ChannelPresetView[];
};

export type PresetDetailRouteViewModel = PresetRouteRuntimeContext & {
  preset: ChannelPresetView;
  templateOverrideHint: string;
  justUpdated: boolean;
};

export type PresetEditRouteViewModel = PresetRouteRuntimeContext & {
  preset: ChannelPresetView;
  formDefaults: {
    sourceIdentifier: string;
    displayName: string;
    translationMode: string;
    subtitleTemplate: string;
    outputPackage: string;
    notes: string;
    previewFontSize: number;
    previewTheme: ChannelPresetView["previewStyle"]["theme"];
  };
  templateOverrideHint: string;
};

type PresetRouteKind = "list" | "create" | "detail" | "edit";

function getTemplateOverrideHint() {
  return "任务创建时仍可临时覆盖字幕模板；这种任务级覆盖不会隐式回写到频道预设本身。";
}

export const presetRouteTestHooks = {
  requireUserSessionImpl: requireUserSession,
  requireRoleImpl: requireRole,
  listChannelPresetsForUserImpl: listChannelPresetsForUser,
  getChannelPresetByIdForUserImpl: getChannelPresetByIdForUser,
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
  presetRouteTestHooks.getChannelPresetByIdForUserImpl =
    hooks.getChannelPresetByIdForUserImpl ?? getChannelPresetByIdForUser;
  presetRouteTestHooks.handleChannelPresetActionImpl =
    hooks.handleChannelPresetActionImpl ?? handleChannelPresetAction;
}

async function requirePresetCreatorSession(
  request: Request,
  routeKind: PresetRouteKind,
) {
  const authenticated = (await presetRouteTestHooks.requireUserSessionImpl(
    request,
  )) as AuthenticatedSession;

  await presetRouteTestHooks.requireRoleImpl(authenticated, "creator", {
    type: "channel_preset",
    id: `preset-${routeKind}`,
  });

  return authenticated;
}

function mapRuntimeContext(
  authenticated: AuthenticatedSession,
  context: PresetRouteContext,
): PresetRouteRuntimeContext {
  return {
    requestId: context.requestId,
    runtime: context.releaseStage,
    serviceName: context.serviceName,
    user: {
      id: authenticated.user.id,
      displayName: authenticated.user.displayName,
      email: authenticated.user.email,
    },
  };
}

function createPresetForbiddenError(message: string): never {
  const { requestId } = getRequestContext();

  throw data(
    {
      code: "channel_preset_forbidden",
      message,
      request_id: requestId,
    },
    {
      status: 403,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

function isDataErrorLike(error: unknown): error is {
  data?: unknown;
  init?: { status?: number };
  constructor?: { name?: string };
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "constructor" in error &&
    (error as { constructor?: { name?: string } }).constructor?.name ===
      "DataWithResponseInit"
  );
}

function shouldReturnInlineActionData(error: {
  init?: { status?: number };
}) {
  return error.init?.status != null && error.init.status < 400
    ? false
    : error.init?.status === 400 || error.init?.status === 409;
}

export async function loadPresetRouteViewModel(args: {
  request: Request;
  context: PresetRouteContext;
}): Promise<PresetListRouteViewModel> {
  const authenticated = await requirePresetCreatorSession(args.request, "list");

  return {
    ...mapRuntimeContext(authenticated, args.context),
    channelPresets: await presetRouteTestHooks.listChannelPresetsForUserImpl(
      authenticated.user.id,
    ),
  };
}

export async function loadPresetDetailRouteViewModel(args: {
  request: Request;
  context: PresetRouteContext;
  presetId: string;
}): Promise<PresetDetailRouteViewModel> {
  const authenticated = await requirePresetCreatorSession(args.request, "detail");
  const preset = await presetRouteTestHooks.getChannelPresetByIdForUserImpl(
    authenticated.user.id,
    args.presetId,
  );

  if (!preset) {
    createPresetForbiddenError("当前账号无权访问该频道预设详情，或预设不存在。");
  }

  const url = new URL(args.request.url);

  return {
    ...mapRuntimeContext(authenticated, args.context),
    preset,
    templateOverrideHint: getTemplateOverrideHint(),
    justUpdated: url.searchParams.get("updated") === "1",
  };
}

export async function loadPresetEditRouteViewModel(args: {
  request: Request;
  context: PresetRouteContext;
  presetId: string;
}): Promise<PresetEditRouteViewModel> {
  const authenticated = await requirePresetCreatorSession(args.request, "edit");
  const preset = await presetRouteTestHooks.getChannelPresetByIdForUserImpl(
    authenticated.user.id,
    args.presetId,
  );

  if (!preset) {
    createPresetForbiddenError("当前账号无权访问该频道预设编辑页，或预设不存在。");
  }

  return {
    ...mapRuntimeContext(authenticated, args.context),
    preset,
    formDefaults: {
      sourceIdentifier: preset.sourceIdentifier,
      displayName: preset.displayName,
      translationMode: preset.defaults.translationMode,
      subtitleTemplate: preset.defaults.subtitleTemplate,
      outputPackage: preset.defaults.outputPackage,
      notes: preset.notes ?? "",
      previewFontSize: preset.previewStyle.fontSize,
      previewTheme: preset.previewStyle.theme,
    },
    templateOverrideHint: getTemplateOverrideHint(),
  };
}

export async function handlePresetCreateRouteAction(request: Request) {
  const authenticated = await requirePresetCreatorSession(request, "create");
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

  try {
    return await presetRouteTestHooks.handleChannelPresetActionImpl(
      authenticated.user.id,
      formData,
    );
  } catch (error) {
    if (isDataErrorLike(error) && shouldReturnInlineActionData(error)) {
      return error.data as ChannelPresetActionResult;
    }

    throw error;
  }
}

export async function handlePresetEditRouteAction(args: {
  request: Request;
  presetId: string;
}) {
  const authenticated = await requirePresetCreatorSession(args.request, "edit");
  const formData = await args.request.formData();

  if (!formData.get("presetId")) {
    formData.set("presetId", args.presetId);
  }

  formData.set("intent", "update_channel_preset");

  try {
    return await presetRouteTestHooks.handleChannelPresetActionImpl(
      authenticated.user.id,
      formData,
    );
  } catch (error) {
    if (isDataErrorLike(error) && shouldReturnInlineActionData(error)) {
      return error.data as ChannelPresetActionResult;
    }

    throw error;
  }
}
