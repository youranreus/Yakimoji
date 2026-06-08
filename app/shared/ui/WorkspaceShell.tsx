import { useId } from "react";
import { useFetcher } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { subtitleTemplateOverrideOptions } from "../../features/tasks/task-intake.shared";

type TaskPreviewPayload = {
  ok: true;
  mode: "preview";
  intakeMethod: "youtube_link";
  draftToken: string;
  requestId: string;
  status: string;
  source: {
    identifier: string;
    title: string;
    recognitionMode: "youtube_link";
    confidence: "high";
    previewLabel: string;
  };
  baseline: {
    translationMode: string;
    subtitleTemplate: string;
    outputPackage: string;
  };
  presetMatch: TaskPresetMatch;
};

type TaskCreatedPayload = {
  ok: true;
  mode: "created";
  requestId: string;
  task: {
    id: string;
    status: string;
    intakeMethod: "youtube_link" | "video_upload";
    sourceIdentifier: string;
    sourceTitle: string;
    baselineSummary: string;
    presetMatch: TaskPresetMatch;
    createdAt: string;
  };
};

type TaskPresetMatch =
  | {
      status: "matched";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: {
        translationMode: string;
        subtitleTemplate: string;
        outputPackage: string;
      };
    }
  | {
      status: "unresolved";
      sourceIdentifier: string;
      summary: string;
    }
  | {
      status: "manual_reuse";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: {
        translationMode: string;
        subtitleTemplate: string;
        outputPackage: string;
      };
    }
  | {
      status: "manual_create";
      presetId: string;
      displayName: string;
      sourceIdentifier: string;
      appliedPresetSourceIdentifier: string;
      summary: string;
      defaults: {
        translationMode: string;
        subtitleTemplate: string;
        outputPackage: string;
      };
    }
  | {
      status: "continue_without_preset";
      sourceIdentifier: string;
      summary: string;
    };

type TaskErrorPayload = {
  ok: false;
  code: string;
  message: string;
  field?: string;
  retryable?: boolean;
  request_id: string;
};

type WorkspaceFetcherData =
  | TaskPreviewPayload
  | TaskCreatedPayload
  | TaskErrorPayload
  | null
  | undefined;

type WorkspaceShellProps = {
  workspaceMode: "creator" | "support";
  runtime: string;
  serviceName: string;
  requestId: string;
  user: {
    displayName: string;
    email: string;
  };
  roles: string[];
  navigation: Array<{
    label: string;
    href: string;
    state: "active" | "coming-soon";
  }>;
  panels: Array<{
    title: string;
    body: string;
  }>;
  actionData: TaskPreviewPayload | TaskCreatedPayload | TaskErrorPayload | null;
  channelPresets: Array<{
    id: string;
    displayName: string;
    sourceIdentifier: string;
    summary: string;
  }>;
  presetPanel: React.ReactNode;
  taskListPanel: React.ReactNode;
  taskDetailPanel: React.ReactNode;
  logoutForm: React.ReactNode;
};

const youtubeSchema = z.object({
  sourceUrl: z.url("请输入有效的 YouTube 链接。"),
});

function formatSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewPresetHeading(presetMatch: TaskPresetMatch) {
  if (
    presetMatch.status === "matched" ||
    presetMatch.status === "manual_reuse" ||
    presetMatch.status === "manual_create"
  ) {
    return presetMatch.displayName;
  }

  if (presetMatch.status === "continue_without_preset") {
    return "未保存预设继续";
  }

  return "未命中频道预设";
}

function getPreviewPresetStatusLabel(presetMatch: TaskPresetMatch) {
  switch (presetMatch.status) {
    case "matched":
      return "命中已有预设";
    case "manual_reuse":
      return "手动复用已有预设";
    case "manual_create":
      return "新建最小预设后继续";
    case "continue_without_preset":
      return "未保存预设继续";
    case "unresolved":
      return "等待人工决策";
  }
}

function getCreatedPresetSummary(presetMatch: TaskPresetMatch) {
  switch (presetMatch.status) {
    case "matched":
      return `命中预设: ${presetMatch.displayName}`;
    case "manual_reuse":
      return `手动复用预设: ${presetMatch.displayName}`;
    case "manual_create":
      return `新建预设后继续: ${presetMatch.displayName}`;
    case "continue_without_preset":
      return "未保存预设继续";
    case "unresolved":
      return "仍待预设决策";
  }
}

function isTaskPreviewPayload(value: WorkspaceFetcherData): value is TaskPreviewPayload {
  return Boolean(value && value.ok && value.mode === "preview");
}

export function resolveWorkspacePreview({
  actionData,
  youtubeData,
  uploadData,
  confirmData,
}: {
  actionData: WorkspaceFetcherData;
  youtubeData: WorkspaceFetcherData;
  uploadData: WorkspaceFetcherData;
  confirmData: WorkspaceFetcherData;
}) {
  if (
    (confirmData && confirmData.ok && confirmData.mode === "created") ||
    (actionData && actionData.ok && actionData.mode === "created")
  ) {
    return null;
  }

  if (isTaskPreviewPayload(youtubeData)) {
    return youtubeData;
  }

  if (isTaskPreviewPayload(uploadData)) {
    return uploadData;
  }

  if (isTaskPreviewPayload(actionData)) {
    return actionData;
  }

  return null;
}

export function WorkspaceShell({
  workspaceMode,
  runtime,
  serviceName,
  requestId,
  user,
  roles,
  navigation,
  panels,
  actionData,
  channelPresets,
  presetPanel,
  taskListPanel,
  taskDetailPanel,
  logoutForm,
}: WorkspaceShellProps) {
  const youtubeFetcher = useFetcher<TaskPreviewPayload | TaskErrorPayload>();
  const uploadFetcher = useFetcher<TaskPreviewPayload | TaskErrorPayload>();
  const confirmFetcher = useFetcher<TaskCreatedPayload | TaskErrorPayload>();
  const inputId = useId();
  const uploadId = useId();
  const form = useForm<z.infer<typeof youtubeSchema>>({
    resolver: zodResolver(youtubeSchema),
    defaultValues: {
      sourceUrl: "",
    },
  });

  const created =
    confirmFetcher.data && confirmFetcher.data.ok
      ? confirmFetcher.data
      : actionData && actionData.ok && actionData.mode === "created"
        ? actionData
        : null;

  const preview = resolveWorkspacePreview({
    actionData,
    youtubeData: youtubeFetcher.data,
    uploadData: uploadFetcher.data,
    confirmData: confirmFetcher.data,
  });

  const errors = [
    youtubeFetcher.data && youtubeFetcher.data.ok === false ? youtubeFetcher.data : null,
    uploadFetcher.data && uploadFetcher.data.ok === false ? uploadFetcher.data : null,
    confirmFetcher.data && confirmFetcher.data.ok === false ? confirmFetcher.data : null,
    actionData && actionData.ok === false ? actionData : null,
  ].filter(Boolean) as TaskErrorPayload[];

  const activeError = errors[0] ?? null;

  if (workspaceMode === "support") {
    return (
      <main className="app-shell">
        <section className="shell-panel shell-hero shell-hero-grid">
          <div>
            <p className="eyebrow">Support Diagnostic Workspace</p>
            <h1>Yakimoji</h1>
            <p className="lede">
              当前视图只用于按 task ID 查看支持诊断上下文。不会展示创作者任务导入、预设编辑或交付下载入口。
            </p>
          </div>

          <aside className="identity-card">
            <p className="eyebrow">登录态</p>
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
            <div className="shell-meta">
              <span>角色: {roles.join(", ")}</span>
              <span>Service: {serviceName}</span>
              <span>Runtime: {runtime}</span>
            </div>
            <div className="request-chip">request_id: {requestId}</div>
            <div className="logout-slot">{logoutForm}</div>
          </aside>
        </section>

        <section className="shell-grid workspace-top-grid">
          <article className="shell-panel shell-nav-panel">
            <p className="eyebrow">Support Navigation</p>
            <ul className="shell-list shell-nav-list">
              {navigation.map((item) => (
                <li key={item.label}>
                  <span className={`nav-pill nav-pill-${item.state}`}>{item.label}</span>
                  <span className="nav-href">{item.href}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="shell-panel intake-panel">
            <div className="intake-panel-header">
              <div>
                <p className="eyebrow">Diagnostic Scope</p>
                <h2>支持排障视图</h2>
              </div>
              <p className="intake-hint">
                重点关注失败原因、人工确认记录、retry lineage 与 request_id，不在此视图中处理创作者导入动作。
              </p>
            </div>

            <div className="support-panel-stack">
              {panels.map((panel) => (
                <section key={panel.title} className="shell-panel shell-note-panel">
                  <p className="eyebrow">Support Note</p>
                  <h3>{panel.title}</h3>
                  <p>{panel.body}</p>
                </section>
              ))}
            </div>
          </article>
        </section>

        <section className="shell-grid workspace-bottom-grid">
          {taskDetailPanel}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero shell-hero-grid">
        <div>
          <p className="eyebrow">Protected Workspace</p>
          <h1>Yakimoji</h1>
          <p className="lede">
            任务导入现在是工作台主行动区。你可以直接粘贴 YouTube 链接或上传视频，
            系统会先给出来源识别与默认处理基线，再由你确认是否正式写入任务记录。
          </p>
        </div>

        <aside className="identity-card">
          <p className="eyebrow">登录态</p>
          <h2>{user.displayName}</h2>
          <p>{user.email}</p>
          <div className="shell-meta">
            <span>角色: {roles.join(", ")}</span>
            <span>Service: {serviceName}</span>
            <span>Runtime: {runtime}</span>
          </div>
          <div className="request-chip">request_id: {requestId}</div>
          <div className="logout-slot">{logoutForm}</div>
        </aside>
      </section>

      <section className="shell-grid workspace-top-grid">
        <article className="shell-panel shell-nav-panel">
          <p className="eyebrow">Global Navigation</p>
          <ul className="shell-list shell-nav-list">
            {navigation.map((item) => (
              <li key={item.label}>
                <span className={`nav-pill nav-pill-${item.state}`}>{item.label}</span>
                <span className="nav-href">{item.href}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="shell-panel intake-panel">
          <div className="intake-panel-header">
            <div>
              <p className="eyebrow">Main Content</p>
              <h2>任务导入</h2>
            </div>
            <p className="intake-hint">
              先识别，再确认。不会在你看不到的前端临时态里“假提交”。
            </p>
          </div>

          <div className="intake-grid">
            <section className="intake-card">
              <p className="eyebrow">YouTube Link</p>
              <h3>粘贴链接开始识别</h3>
              <p className="intake-copy">
                适合熟悉频道的高频导入。识别成功后会展示来源标识和当前默认处理基线。
              </p>

              <youtubeFetcher.Form
                method="post"
                className="intake-form"
                onSubmit={form.handleSubmit(() => undefined)}
              >
                <input type="hidden" name="intent" value="preview_youtube" />
                <label className="field-label" htmlFor={inputId}>
                  YouTube 链接
                </label>
                <input
                  id={inputId}
                  className="text-input"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  {...form.register("sourceUrl")}
                  name="sourceUrl"
                />
                {form.formState.errors.sourceUrl ? (
                  <p className="field-error">{form.formState.errors.sourceUrl.message}</p>
                ) : null}
                <button className="primary-action" type="submit">
                  {youtubeFetcher.state !== "idle" ? "识别中..." : "开始识别"}
                </button>
              </youtubeFetcher.Form>
            </section>

            <section className="intake-card">
              <p className="eyebrow">Video Upload</p>
              <h3>上传视频建立创建上下文</h3>
              <p className="intake-copy">
                上传只会保存服务端对象引用，不会把视频二进制写入数据库。
              </p>

              <uploadFetcher.Form
                method="post"
                encType="multipart/form-data"
                className="intake-form"
              >
                <input type="hidden" name="intent" value="preview_upload" />
                <label className="field-label" htmlFor={uploadId}>
                  视频文件
                </label>
                <input
                  id={uploadId}
                  className="file-input"
                  type="file"
                  name="videoFile"
                  accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                />
                <p className="field-hint">支持 mp4 / mov / mkv / webm，单文件上限 512MB。</p>
                <button className="primary-action" type="submit">
                  {uploadFetcher.state !== "idle" ? "上传并识别中..." : "上传并识别"}
                </button>
              </uploadFetcher.Form>
            </section>
          </div>

          {activeError ? (
            <section className="inline-feedback inline-feedback-error" aria-live="polite">
              <p className="feedback-title">Inline Error</p>
              <h3>当前任务创建上下文未建立</h3>
              <p>{activeError.message}</p>
              <div className="feedback-meta">
                <span>code: {activeError.code}</span>
                <span>request_id: {activeError.request_id}</span>
              </div>
            </section>
          ) : null}

          {preview ? (
            <section className="preview-stack" aria-live="polite">
              <div className="inline-feedback inline-feedback-info">
                <p className="feedback-title">Recognition In Progress</p>
                <h3>来源识别完成，可以确认任务创建</h3>
                <p>{preview.source.previewLabel}</p>
                <div className="feedback-meta">
                  <span>状态: {preview.status}</span>
                  <span>request_id: {preview.requestId}</span>
                </div>
              </div>

              <div className="preview-ledger">
                <section className="ledger-card">
                  <p className="eyebrow">Recognized Source</p>
                  <h3>{preview.source.title}</h3>
                  <dl className="ledger-list">
                    <div>
                      <dt>来源标识</dt>
                      <dd>{preview.source.identifier}</dd>
                    </div>
                    <div>
                      <dt>识别方式</dt>
                      <dd>YouTube 链接</dd>
                    </div>
                    <div>
                      <dt>置信度</dt>
                      <dd>高</dd>
                    </div>
                  </dl>
                </section>

                <section className="ledger-card">
                  <p className="eyebrow">Processing Baseline</p>
                  <h3>当前默认处理基线</h3>
                  <dl className="ledger-list">
                    <div>
                      <dt>翻译方向</dt>
                      <dd>{preview.baseline.translationMode}</dd>
                    </div>
                    <div>
                      <dt>字幕模板</dt>
                      <dd>{preview.baseline.subtitleTemplate}</dd>
                    </div>
                    <div>
                      <dt>输出方式</dt>
                      <dd>{preview.baseline.outputPackage}</dd>
                    </div>
                  </dl>
                </section>

                <section className="ledger-card">
                  <p className="eyebrow">Preset Match</p>
                  <h3>{getPreviewPresetHeading(preview.presetMatch)}</h3>
                  <dl className="ledger-list">
                    <div>
                      <dt>匹配状态</dt>
                      <dd>{getPreviewPresetStatusLabel(preview.presetMatch)}</dd>
                    </div>
                    <div>
                      <dt>来源标识</dt>
                      <dd>{preview.presetMatch.sourceIdentifier}</dd>
                    </div>
                    <div>
                      <dt>应用摘要</dt>
                      <dd>{preview.presetMatch.summary}</dd>
                    </div>
                  </dl>
                </section>

              </div>

              {preview.presetMatch.status === "matched" ? (
                <confirmFetcher.Form method="post" className="confirm-card">
                  <input type="hidden" name="intent" value="confirm" />
                  <input type="hidden" name="draftToken" value={preview.draftToken} />
                  <div>
                    <p className="eyebrow">Confirmation</p>
                    <h3>正式写入任务记录</h3>
                    <p className="intake-copy">
                      本次确认会创建真实 `tasks` 记录，并进入后续 story 可继续消费的初始状态。
                    </p>
                    <label className="field-label">
                      任务级字幕模板覆盖
                      <select className="text-input" name="subtitleTemplateOverride" defaultValue="">
                        <option value="">沿用当前默认模板：{preview.baseline.subtitleTemplate}</option>
                        {subtitleTemplateOverrideOptions.map((template) => (
                          <option key={template} value={template}>
                            {template}
                          </option>
                        ))}
                      </select>
                      <span className="field-hint">
                        只影响当前任务，不会修改底层频道预设。
                      </span>
                      {activeError?.field === "subtitleTemplateOverride" ? (
                        <span className="field-error">{activeError.message}</span>
                      ) : null}
                    </label>
                  </div>
                  <button className="primary-action" type="submit">
                    {confirmFetcher.state !== "idle" ? "正在提交..." : "确认并创建任务"}
                  </button>
                </confirmFetcher.Form>
              ) : (
                <section className="decision-stack">
                  <div className="inline-feedback inline-feedback-info">
                    <p className="feedback-title">Unknown Source Resolution</p>
                    <h3>当前来源未命中现有预设</h3>
                    <p>
                      这是一次轻量决策。你可以复用已有预设、为当前来源创建最小预设，或不保存预设直接继续当前任务。
                    </p>
                  </div>

                  <div className="decision-grid">
                    <confirmFetcher.Form method="post" className="decision-card">
                      <input type="hidden" name="intent" value="confirm_manual_reuse" />
                      <input type="hidden" name="draftToken" value={preview.draftToken} />
                      <div>
                        <p className="eyebrow">Reuse Existing</p>
                        <h3>复用已有预设</h3>
                        <p className="intake-copy">
                          适合当前来源与已有频道规则足够接近的场景。
                        </p>
                      </div>
                      <label className="field-label">
                        选择预设
                        <select
                          className="text-input"
                          name="presetId"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            请选择一个可复用的频道预设
                          </option>
                          {channelPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.displayName} · {preset.summary}
                            </option>
                          ))}
                        </select>
                      </label>
                      {activeError?.field === "presetId" ? (
                        <p className="field-error">{activeError.message}</p>
                      ) : null}
                      <label className="field-label">
                        任务级字幕模板覆盖
                        <select
                          className="text-input"
                          name="subtitleTemplateOverride"
                          defaultValue=""
                        >
                          <option value="">沿用所选预设默认模板</option>
                          {subtitleTemplateOverrideOptions.map((template) => (
                            <option key={template} value={template}>
                              {template}
                            </option>
                          ))}
                        </select>
                        {activeError?.field === "subtitleTemplateOverride" ? (
                          <span className="field-error">{activeError.message}</span>
                        ) : null}
                      </label>
                      <button
                        className="secondary-action"
                        type="submit"
                        disabled={channelPresets.length === 0}
                      >
                        {confirmFetcher.state !== "idle" ? "正在应用..." : "复用后继续"}
                      </button>
                      {channelPresets.length === 0 ? (
                        <p className="field-hint">当前还没有可复用的频道预设。</p>
                      ) : null}
                    </confirmFetcher.Form>

                    <confirmFetcher.Form method="post" className="decision-card decision-card-wide">
                      <input type="hidden" name="intent" value="confirm_manual_create" />
                      <input type="hidden" name="draftToken" value={preview.draftToken} />
                      <div>
                        <p className="eyebrow">Create Minimal Preset</p>
                        <h3>创建最小预设后继续</h3>
                        <p className="intake-copy">
                          只填写当前任务真正需要的最小字段，不离开工作台，不进入复杂后台。
                        </p>
                      </div>
                      <div className="decision-form-grid">
                        <label className="field-label">
                          预设名称
                          <input className="text-input" name="displayName" type="text" />
                          {activeError?.field === "displayName" ? (
                            <span className="field-error">{activeError.message}</span>
                          ) : null}
                        </label>
                        <label className="field-label">
                          默认翻译方向
                          <input className="text-input" name="translationMode" type="text" />
                          {activeError?.field === "translationMode" ? (
                            <span className="field-error">{activeError.message}</span>
                          ) : null}
                        </label>
                        <label className="field-label">
                          默认字幕模板
                          <input className="text-input" name="subtitleTemplate" type="text" />
                          {activeError?.field === "subtitleTemplate" ? (
                            <span className="field-error">{activeError.message}</span>
                          ) : null}
                        </label>
                        <label className="field-label">
                          默认输出偏好
                          <input className="text-input" name="outputPackage" type="text" />
                          {activeError?.field === "outputPackage" ? (
                            <span className="field-error">{activeError.message}</span>
                          ) : null}
                        </label>
                      </div>
                      <label className="field-label">
                        备注
                        <textarea className="text-input preset-notes-input" name="notes" rows={3} />
                        {activeError?.field === "notes" ? (
                          <span className="field-error">{activeError.message}</span>
                        ) : null}
                      </label>
                      <label className="field-label">
                        任务级字幕模板覆盖
                        <select
                          className="text-input"
                          name="subtitleTemplateOverride"
                          defaultValue=""
                        >
                          <option value="">沿用新建预设中的默认模板</option>
                          {subtitleTemplateOverrideOptions.map((template) => (
                            <option key={template} value={template}>
                              {template}
                            </option>
                          ))}
                        </select>
                        {activeError?.field === "subtitleTemplateOverride" ? (
                          <span className="field-error">{activeError.message}</span>
                        ) : null}
                      </label>
                      <button className="primary-action" type="submit">
                        {confirmFetcher.state !== "idle" ? "正在创建..." : "创建预设并继续"}
                      </button>
                    </confirmFetcher.Form>

                    <confirmFetcher.Form method="post" className="decision-card">
                      <input
                        type="hidden"
                        name="intent"
                        value="confirm_continue_without_preset"
                      />
                      <input type="hidden" name="draftToken" value={preview.draftToken} />
                      <div>
                        <p className="eyebrow">Continue Once</p>
                        <h3>不保存预设直接继续</h3>
                        <p className="intake-copy">
                          适合一次性任务。系统会继续使用当前默认处理基线，但不会沉淀新的频道资产。
                        </p>
                      </div>
                      <button className="secondary-action" type="submit">
                        {confirmFetcher.state !== "idle" ? "正在提交..." : "直接继续当前任务"}
                      </button>
                    </confirmFetcher.Form>
                  </div>
                </section>
              )}
            </section>
          ) : null}

          {created ? (
            <section className="inline-feedback inline-feedback-success" aria-live="polite">
              <p className="feedback-title">Task Created</p>
              <h3>任务已写入工作台</h3>
              <p>
                {created.task.sourceTitle} 已创建为 `{created.task.id}`，当前状态为 `{created.task.status}`。
              </p>
              <div className="feedback-meta">
                <span>{created.task.baselineSummary}</span>
                <span>{getCreatedPresetSummary(created.task.presetMatch)}</span>
                <span>request_id: {created.requestId}</span>
              </div>
            </section>
          ) : null}
        </article>
      </section>

      {presetPanel}

      <section className="shell-grid workspace-bottom-grid">
        {taskListPanel}
        {taskDetailPanel}
      </section>

      <section className="shell-grid">
        <article className="shell-panel shell-main-panel">
          <p className="eyebrow">Support Panels</p>
          <div className="panel-stack">
            {panels.map((panel) => (
              <section className="mini-panel" key={panel.title}>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
              </section>
            ))}
          </div>
        </article>

        <article className="shell-panel">
          <p className="eyebrow">Security Boundaries</p>
          <ul className="shell-list">
            <li>SSO 只负责身份认证，Yakimoji 负责本地 session 与本地授权。</li>
            <li>浏览器仅保存 HttpOnly 的 Yakimoji session cookie，不暴露上游 token。</li>
            <li>高敏感拒绝响应与审计事件共用 request_id 做支持追踪。</li>
          </ul>
        </article>

        <article className="shell-panel">
          <p className="eyebrow">Current Scope</p>
          <ul className="shell-list">
            <li>已完成：登录入口、SSO 回调、本地会话、最小 RBAC、任务导入预览、预设命中、未知来源人工决策与任务级模板覆盖。</li>
            <li>待接入：低置信度 review 队列、实时同步、交付访问与运营侧可视化。</li>
            <li>公开路由保留：`/health` 与 `/login`。</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
