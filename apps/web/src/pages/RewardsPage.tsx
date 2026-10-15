import { useCallback, useEffect, useState } from "react";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Section } from "../components/layout/Section";
import { Button } from "../components/ui/Button";
import { Card, StatCard } from "../components/ui/Card";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { describeApiError } from "../services/api/errors";
import {
  convertRewards,
  getRewardsMe,
  listRewardCatalog,
  listRewardMissions,
  listRewardRedemptions,
  redeemReward,
  type RewardCatalogItem,
  type RewardMission,
  type RewardPackage,
  type RewardRedemption,
  type RewardWallet,
} from "../services/api/rewards";

const PERIODS = [
  { id: "DAILY", label: "Diárias" },
  { id: "WEEKLY", label: "Semanais" },
  { id: "MONTHLY", label: "Mensais" },
] as const;

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function priceLabel(item: RewardCatalogItem) {
  if (!item.priceConfigured || !item.price) {
    return item.currency === "DIAMOND" ? "— Diamond" : "— Gold";
  }
  const unit = item.currency === "DIAMOND" ? "Diamond" : "Gold";
  return `${formatAmount(item.price)} ${unit}`;
}

export function RewardsPage() {
  const requests = useLatestRequest();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("DAILY");
  const [wallet, setWallet] = useState<RewardWallet>({ points: 0, gold: 0, diamond: 0 });
  const [packages, setPackages] = useState<RewardPackage[]>([]);
  const [diamondEnabled, setDiamondEnabled] = useState(false);
  const [missions, setMissions] = useState<RewardMission[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (nextPeriod = period) => {
      const current = requests.start();
      setLoading(true);
      setError("");
      try {
        const [me, missionList, catalogList, history] = await Promise.all([
          getRewardsMe(),
          listRewardMissions(nextPeriod),
          listRewardCatalog(),
          listRewardRedemptions(),
        ]);
        if (!current()) return;
        setWallet({
          points: Number(me?.wallet?.points || 0),
          gold: Number(me?.wallet?.gold || 0),
          diamond: Number(me?.wallet?.diamond || 0),
        });
        setPackages(
          Array.isArray(me?.conversions?.pointsToGold) ? me.conversions.pointsToGold : [],
        );
        setDiamondEnabled(Boolean(me?.conversions?.goldToDiamond?.enabled));
        setMissions(Array.isArray(missionList) ? missionList : []);
        setCatalog(Array.isArray(catalogList) ? catalogList : []);
        setRedemptions(Array.isArray(history) ? history : []);
      } catch (err) {
        if (!current()) return;
        setError(describeApiError(err));
      } finally {
        if (current()) setLoading(false);
      }
    },
    [period, requests],
  );

  useEffect(() => {
    void load(period);
  }, [load, period]);

  async function runAction(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await work();
      await load(period);
    } catch (err) {
      setNotice(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer size="wide">
      <Section
        className="rewards-page"
        eyebrow="Rewards"
        title="Missões, pontos e conquistas"
        description="O saldo, as missões e os resgates vêm da sua conta."
      >
        {loading ? <CatalogLoading label="Carregando rewards" /> : null}
        {error ? <CatalogError description={error} onRetry={() => void load(period)} /> : null}
        {notice ? <p role="status">{notice}</p> : null}

        {!loading && !error ? (
          <>
            <div className="profile-stats" aria-label="Saldo">
              <StatCard label="Pontos" value={formatAmount(wallet.points)} />
              <StatCard label="Gold" value={formatAmount(wallet.gold)} />
              <StatCard label="Diamond" value={formatAmount(wallet.diamond)} />
            </div>

            <div className="rewards-actions" role="tablist" aria-label="Período das missões">
              {PERIODS.map((item) => (
                <Button
                  key={item.id}
                  aria-selected={item.id === period}
                  onClick={() => setPeriod(item.id)}
                  role="tab"
                  size="sm"
                  type="button"
                  variant={item.id === period ? "primary" : "ghost"}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {missions.length === 0 ? (
              <CatalogEmpty description="Nenhuma missão ativa neste período." title="Missões" />
            ) : (
              <div className="rewards-list">
                {missions.map((mission) => (
                  <Card key={mission.id}>
                    <h3>{mission.title}</h3>
                    <p>{mission.description}</p>
                    <p>
                      {mission.current} / {mission.target} · +{formatAmount(mission.rewardPoints)} pontos
                      {mission.completed ? " · Concluída" : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}

            <h2>Conversão para Gold</h2>
            {packages.length === 0 ? (
              <CatalogEmpty description="Nenhum pacote de conversão foi publicado." title="Conversão" />
            ) : (
              <div className="rewards-list">
                {packages.map((pack) => (
                  <Card key={pack.amount}>
                    <h3>{formatAmount(pack.goldGranted || pack.amount)} Gold</h3>
                    <p>{formatAmount(pack.pointsCost)} pontos</p>
                    <Button
                      disabled={busy || pack.enabled === false}
                      onClick={() =>
                        void runAction(async () => {
                          await convertRewards("POINTS_TO_GOLD", pack.amount);
                        })
                      }
                      type="button"
                    >
                      Converter
                    </Button>
                  </Card>
                ))}
              </div>
            )}
            {!diamondEnabled ? <p>A conversão de Gold para Diamond ainda não foi publicada.</p> : null}

            <h2>Loja de recompensas</h2>
            {catalog.length === 0 ? (
              <CatalogEmpty description="Nenhum item disponível no catálogo." title="Loja" />
            ) : (
              <div className="rewards-list">
                {catalog.map((item) => (
                  <Card key={item.id}>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p>{priceLabel(item)}</p>
                    <Button
                      disabled={busy || !item.priceConfigured}
                      onClick={() =>
                        void runAction(async () => {
                          await redeemReward(item.id);
                        })
                      }
                      type="button"
                    >
                      Resgatar
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            <h2>Histórico de resgates</h2>
            {redemptions.length === 0 ? (
              <CatalogEmpty description="Nenhum resgate ainda." title="Histórico" />
            ) : (
              <div className="rewards-list">
                {redemptions.map((item) => (
                  <Card key={item.id}>
                    <h3>{item.name}</h3>
                    <p>
                      {formatAmount(item.price ?? item.cost ?? 0)}{" "}
                      {item.currency === "DIAMOND" ? "Diamond" : "Gold"} · {item.status}
                    </p>
                    {item.message ? <p>{item.message}</p> : null}
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </Section>
    </PageContainer>
  );
}
