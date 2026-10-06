import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "default" | "quiet" | "glass";
};

export function Card({
  children,
  className = "",
  tone = "default",
  ...props
}: CardProps) {
  return (
    <div className={`card card--${tone} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

type StatCardProps = {
  detail?: string;
  label: string;
  value: string;
};

export function StatCard({ detail, label, value }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {detail ? <span className="stat-card__detail">{detail}</span> : null}
    </div>
  );
}
