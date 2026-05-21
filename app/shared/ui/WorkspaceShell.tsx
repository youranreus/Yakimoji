type WorkspaceShellProps = {
  runtime: string;
  serviceName: string;
  pendingDomains: string[];
  boundaries: string[];
};

export function WorkspaceShell({
  runtime,
  serviceName,
  pendingDomains,
  boundaries,
}: WorkspaceShellProps) {
  return (
    <main className="app-shell">
      <section className="shell-panel shell-hero">
        <p className="eyebrow">Workspace Baseline</p>
        <h1>Yakimoji</h1>
        <p className="lede">
          Minimal dashboard shell aligned to the approved React Router
          `node-postgres` starter. Later stories extend this surface with auth,
          task orchestration, presets, review, and deliverables.
        </p>
        <div className="shell-meta">
          <span>Service: {serviceName}</span>
          <span>Runtime: {runtime}</span>
          <span>Health path: /health</span>
        </div>
      </section>

      <section className="shell-grid">
        <article className="shell-panel">
          <p className="eyebrow">Ready Boundaries</p>
          <ul className="shell-list">
            {boundaries.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </article>

        <article className="shell-panel">
          <p className="eyebrow">Pending Domains</p>
          <ul className="shell-list">
            {pendingDomains.map((domain) => (
              <li key={domain}>{domain}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
