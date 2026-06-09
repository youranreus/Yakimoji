import { useFetcher } from "react-router";

import type {
  ChannelPresetActionResult,
  ChannelPresetView,
} from "../server/channel-presets.server";

type ChannelPresetWorkbenchProps = {
  presets: ChannelPresetView[];
};

const defaultValues = {
  translationMode: "中译中字幕",
  subtitleTemplate: "标准 Shorts 模板",
  outputPackage: "mp4 + srt",
};

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
    </section>
  );
}

export function ChannelPresetWorkbench({
  presets,
}: ChannelPresetWorkbenchProps) {
  const createFetcher = useFetcher<ChannelPresetActionResult>();

  return (
    <article className="shell-panel preset-workbench" id="presets">
      <div className="intake-panel-header">
        <div>
          <p className="eyebrow">Channel Presets</p>
          <h2>频道预设</h2>
        </div>
        <p className="intake-hint">
          为常用来源沉淀默认翻译方向、字幕模板和输出偏好。
        </p>
      </div>

      <div className="preset-grid">
        <section className="preset-form-card">
          <p className="eyebrow">New Preset</p>
          <h3>创建来源频道预设</h3>
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
            </label>
            <label className="field-label">
              预设名称
              <input
                className="text-input"
                name="displayName"
                placeholder="Kurzgesagt 中文频道"
                required
              />
            </label>
            <label className="field-label">
              默认翻译方向
              <input
                className="text-input"
                name="translationMode"
                defaultValue={defaultValues.translationMode}
                required
              />
            </label>
            <label className="field-label">
              默认字幕模板
              <input
                className="text-input"
                name="subtitleTemplate"
                defaultValue={defaultValues.subtitleTemplate}
                required
              />
            </label>
            <label className="field-label">
              默认输出偏好
              <input
                className="text-input"
                name="outputPackage"
                defaultValue={defaultValues.outputPackage}
                required
              />
            </label>
            <label className="field-label">
              备注
              <textarea
                className="text-input preset-notes-input"
                name="notes"
                placeholder="可选：只记录对后续创作有帮助的信息"
                rows={3}
              />
            </label>
            <button className="primary-action" type="submit">
              {createFetcher.state !== "idle" ? "保存中..." : "创建预设"}
            </button>
          </createFetcher.Form>
          <PresetFeedback result={createFetcher.data} />
        </section>

        <section className="preset-list-card">
          <p className="eyebrow">Saved Presets</p>
          <h3>已维护预设</h3>
          {presets.length === 0 ? (
            <div className="task-empty-state preset-empty-state">
              <h4>还没有频道预设</h4>
              <p>创建第一个预设后，熟悉来源任务就能复用这里的默认规则。</p>
            </div>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <PresetRow key={preset.id} preset={preset} />
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function PresetRow({ preset }: { preset: ChannelPresetView }) {
  const updateFetcher = useFetcher<ChannelPresetActionResult>();

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
      </dl>
      <updateFetcher.Form method="post" className="preset-edit-form">
        <input type="hidden" name="intent" value="update_channel_preset" />
        <input type="hidden" name="presetId" value={preset.id} />
        <input
          type="hidden"
          name="sourceIdentifier"
          value={preset.sourceIdentifier}
        />
        <label className="field-label">
          预设名称
          <input
            className="text-input"
            name="displayName"
            defaultValue={preset.displayName}
            required
          />
        </label>
        <label className="field-label">
          默认翻译方向
          <input
            className="text-input"
            name="translationMode"
            defaultValue={preset.defaults.translationMode}
            required
          />
        </label>
        <label className="field-label">
          默认字幕模板
          <input
            className="text-input"
            name="subtitleTemplate"
            defaultValue={preset.defaults.subtitleTemplate}
            required
          />
        </label>
        <label className="field-label">
          默认输出偏好
          <input
            className="text-input"
            name="outputPackage"
            defaultValue={preset.defaults.outputPackage}
            required
          />
        </label>
        <label className="field-label">
          备注
          <textarea
            className="text-input preset-notes-input"
            name="notes"
            defaultValue={preset.notes ?? ""}
            rows={2}
          />
        </label>
        <button className="secondary-action" type="submit">
          {updateFetcher.state !== "idle" ? "更新中..." : "保存修改"}
        </button>
      </updateFetcher.Form>
      <PresetFeedback result={updateFetcher.data} />
    </section>
  );
}
