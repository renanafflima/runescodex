import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { EmptyState, ErrorState, Loading } from "../ui/Feedback";

type CatalogStatusProps = {
  onRetry?: () => void;
};

export function CatalogLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="catalog-status catalog-status--loading">
      <div className="catalog-skeleton" aria-hidden="true">
        <span className="skeleton-card" />
        <span className="skeleton-card" />
        <span className="skeleton-card" />
      </div>
      <Loading label={label} size="lg" />
    </div>
  );
}

export function CatalogError({
  description,
  onRetry,
  title = "Não foi possível carregar",
}: CatalogStatusProps & { description: string; title?: string }) {
  return (
    <ErrorState
      action={
        onRetry ? (
          <Button onClick={onRetry} variant="secondary">
            Tentar novamente
          </Button>
        ) : undefined
      }
      description={description}
      title={title}
    />
  );
}

export function CatalogEmpty({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return <EmptyState action={action} description={description} title={title} />;
}
