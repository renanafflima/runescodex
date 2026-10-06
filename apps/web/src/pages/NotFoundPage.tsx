import { ButtonLink } from "../components/ui/Button";
import { ErrorState } from "../components/ui/Feedback";
import { PageContainer } from "../components/layout/PageContainer";

export function NotFoundPage() {
  return (
    <PageContainer className="not-found-page" size="narrow">
      <span className="not-found-page__code" aria-hidden="true">
        404
      </span>
      <ErrorState
        action={<ButtonLink to="/">Voltar ao início</ButtonLink>}
        description="O caminho informado não faz parte deste códice."
        title="Página não encontrada"
      />
    </PageContainer>
  );
}
