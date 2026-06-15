import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  Link,
  useActionData,
  useNavigation,
} from "react-router";
import { z } from "zod";

import {
  channelPresetFormSchema,
  getPreviewThemeLabel,
  previewThemeOptions,
  type PresetPreviewTheme,
} from "../preset-form.shared";
import type { ChannelPresetActionResult } from "../server/channel-presets.server";
import type {
  PresetDetailRouteViewModel,
  PresetEditRouteViewModel,
} from "../server/preset-routes.server";

type PresetEditorFormValues = z.input<typeof channelPresetFormSchema>;
type PresetEditorSubmitValues = z.output<typeof channelPresetFormSchema>;

function formatPresetTimestamp(isoString: string) {
  return isoString.replace("T", " ").replace(".000Z", " UTC");
}

function getPreviewSurfaceClass(theme: PresetPreviewTheme) {
  switch (theme) {
    case "cinema":
      return "preset-preview-surface preset-preview-surface-cinema";
    case "highContrast":
      return "preset-preview-surface preset-preview-surface-high-contrast";
    default:
      return "preset-preview-surface preset-preview-surface-classic";
  }
}

function PresetStylePreview(props: {
  displayName: string;
  subtitleTemplate: string;
  fontSize: number;
  theme: PresetPreviewTheme;
  readOnly: boolean;
}) {
  return (
    <section className="preset-preview-card">
      <div className="task-card-heading">
        <div>
          <p className="eyebrow">{props.readOnly ? "Read Only Preview" : "Live Preview"}</p>
          <h3>字幕样式预览</h3>
        </div>
        <span className={`status-pill ${props.readOnly ? "status-pill-neutral" : "status-pill-success"}`}>
          {props.readOnly ? "只读详情" : "编辑中"}
        </span>
      </div>
      <p className="intake-hint">
        当前预设默认模板为「{props.subtitleTemplate}」，任务创建时仍可临时覆盖，不会回写到此预设。
      </p>
      <div className={getPreviewSurfaceClass(props.theme)}>
        <div className="preset-preview-player">
          <div className="preset-preview-chrome">
            <span>{props.displayName}</span>
            <span>{getPreviewThemeLabel(props.theme)}</span>
          </div>
          <div
            className="preset-preview-caption"
            style={{ fontSize: `${props.fontSize}px` }}
          >
            <span>字幕预览示例：让常用频道规则更稳定地复用到后续任务。</span>
          </div>
        </div>
      </div>
      <div className="feedback-meta">
        <span>字号 {props.fontSize}px</span>
        <span>主题 {getPreviewThemeLabel(props.theme)}</span>
        <span>{props.readOnly ? "详情页不可修改" : "表单变更会实时反映到预览区"}</span>
      </div>
    </section>
  );
}

function PresetFieldSummary(props: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <section className="preset-detail-field">
      <p className="eyebrow">{props.label}</p>
      <h3>{props.value}</h3>
      {props.hint ? <p className="intake-hint">{props.hint}</p> : null}
    </section>
  );
}

export function PresetDetailScreen({
  loaderData,
}: {
  loaderData: PresetDetailRouteViewModel;
}) {
  const { preset, templateOverrideHint, justUpdated } = loaderData;

  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero">
        <p className="eyebrow">Preset Detail</p>
        <h1>{preset.displayName}</h1>
        <p className="lede">
          只读查看来源频道、默认规则与字幕样式预览。需要修改时，请进入独立编辑页完成保存。
        </p>
        <div className="decision-stack">
          <Link className="primary-action" to={`/presets/${preset.id}/edit`}>
            编辑预设
          </Link>
          <Link className="secondary-action" to="/presets">
            返回预设列表
          </Link>
        </div>
      </section>

      {justUpdated ? (
        <section className="inline-feedback inline-feedback-success">
          <p className="feedback-title">保存成功</p>
          <h3>预设已更新</h3>
          <p>最新默认规则已保存，后续命中该预设的新任务将使用这些默认值。</p>
        </section>
      ) : null}

      <section className="preset-detail-grid">
        <article className="shell-panel preset-list-card">
          <p className="eyebrow">Saved Defaults</p>
          <h2>默认规则概览</h2>
          <div className="preset-detail-stack">
            <PresetFieldSummary label="来源频道" value={preset.sourceIdentifier} />
            <PresetFieldSummary label="默认翻译方向" value={preset.defaults.translationMode} />
            <PresetFieldSummary label="默认字幕模板" value={preset.defaults.subtitleTemplate} />
            <PresetFieldSummary
              label="默认输出偏好"
              value={preset.defaults.outputPackage}
            />
            <PresetFieldSummary
              label="备注"
              value={preset.notes || "未填写备注"}
              hint={templateOverrideHint}
            />
          </div>
          <div className="feedback-meta">
            <span>创建于 {formatPresetTimestamp(preset.createdAt)}</span>
            <span>更新于 {formatPresetTimestamp(preset.updatedAt)}</span>
          </div>
        </article>

        <PresetStylePreview
          displayName={preset.displayName}
          subtitleTemplate={preset.defaults.subtitleTemplate}
          fontSize={preset.previewStyle.fontSize}
          theme={preset.previewStyle.theme}
          readOnly
        />
      </section>
    </main>
  );
}

function PresetEditFeedback({
  actionData,
}: {
  actionData: ChannelPresetActionResult | undefined;
}) {
  if (!actionData || actionData.ok) {
    return null;
  }

  return (
    <section className="inline-feedback inline-feedback-error" aria-live="polite">
      <p className="feedback-title">保存失败</p>
      <h3>预设尚未更新</h3>
      <p>{actionData.message}</p>
      <div className="feedback-meta">
        {actionData.field ? <span>字段：{actionData.field}</span> : null}
        <span>request_id: {actionData.request_id}</span>
      </div>
    </section>
  );
}

function ServerFieldError(props: {
  actionData: ChannelPresetActionResult | undefined;
  field: string;
}) {
  if (!props.actionData || props.actionData.ok || props.actionData.field !== props.field) {
    return null;
  }

  return <span className="field-error">{props.actionData.message}</span>;
}

function ClientFieldError(props: {
  message?: string;
}) {
  if (!props.message) {
    return null;
  }

  return <span className="field-error">{props.message}</span>;
}

export function PresetEditScreen({
  loaderData,
}: {
  loaderData: PresetEditRouteViewModel;
}) {
  const actionData = useActionData<ChannelPresetActionResult | undefined>();
  const navigation = useNavigation();
  const form = useForm<PresetEditorFormValues, undefined, PresetEditorSubmitValues>({
    resolver: zodResolver(channelPresetFormSchema),
    defaultValues: loaderData.formDefaults,
  });
  const watchedPreviewFontSize = form.watch("previewFontSize");
  const previewFontSize =
    typeof watchedPreviewFontSize === "number"
      ? watchedPreviewFontSize
      : loaderData.formDefaults.previewFontSize;
  const previewTheme =
    form.watch("previewTheme") ?? loaderData.formDefaults.previewTheme;

  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero">
        <p className="eyebrow">Preset Edit</p>
        <h1>编辑 {loaderData.preset.displayName}</h1>
        <p className="lede">
          在独立编辑页维护预设默认值和轻量字幕样式。任务级模板覆盖仍是另一层语义，不会写回本预设。
        </p>
        <div className="decision-stack">
          <Link className="secondary-action" to={`/presets/${loaderData.preset.id}`}>
            返回详情页
          </Link>
          <Link className="secondary-action" to="/presets">
            返回预设列表
          </Link>
        </div>
      </section>

      <section className="preset-detail-grid">
        <article className="shell-panel preset-form-card">
          <p className="eyebrow">Edit Form</p>
          <h2>更新默认规则</h2>
          <p className="intake-hint">{loaderData.templateOverrideHint}</p>
          <Form
            className="intake-form preset-edit-form"
            method="post"
            onSubmit={async (event) => {
              const isValid = await form.trigger();

              if (!isValid) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="update_channel_preset" />
            <input type="hidden" name="presetId" value={loaderData.preset.id} />
            <label className="field-label">
              来源频道标识
              <input
                className="text-input"
                {...form.register("sourceIdentifier")}
                name="sourceIdentifier"
              />
              <ClientFieldError message={form.formState.errors.sourceIdentifier?.message} />
              <ServerFieldError actionData={actionData} field="sourceIdentifier" />
            </label>
            <label className="field-label">
              预设名称
              <input
                className="text-input"
                {...form.register("displayName")}
                name="displayName"
              />
              <ClientFieldError message={form.formState.errors.displayName?.message} />
              <ServerFieldError actionData={actionData} field="displayName" />
            </label>
            <label className="field-label">
              默认翻译方向
              <input
                className="text-input"
                {...form.register("translationMode")}
                name="translationMode"
              />
              <ClientFieldError message={form.formState.errors.translationMode?.message} />
              <ServerFieldError actionData={actionData} field="translationMode" />
            </label>
            <label className="field-label">
              默认字幕模板
              <input
                className="text-input"
                {...form.register("subtitleTemplate")}
                name="subtitleTemplate"
              />
              <ClientFieldError message={form.formState.errors.subtitleTemplate?.message} />
              <ServerFieldError actionData={actionData} field="subtitleTemplate" />
            </label>
            <label className="field-label">
              默认输出偏好
              <input
                className="text-input"
                {...form.register("outputPackage")}
                name="outputPackage"
              />
              <ClientFieldError message={form.formState.errors.outputPackage?.message} />
              <ServerFieldError actionData={actionData} field="outputPackage" />
            </label>
            <label className="field-label">
              备注
              <textarea
                className="text-input preset-notes-input"
                rows={3}
                {...form.register("notes")}
                name="notes"
              />
              <ClientFieldError message={form.formState.errors.notes?.message} />
              <ServerFieldError actionData={actionData} field="notes" />
            </label>
            <div className="decision-form-grid">
              <label className="field-label">
                预览字号
                <input
                  className="text-input"
                  type="number"
                  min={24}
                  max={72}
                  {...form.register("previewFontSize", { valueAsNumber: true })}
                  name="previewFontSize"
                />
                <ClientFieldError message={form.formState.errors.previewFontSize?.message} />
                <ServerFieldError actionData={actionData} field="previewFontSize" />
              </label>
              <label className="field-label">
                预览主题
                <select
                  className="text-input"
                  {...form.register("previewTheme")}
                  name="previewTheme"
                >
                  {previewThemeOptions.map((theme) => (
                    <option key={theme} value={theme}>
                      {getPreviewThemeLabel(theme)}
                    </option>
                  ))}
                </select>
                <ClientFieldError message={form.formState.errors.previewTheme?.message} />
                <ServerFieldError actionData={actionData} field="previewTheme" />
              </label>
            </div>
            <button className="primary-action" type="submit">
              {navigation.state !== "idle" ? "保存中..." : "保存预设"}
            </button>
          </Form>
          <PresetEditFeedback actionData={actionData} />
        </article>

        <PresetStylePreview
          displayName={form.watch("displayName") || loaderData.preset.displayName}
          subtitleTemplate={
            form.watch("subtitleTemplate") || loaderData.preset.defaults.subtitleTemplate
          }
          fontSize={previewFontSize}
          theme={previewTheme}
          readOnly={false}
        />
      </section>
    </main>
  );
}
