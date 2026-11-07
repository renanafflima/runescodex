import type { ProfileMeResponse } from "../../services/api/profile";

type ProfileStatsGridProps = {
  summary: ProfileMeResponse;
};

const STATS: Array<{
  key: string;
  label: string;
  value: (data: ProfileMeResponse) => number;
}> = [
  { key: "hunts", label: "Hunts visualizadas", value: (d) => d.stats.contentViews.hunts },
  { key: "creatures", label: "Criaturas visualizadas", value: (d) => d.stats.contentViews.creatures },
  { key: "bosses", label: "Bosses visualizados", value: (d) => d.stats.contentViews.bosses },
  { key: "bestiary-progress", label: "Entradas no Bestiário", value: (d) => d.stats.bestiary.entriesWithProgress },
  { key: "bestiary-done", label: "Criaturas concluídas", value: (d) => d.stats.bestiary.completed },
  { key: "forum", label: "Participação no fórum", value: (d) => d.stats.forumParticipation },
  { key: "contributions", label: "Solicitações de hunt", value: (d) => d.stats.huntUpdateRequests },
  { key: "missions", label: "Missões concluídas", value: (d) => d.stats.rewardMissionsCompleted },
];

export function ProfileStatsGrid({ summary }: ProfileStatsGridProps) {
  return (
    <section aria-labelledby="profile-stats-title" className="profile-panel profile-stats">
      <div className="profile-section-head">
        <div>
          <h2 id="profile-stats-title">Estatísticas</h2>
          <p className="profile-section-lead">Histórico de aventura consolidado pelo servidor.</p>
        </div>
      </div>
      <div className="profile-stat-grid">
        {STATS.map((item) => (
          <div className="profile-stat" key={item.key}>
            <b>{item.value(summary)}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
