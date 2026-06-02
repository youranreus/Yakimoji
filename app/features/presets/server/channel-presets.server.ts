import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { data } from "react-router";
import { z } from "zod";

import { database } from "../../../../database/context";
import { channelPresets } from "../../../../database/schema";
import { getRequestContext } from "../../auth/server/request-context.server";

const presetInputSchema = z.object({
  sourceIdentifier: z
    .string()
    .trim()
    .min(3, "请输入可识别的来源频道标识。")
    .max(320, "来源频道标识过长。"),
  displayName: z
    .string()
    .trim()
    .min(1, "请输入预设名称。")
    .max(160, "预设名称过长。"),
  translationMode: z
    .string()
    .trim()
    .min(1, "请选择或填写默认翻译方向。")
    .max(120, "默认翻译方向过长。"),
  subtitleTemplate: z
    .string()
    .trim()
    .min(1, "请选择或填写默认字幕模板。")
    .max(160, "默认字幕模板过长。"),
  outputPackage: z
    .string()
    .trim()
    .min(1, "请选择或填写默认输出偏好。")
    .max(120, "默认输出偏好过长。"),
  notes: z.string().trim().max(500, "备注过长。").optional(),
});

type ChannelPresetRow = {
  id: string;
  ownerUserId: number;
  sourceIdentifier: string;
  displayName: string;
  translationMode: string;
  subtitleTemplate: string;
  outputPackage: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type PresetInput = z.infer<typeof presetInputSchema>;

export type ChannelPresetView = {
  id: string;
  sourceIdentifier: string;
  displayName: string;
  summary: string;
  defaults: {
    translationMode: string;
    subtitleTemplate: string;
    outputPackage: string;
  };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelPresetActionResult =
  | {
      ok: true;
      resource: "channel_preset";
      mode: "created" | "updated";
      requestId: string;
      preset: ChannelPresetView;
    }
  | {
      ok: false;
      resource: "channel_preset";
      code: string;
      message: string;
      field?: string;
      request_id: string;
    };

export const channelPresetTestHooks = {
  listRowsForUserImpl: listRowsForUser,
  findRowBySourceImpl: findRowBySource,
  findRowByIdImpl: findRowById,
  insertRowImpl: insertRow,
  updateRowForUserImpl: updateRowForUser,
};

export function setChannelPresetTestHooks(
  hooks: Partial<typeof channelPresetTestHooks>,
) {
  channelPresetTestHooks.listRowsForUserImpl =
    hooks.listRowsForUserImpl ?? listRowsForUser;
  channelPresetTestHooks.findRowBySourceImpl =
    hooks.findRowBySourceImpl ?? findRowBySource;
  channelPresetTestHooks.findRowByIdImpl =
    hooks.findRowByIdImpl ?? findRowById;
  channelPresetTestHooks.insertRowImpl = hooks.insertRowImpl ?? insertRow;
  channelPresetTestHooks.updateRowForUserImpl =
    hooks.updateRowForUserImpl ?? updateRowForUser;
}

function getFieldError(error: z.ZodError<PresetInput>) {
  const issue = error.issues[0];

  return {
    field: issue?.path[0] ? String(issue.path[0]) : undefined,
    message: issue?.message ?? "预设表单内容无效。",
  };
}

function createPresetActionError(
  code: string,
  message: string,
  options: {
    field?: string;
    status?: number;
  } = {},
): never {
  const { requestId } = getRequestContext();

  throw data(
    {
      ok: false,
      resource: "channel_preset",
      code,
      message,
      field: options.field,
      request_id: requestId,
    } satisfies ChannelPresetActionResult,
    {
      status: options.status ?? 400,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

function parsePresetInput(formData: FormData): PresetInput {
  const parsed = presetInputSchema.safeParse({
    sourceIdentifier: formData.get("sourceIdentifier"),
    displayName: formData.get("displayName"),
    translationMode: formData.get("translationMode"),
    subtitleTemplate: formData.get("subtitleTemplate"),
    outputPackage: formData.get("outputPackage"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    const fieldError = getFieldError(parsed.error);

    createPresetActionError("channel_preset_invalid", fieldError.message, {
      field: fieldError.field,
    });
  }

  return parsed.data;
}

function mapPresetView(row: ChannelPresetRow): ChannelPresetView {
  return {
    id: row.id,
    sourceIdentifier: row.sourceIdentifier,
    displayName: row.displayName,
    summary: `${row.translationMode} / ${row.subtitleTemplate} / ${row.outputPackage}`,
    defaults: {
      translationMode: row.translationMode,
      subtitleTemplate: row.subtitleTemplate,
      outputPackage: row.outputPackage,
    },
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function listRowsForUser(ownerUserId: number): Promise<ChannelPresetRow[]> {
  const db = database();
  const records = await db
    .select({
      id: channelPresets.id,
      ownerUserId: channelPresets.ownerUserId,
      sourceIdentifier: channelPresets.sourceIdentifier,
      displayName: channelPresets.displayName,
      translationMode: channelPresets.translationMode,
      subtitleTemplate: channelPresets.subtitleTemplate,
      outputPackage: channelPresets.outputPackage,
      notes: channelPresets.notes,
      metadata: channelPresets.metadata,
      createdAt: channelPresets.createdAt,
      updatedAt: channelPresets.updatedAt,
    })
    .from(channelPresets)
    .where(eq(channelPresets.ownerUserId, ownerUserId))
    .orderBy(desc(channelPresets.updatedAt));

  return records as ChannelPresetRow[];
}

async function findRowBySource(
  ownerUserId: number,
  sourceIdentifier: string,
): Promise<ChannelPresetRow | null> {
  const db = database();
  const [record] = await db
    .select({
      id: channelPresets.id,
      ownerUserId: channelPresets.ownerUserId,
      sourceIdentifier: channelPresets.sourceIdentifier,
      displayName: channelPresets.displayName,
      translationMode: channelPresets.translationMode,
      subtitleTemplate: channelPresets.subtitleTemplate,
      outputPackage: channelPresets.outputPackage,
      notes: channelPresets.notes,
      metadata: channelPresets.metadata,
      createdAt: channelPresets.createdAt,
      updatedAt: channelPresets.updatedAt,
    })
    .from(channelPresets)
    .where(
      and(
        eq(channelPresets.ownerUserId, ownerUserId),
        eq(channelPresets.sourceIdentifier, sourceIdentifier),
      ),
    )
    .limit(1);

  return (record as ChannelPresetRow | undefined) ?? null;
}

async function findRowById(
  ownerUserId: number,
  presetId: string,
): Promise<ChannelPresetRow | null> {
  const db = database();
  const [record] = await db
    .select({
      id: channelPresets.id,
      ownerUserId: channelPresets.ownerUserId,
      sourceIdentifier: channelPresets.sourceIdentifier,
      displayName: channelPresets.displayName,
      translationMode: channelPresets.translationMode,
      subtitleTemplate: channelPresets.subtitleTemplate,
      outputPackage: channelPresets.outputPackage,
      notes: channelPresets.notes,
      metadata: channelPresets.metadata,
      createdAt: channelPresets.createdAt,
      updatedAt: channelPresets.updatedAt,
    })
    .from(channelPresets)
    .where(
      and(
        eq(channelPresets.ownerUserId, ownerUserId),
        eq(channelPresets.id, presetId),
      ),
    )
    .limit(1);

  return (record as ChannelPresetRow | undefined) ?? null;
}

async function insertRow(
  ownerUserId: number,
  input: PresetInput,
): Promise<ChannelPresetRow> {
  const db = database();
  const now = new Date();
  const [record] = await db
    .insert(channelPresets)
    .values({
      id: `preset_${randomUUID().replace(/-/g, "")}`,
      ownerUserId,
      sourceIdentifier: input.sourceIdentifier,
      displayName: input.displayName,
      translationMode: input.translationMode,
      subtitleTemplate: input.subtitleTemplate,
      outputPackage: input.outputPackage,
      notes: input.notes || null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!record) {
    throw new Error("Failed to create channel preset");
  }

  return record as ChannelPresetRow;
}

async function updateRowForUser(
  ownerUserId: number,
  presetId: string,
  input: PresetInput,
): Promise<ChannelPresetRow | null> {
  const db = database();
  const [record] = await db
    .update(channelPresets)
    .set({
      sourceIdentifier: input.sourceIdentifier,
      displayName: input.displayName,
      translationMode: input.translationMode,
      subtitleTemplate: input.subtitleTemplate,
      outputPackage: input.outputPackage,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelPresets.id, presetId),
        eq(channelPresets.ownerUserId, ownerUserId),
      ),
    )
    .returning();

  return (record as ChannelPresetRow | undefined) ?? null;
}

export async function listChannelPresetsForUser(ownerUserId: number) {
  const rows = await channelPresetTestHooks.listRowsForUserImpl(ownerUserId);

  return rows.map(mapPresetView);
}

export async function findChannelPresetForSource(
  ownerUserId: number,
  sourceIdentifier: string,
) {
  const row = await channelPresetTestHooks.findRowBySourceImpl(
    ownerUserId,
    sourceIdentifier,
  );

  return row ? mapPresetView(row) : null;
}

export async function getChannelPresetByIdForUser(
  ownerUserId: number,
  presetId: string,
) {
  const row = await channelPresetTestHooks.findRowByIdImpl(
    ownerUserId,
    presetId,
  );

  return row ? mapPresetView(row) : null;
}

export async function createChannelPreset(
  ownerUserId: number,
  formData: FormData,
) {
  const input = parsePresetInput(formData);
  const existing = await channelPresetTestHooks.findRowBySourceImpl(
    ownerUserId,
    input.sourceIdentifier,
  );

  if (existing) {
    createPresetActionError(
      "channel_preset_duplicate",
      "该来源频道已经有预设，请直接编辑已有预设。",
      { field: "sourceIdentifier", status: 409 },
    );
  }

  const row = await channelPresetTestHooks.insertRowImpl(ownerUserId, input);

  return mapPresetView(row);
}

export async function updateChannelPreset(
  ownerUserId: number,
  presetId: string,
  formData: FormData,
) {
  const input = parsePresetInput(formData);
  const row = await channelPresetTestHooks.updateRowForUserImpl(
    ownerUserId,
    presetId,
    input,
  );

  if (!row) {
    createPresetActionError(
      "channel_preset_forbidden",
      "当前账号无权修改该频道预设，或预设不存在。",
      { status: 403 },
    );
  }

  return mapPresetView(row);
}

export async function handleChannelPresetAction(
  ownerUserId: number,
  formData: FormData,
): Promise<ChannelPresetActionResult> {
  const intent = formData.get("intent");
  const { requestId } = getRequestContext();

  if (intent === "create_channel_preset") {
    const preset = await createChannelPreset(ownerUserId, formData);

    return {
      ok: true,
      resource: "channel_preset",
      mode: "created",
      requestId,
      preset,
    };
  }

  if (intent === "update_channel_preset") {
    const presetId = formData.get("presetId");

    if (typeof presetId !== "string" || !presetId.trim()) {
      createPresetActionError(
        "channel_preset_invalid",
        "缺少要更新的频道预设。",
        { field: "presetId" },
      );
    }

    const preset = await updateChannelPreset(ownerUserId, presetId, formData);

    return {
      ok: true,
      resource: "channel_preset",
      mode: "updated",
      requestId,
      preset,
    };
  }

  createPresetActionError("channel_preset_invalid_intent", "预设操作无效。");
}
