import { Link, useFetcher } from "react-router";

import type {
  ChannelPresetActionResult,
  ChannelPresetView,
} from "../server/channel-presets.server";
import { defaultPresetFormValues } from "../preset-form.shared";

type ChannelPresetWorkbenchProps = {
  mode: "workspace" | "list" | "create";
  presets: ChannelPresetView[];
};

function formatPresetTimestamp(isoString: string) {
  return isoString.replace("T", " ").replace(".000Z", " UTC");
}

function PresetFeedback({
  result,
}: {
  result: ChannelPresetActionResult | undefined;
}) {
  if (!result) {
    return null;
  }

  if (result.ok) {
    return (
      <section className="inline-feedback inline-feedback-success" aria-live="polite">
        <p className="feedback-title">预设已保存</p>
        <h3>{result.mode === "created" ? "频道预设已创建" : "频道预设已更新"}</h3>
        <p>{result.preset.displayName} 将作为后续熟悉来源任务的默认规则来源。</p>
        <div className="feedback-meta">
          <span>{result.preset.summary}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="inline-feedback inline-feedback-error" aria-live="polite">
      <p className="feedback-title">预设未保存</p>
      <h3>频道预设未保存</h3>
      <p>{result.message}</p>
      {result.field ? <p className="field-error">请检查字段：{result.field}</p> : null}
    </section>
  );
}

function PresetRow({ preset }: { preset: ChannelPresetView }) {
  return (
    <section className="preset-row">
      <div className="task-card-heading">
        <div>
          <h4>{preset.displayName}</h4>
          <p className="task-card-subtitle">{preset.sourceIdentifier}</p>
        </div>
        <span className="status-pill status-pill-success">可复用</span>
      </div>
      <dl className="preset-summary-list">
        <div>
          <dt>翻译方向</dt>
          <dd>{preset.defaults.translationMode}</dd>
        </div>
        <div>
          <dt>字幕模板</dt>
          <dd>{preset.defaults.subtitleTemplate}</dd>
        </div>
        <div>
          <dt>输出偏好</dt>
          <dd>{preset.defaults.outputPackage}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{formatPresetTimestamp(preset.updatedAt)}</dd>
        </div>
      </dl>
      {preset.notes ? <p className="task-card-subtitle">{preset.notes}</p> : null}
      <div className="preset-row-actions">
        <Link className="secondary-action" to={`/presets/${preset.id}`}>
          查看详情
        </Link>
        <Link className="secondary-action" to={`/presets/${preset.id}/edit`}>
          编辑预设
        </Link>
      </div>
    </section>
  );
}

function PresetList({
  presets,
  compact,
}: {
  presets: ChannelPresetView[];
  compact?: boolean;
}) {
  if (presets.length === 0) {
    return (
      <div className="task-empty-state preset-empty-state">
        <h4>还没有频道预设</h4>
        <p>创建第一个预设后，熟悉来源任务就能复用这里的默认规则。</p>
      </div>
    );
  }

  const visiblePresets = compact ? presets.slice(0, 3) : presets;

  return (
    <>
      <div className="preset-list">
        {visiblePresets.map((preset) => (
          <PresetRow key={preset.id} preset={preset} />
        ))}
      </div>
      {compact && presets.length > visiblePresets.length ? (
        <p className="field-hint">还有 {presets.length - visiblePresets.length} 个预设，前往列表查看全部。</p>
      ) : null}
    </>
  );
}

function PresetCreateForm() {
  const createFetcher = useFetcher<ChannelPresetActionResult>();

  return (
    <section className="preset-form-card">
      <p className="eyebrow">New Preset</p>
      <h3>创建来源频道预设</h3>
      <p className="intake-hint">
        只填写最小默认规则，后续详情编辑和模板预览由独立故事承接。
      </p>
      <createFetcher.Form method="post" className="intake-form">
        <input type="hidden" name="intent" value="create_channel_preset" />
        <label className="field-label">
          来源频道标识
          <input
            className="text-input"
            name="sourceIdentifier"
            placeholder="youtube:KurzgesagtCN"
            required
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "sourceIdentifier" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <label className="field-label">
          预设名称
          <input
            className="text-input"
            name="displayName"
            placeholder="Kurzgesagt 中文频道"
            required
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "displayName" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <label className="field-label">
          默认翻译方向
          <input
            className="text-input"
            name="translationMode"
            defaultValue={defaultPresetFormValues.translationMode}
            required
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "translationMode" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <label className="field-label">
          默认字幕模板
          <input
            className="text-input"
            name="subtitleTemplate"
            defaultValue={defaultPresetFormValues.subtitleTemplate}
            required
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "subtitleTemplate" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <label className="field-label">
          默认输出偏好
          <input
            className="text-input"
            name="outputPackage"
            defaultValue={defaultPresetFormValues.outputPackage}
            required
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "outputPackage" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <label className="field-label">
          备注
          <textarea
            className="text-input preset-notes-input"
            name="notes"
            placeholder="可选：只记录对后续创作有帮助的信息"
            rows={3}
          />
          {createFetcher.data && !createFetcher.data.ok && createFetcher.data.field === "notes" ? (
            <span className="field-error">{createFetcher.data.message}</span>
          ) : null}
        </label>
        <input
          type="hidden"
          name="previewFontSize"
          value={String(defaultPresetFormValues.previewFontSize)}
        />
        <input
          type="hidden"
          name="previewTheme"
          value={defaultPresetFormValues.previewTheme}
        />
        <button className="primary-action" type="submit">
          {createFetcher.state !== "idle" ? "保存中..." : "创建预设"}
        </button>
      </createFetcher.Form>
      <PresetFeedback result={createFetcher.data} />
    </section>
  );
}

function WorkspacePresetSummary({ presets }: { presets: ChannelPresetView[] }) {
  return (
    <article className="shell-panel preset-workbench" id="presets">
      <div className="intake-panel-header">
        <div>
          <p className="eyebrow">Channel Presets</p>
          <h2>频道预设</h2>
        </div>
        <p className="intake-hint">
          工作台仅保留摘要和入口，完整列表与最小创建流程已迁移到独立页面。
        </p>
      </div>

      <div className="preset-grid">
        <section className="preset-list-card">
          <p className="eyebrow">Preset Overview</p>
          <h3>已维护预设摘要</h3>
          <PresetList presets={presets} compact />
        </section>

        <section className="preset-form-card">
          <p className="eyebrow">Next Step</p>
          <h3>进入独立预设入口</h3>
          <p className="intake-copy">
            在独立列表查看全部预设，或进入最小创建流程建立新的来源默认规则。
          </p>
          <div className="decision-stack">
            <Link className="primary-action" to="/presets">
              查看全部预设
            </Link>
            <Link className="secondary-action" to="/presets/new">
              创建最小预设
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}

function PresetListScreen({ presets }: { presets: ChannelPresetView[] }) {
  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero">
        <p className="eyebrow">Preset List</p>
        <h1>频道预设</h1>
        <p className="lede">
          查看当前创作者已维护的频道预设摘要，后续任务和自动命中能力都会复用这些默认规则。
        </p>
        <div className="decision-stack">
          <Link className="primary-action" to="/presets/new">
            创建最小预设
          </Link>
          <Link className="secondary-action" to="/workspace">
            返回工作台
          </Link>
        </div>
        <p className="field-hint">
          详情页用于只读确认规则，编辑页用于维护默认值与字幕预览，避免把查看和修改混在同一块工作台里。
        </p>
      </section>

      <section className="shell-grid workspace-bottom-grid">
        <div className="workspace-panel-slot workspace-panel-slot-list">
          <article className="shell-panel preset-list-card">
            <p className="eyebrow">Saved Presets</p>
            <h2>预设摘要列表</h2>
            <PresetList presets={presets} />
          </article>
        </div>
      </section>
    </main>
  );
}

function PresetCreateScreen({ presets }: { presets: ChannelPresetView[] }) {
  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero">
        <p className="eyebrow">Minimal Create</p>
        <h1>创建最小预设</h1>
        <p className="lede">
          仅保存来源频道、翻译方向、字幕模板和输出偏好，不在这里展开复杂编辑器。
        </p>
        <div className="decision-stack">
          <Link className="secondary-action" to="/presets">
            返回预设列表
          </Link>
          <Link className="secondary-action" to="/workspace">
            返回工作台
          </Link>
        </div>
      </section>

      <section className="preset-grid">
        <PresetCreateForm />
        <section className="preset-list-card shell-panel">
          <p className="eyebrow">Existing Presets</p>
          <h3>已维护预设摘要</h3>
          <PresetList presets={presets} compact />
        </section>
      </section>
    </main>
  );
}

export function ChannelPresetWorkbench({
  mode,
  presets,
}: ChannelPresetWorkbenchProps) {
  if (mode === "workspace") {
    return <WorkspacePresetSummary presets={presets} />;
  }

  if (mode === "create") {
    return <PresetCreateScreen presets={presets} />;
  }

  return <PresetListScreen presets={presets} />;
}
