import type { CSSProperties, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mvp-page-header">
      <div>
        <span className="mvp-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="mvp-page-action">{action}</div>}
    </div>
  );
}

export function MetricCard({ label, value, detail, icon, tone = "default" }: { label: string; value: string; detail: string; icon: ReactNode; tone?: "default" | "green" | "gold" | "blue" }) {
  return (
    <article className={`mvp-metric-card tone-${tone}`}>
      <div className="mvp-metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function LoadingState({ label = "Loading CrediSafe…" }: { label?: string }) {
  return <div className="mvp-loading"><LoaderCircle className="spin" size={26} /><span>{label}</span></div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="mvp-empty"><div>{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  return (
    <div className="mvp-score-ring" style={{ width: size, height: size, "--ring-size": `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className="track" />
        <circle cx="50" cy="50" r={radius} className="value" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <span><strong>{score}</strong><small>/100</small></span>
    </div>
  );
}
