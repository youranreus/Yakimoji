import { Form } from "react-router";

import type { OperationsNonMatchAnalysisViewModel } from "../server/operations-non-match-analysis.server";
import { OperationsDrilldownTable } from "./OperationsDrilldownTable";

type OperationsNonMatchAnalysisScreenProps = {
  loaderData: OperationsNonMatchAnalysisViewModel;
};

export function OperationsNonMatchAnalysisScreen({
  loaderData,
}: OperationsNonMatchAnalysisScreenProps) {
  return (
    <main className="app-shell operations-shell">
      <section className="shell-panel shell-hero operations-hero">
        <div className="shell-hero-grid operations-hero-grid">
          <div>
            <p className="eyebrow">Operations View</p>
            <h1>{loaderData.summary.title}</h1>
            <p className="lede">{loaderData.summary.lede}</p>
            <p className="operations-scope-note">{loaderData.summary.scopeNote}</p>
            <nav className="operations-nav" aria-label="运营导航">
              {loaderData.navigation.map((item) => (
                <a
                  key={item.href}
                  className={`operations-nav-link ${item.state === "active" ? "operations-nav-link-active" : ""}`}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <aside className="operations-hero-meta">
            <dl className="operations-meta-list">
              <div>
                <dt>当前账号</dt>
                <dd>{loaderData.user.displayName}</dd>
              </div>
              <div>
                <dt>角色范围</dt>
                <dd>{loaderData.roles.join(" / ")}</dd>
              </div>
              <div>
                <dt>请求追踪</dt>
                <dd>{loaderData.requestId}</dd>
              </div>
            </dl>
            <Form method="post" action="/logout">
              <button className="secondary-action" type="submit">
                退出登录
              </button>
            </Form>
          </aside>
        </div>
      </section>

      <section className="shell-grid operations-lower-grid">
        <article
          className="shell-panel operations-source-panel"
          aria-labelledby="operations-source-analysis-title"
        >
          <div className="task-panel-header">
            <div>
              <p className="eyebrow">Source Analysis</p>
              <h2 id="operations-source-analysis-title">反复未命中来源频道</h2>
            </div>
            <p className="task-panel-copy">
              聚合最近保留窗口内未自动命中已有预设的来源频道，帮助运营快速判断是识别问题、预设覆盖不足，还是流程沉淀仍不稳定。
            </p>
          </div>

          {loaderData.channels.length === 0 ? (
            <p className="operations-empty-copy">
              暂无足够数据，当前没有来源已识别但未自动命中预设的任务样本。
            </p>
          ) : (
            <div className="operations-source-list">
              {loaderData.channels.map((item) => (
                <a
                  key={item.sourceIdentifier}
                  className={`operations-source-row ${loaderData.activeSourceIdentifier === item.sourceIdentifier ? "operations-source-row-active" : ""}`}
                  href={item.drilldownHref}
                >
                  <div>
                    <p className="operations-source-title">{item.sourceTitle}</p>
                    <p className="operations-source-subtitle">{item.sourceIdentifier}</p>
                    <p className="operations-source-note">{item.dominantReason}</p>
                    <p className="operations-source-note">{item.outcomeSummary}</p>
                  </div>
                  <dl className="operations-source-meta">
                    <div>
                      <dt>未命中任务数</dt>
                      <dd>{item.nonMatchCount}</dd>
                    </div>
                    <div>
                      <dt>最近样本</dt>
                      <dd>{item.lastSeenAt.slice(0, 10)}</dd>
                    </div>
                  </dl>
                </a>
              ))}
            </div>
          )}
        </article>

        <OperationsDrilldownTable drilldown={loaderData.drilldown} />
      </section>
    </main>
  );
}
