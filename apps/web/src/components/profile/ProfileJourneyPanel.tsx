import type { ProfileMeResponse } from "../../services/api/profile";

type ProfileJourneyPanelProps = {
  summary: ProfileMeResponse | null;
};

function memberMonthsLabel(months: number) {
  if (months <= 0) return "Primeiro mês";
  if (months === 1) return "1 mês";
  return `${months} meses`;
}

export function ProfileJourneyPanel({ summary }: ProfileJourneyPanelProps) {
  if (!summary) return null;

  const { journey, counts } = summary;
  const highlights = journey.highlights;
  const xpPending = journey.xpStatus === "PENDING_DEFINITION";

  return (
    <section aria-labelledby="profile-journey-title" className="profile-journey">
      <div className="profile-section-head">
        <div>
          <p className="eyebrow">RuneCodex</p>
          <h2 id="profile-journey-title">Jornada do Aventureiro</h2>
          <p className="profile-section-lead">
            Seu progresso geral dentro do RuneCodex, com base nas atividades registradas pela API.
          </p>
        </div>
      </div>

      <div className="profile-journey__layout">
        <div className="profile-journey__main">
          {xpPending ? (
            <div className="profile-journey__pending">
              <strong>Jornada em construção</strong>
              <p>
                Nível e XP ainda não foram definidos pelo produto. Quando as regras forem aprovadas,
                esta área passará a exibir o progresso real — sem estimativas no cliente.
              </p>
            </div>
          ) : null}
          <p className="profile-journey__activities">
            <span className="profile-journey__activities-label">Atividades rastreadas</span>
            <strong>{counts.activities}</strong>
          </p>
        </div>

        <div className="profile-mini-grid" role="list">
          <div className="profile-mini" role="listitem">
            <b>{highlights.emblemsUnlocked}</b>
            <span>Conquistas desbloqueadas</span>
          </div>
          <div className="profile-mini" role="listitem">
            <b>{highlights.rewardMissionsCompleted}</b>
            <span>Missões concluídas</span>
          </div>
          <div className="profile-mini" role="listitem">
            <b>{highlights.trackedContentViews}</b>
            <span>Visualizações no Codex</span>
          </div>
          <div className="profile-mini" role="listitem">
            <b>{memberMonthsLabel(highlights.memberMonths)}</b>
            <span>No RuneCodex</span>
          </div>
        </div>
      </div>
    </section>
  );
}
