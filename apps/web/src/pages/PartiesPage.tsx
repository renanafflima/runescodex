import { PageContainer } from "../components/layout/PageContainer";
import { PartyPanel } from "../components/bosstiary/PartyPanel";

export function PartiesPage() {
  return (
    <div className="catalog-page catalog-page--bosstiary">
      <section className="catalog-hero catalog-hero--bosstiary" aria-labelledby="parties-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">Partys</span>
          <h1 id="parties-title">Minhas Partys</h1>
          <p>
            Crie salas, convide jogadores e compartilhe rotações de bosses com os integrantes ativos
            da Party.
          </p>
        </PageContainer>
      </section>
      <PageContainer className="catalog-body bosstiary-body" size="wide">
        <PartyPanel />
      </PageContainer>
    </div>
  );
}
