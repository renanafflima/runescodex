import type { ReactNode } from "react";
import { Icon } from "./Icon";

type LoadingProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
};

export function Loading({
  label = "Carregando",
  size = "md",
}: LoadingProps) {
  return (
    <span className={`loading loading--${size}`} role="status">
      <span aria-hidden="true" className="loading__spinner" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

type StateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: StateProps) {
  return (
    <div className="feedback-state">
      <span className="feedback-state__mark" aria-hidden="true">
        R
      </span>
      <div>
        <h3 className="feedback-state__title">{title}</h3>
        <p className="feedback-state__description">{description}</p>
      </div>
      {action ? <div className="feedback-state__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`.trim()} />;
}

export function ErrorState({ action, description, title }: StateProps) {
  return (
    <div className="feedback-state feedback-state--error" role="alert">
      <span className="feedback-state__icon">
        <Icon name="alert" size={22} />
      </span>
      <div>
        <h3 className="feedback-state__title">{title}</h3>
        <p className="feedback-state__description">{description}</p>
      </div>
      {action ? <div className="feedback-state__action">{action}</div> : null}
    </div>
  );
}
