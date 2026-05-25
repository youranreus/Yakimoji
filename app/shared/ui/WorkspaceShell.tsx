import { useId } from "react";
import { useFetcher } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
    createdAt: string;
  };
};

type TaskErrorPayload = {
  ok: false;
  code: string;
  message: string;
  field?: string;
  retryable?: boolean;
  request_id: string;
};

type WorkspaceShellProps = {
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
  recentTasks: Array<{
    id: string;
    status: string;
    intakeMethod: "youtube_link" | "video_upload";
    sourceIdentifier: string;
    sourceTitle: string;
    baselineSummary: string;
    createdAt: string;
  }>;
  actionData: TaskPreviewPayload | TaskCreatedPayload | TaskErrorPayload | null;
  logoutForm: React.ReactNode;
};

const youtubeSchema = z.object({
  sourceUrl: z.url("请输入有效的 YouTube 链接。"),
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceShell({
  runtime,
  serviceName,
  requestId,
  user,
  roles,
  navigation,
  panels,
  recentTasks,
  actionData,
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

  const preview =
    created
      ? null
      : confirmFetcher.data && confirmFetcher.data.ok === false
        ? null
        : youtubeFetcher.data && youtubeFetcher.data.ok
          ? youtubeFetcher.data
          : uploadFetcher.data && uploadFetcher.data.ok
            ? uploadFetcher.data
            : actionData && actionData.ok && actionData.mode === "preview"
              ? actionData
              : null;

  const errors = [
    youtubeFetcher.data && youtubeFetcher.data.ok === false ? youtubeFetcher.data : null,
    uploadFetcher.data && uploadFetcher.data.ok === false ? uploadFetcher.data : null,
    confirmFetcher.data && confirmFetcher.data.ok === false ? confirmFetcher.data : null,
    actionData && actionData.ok === false ? actionData : null,
  ].filter(Boolean) as TaskErrorPayload[];

  const activeError = errors[0] ?? null;

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

              </div>

              <confirmFetcher.Form method="post" className="confirm-card">
                <input type="hidden" name="intent" value="confirm" />
                <input type="hidden" name="draftToken" value={preview.draftToken} />
                <div>
                  <p className="eyebrow">Confirmation</p>
                  <h3>正式写入任务记录</h3>
                  <p className="intake-copy">
                    本次确认会创建真实 `tasks` 记录，并进入后续 story 可继续消费的初始状态。
                  </p>
                </div>
                <button className="primary-action" type="submit">
                  {confirmFetcher.state !== "idle" ? "正在提交..." : "确认并创建任务"}
                </button>
              </confirmFetcher.Form>
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
                <span>request_id: {created.requestId}</span>
              </div>
            </section>
          ) : null}
        </article>
      </section>

      <section className="shell-grid workspace-bottom-grid">
        <article className="shell-panel recent-task-panel">
          <p className="eyebrow">Recent Tasks</p>
          <h2>最近创建任务</h2>
          <div className="recent-task-list">
            {(created ? [created.task, ...recentTasks] : recentTasks).slice(0, 5).map((task) => (
              <section className="recent-task-item" key={task.id}>
                <div className="recent-task-heading">
                  <h3>{task.sourceTitle}</h3>
                  <span className="status-pill">{task.status}</span>
                </div>
                <p>{task.baselineSummary}</p>
                <div className="feedback-meta">
                  <span>{task.id}</span>
                  <span>{formatDate(task.createdAt)}</span>
                </div>
              </section>
            ))}
          </div>
        </article>

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
      </section>

      <section className="shell-grid">
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
            <li>已完成：登录入口、SSO 回调、本地会话、最小 RBAC、任务导入预览与真实任务写入。</li>
            <li>待接入：预设命中、review 队列、实时同步、交付访问。</li>
            <li>公开路由保留：`/health` 与 `/login`。</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
