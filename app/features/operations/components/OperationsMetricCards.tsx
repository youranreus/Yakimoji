import type { OperationsMetricCard } from "../server/operations-dashboard.server";

type OperationsMetricCardsProps = {
  metricCards: OperationsMetricCard[];
};

export function OperationsMetricCards({
  metricCards,
}: OperationsMetricCardsProps) {
  return (
    <section className="shell-grid operations-metric-grid" aria-label="运营核心指标">
      {metricCards.map((card) => (
        <article
          key={card.id}
          className={`shell-panel operations-metric-card operations-metric-card-${card.tone}`}
        >
          <p className="eyebrow">{card.eyebrow}</p>
          <h2>{card.title}</h2>
          <p className="operations-metric-value">{card.value}</p>
          <p className="operations-metric-supporting">{card.supportingText}</p>
          <p className="operations-metric-explanation">{card.explanation}</p>
          <a className="operations-drilldown-link" href={card.drilldownHref}>
            {card.empty ? "查看当前范围" : "查看相关任务"}
          </a>
        </article>
      ))}
    </section>
  );
}
