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
  logoutForm: React.ReactNode;
};

export function WorkspaceShell({
  runtime,
  serviceName,
  requestId,
  user,
  roles,
  navigation,
  panels,
  logoutForm,
}: WorkspaceShellProps) {
  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero shell-hero-grid">
        <div>
          <p className="eyebrow">Protected Workspace</p>
          <h1>Yakimoji</h1>
          <p className="lede">
            这是 Story 1.2 交付的受保护工作台壳层。登录态、导航、基础 account
            affordance 与 request 追踪信息已经闭环，后续故事会在此基础上接入任务与交付流程。
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

      <section className="shell-grid">
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

        <article className="shell-panel shell-main-panel">
          <p className="eyebrow">Main Content</p>
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
            <li>已完成：登录入口、SSO 回调、本地会话、最小 RBAC、审计闭环。</li>
            <li>待接入：任务导入、预设管理、review 队列、交付访问。</li>
            <li>公开路由保留：`/health` 与 `/login`。</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
