import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import {
  affordancePercent,
  catalogArtFile,
  diamondOffers,
  formatRenewal,
  formatRewardAmount,
  goldArtFile,
  isPlayableRewardMission,
  missionArtFile,
  progressPercent,
  rewardsActionMessage,
} from "../domain/rewards";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { assetUrl } from "../lib/assets";
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

type DiamondConversion = {
  enabled?: boolean;
  rate?: { goldCost: number; diamondGranted: number } | null;
};

const PERIODS = [
  { id: "DAILY", label: "Diárias", one: "Diária" },
  { id: "WEEKLY", label: "Semanais", one: "Semanal" },
  { id: "MONTHLY", label: "Mensais", one: "Mensal" },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  BESTIARY: "BESTIÁRIO",
  EXPLORATION: "EXPLORAÇÃO",
  COMMUNITY: "COMUNIDADE",
  HUNT: "HUNT",
  RECRUITMENT: "RECRUTAMENTO",
  PROMOTION: "DIVULGAÇÃO",
  KNOWLEDGE: "CONHECIMENTO",
  MUSIC: "MÚSICA",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Resgate solicitado. Seu pedido está aguardando aprovação.",
  APPROVED: "Resgate aprovado. A entrega será realizada em breve.",
  DELIVERED: "Reward entregue.",
  CANCELLED: "Resgate cancelado.",
};

function art(file: string | null) {
  return file ? assetUrl(`images/rewards/${file}`) : "";
}

function emptyWallet(): RewardWallet {
  return { points: 0, gold: 0, diamond: 0 };
}

function walletFrom(payload: RewardWallet | { wallet?: RewardWallet } | null | undefined): RewardWallet | null {
  if (!payload) return null;
  if ("wallet" in payload && payload.wallet) return payload.wallet;
  if ("points" in payload) return payload;
  return null;
}

function catalogType(item: RewardCatalogItem) {
  if (item.premium || item.currency === "DIAMOND") return "Diamond · Premium";
  if (item.imageKey === "rc1000") return "Rubini OT · Premium";
  if (item.imageKey === "rc500") return "Rubini OT";
  if (item.imageKey === "tc125" || item.imageKey === "tc250") return "Tibia Global";
  return item.currency === "GOLD" ? "Gold" : "Recompensa";
}

function catalogPrice(item: RewardCatalogItem) {
  if (!item.priceConfigured || !item.price) {
    return item.currency === "DIAMOND" ? "— Diamond" : "— Gold";
  }
  const unit = item.currency === "DIAMOND" ? "Diamond" : "Gold";
  return `${formatRewardAmount(item.price)} ${unit}`;
}

export function RewardsPage() {
  const requests = useLatestRequest();
  const { activeCharacter } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("DAILY");
  const [dataPeriod, setDataPeriod] = useState<string | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(emptyWallet);
  const [packages, setPackages] = useState<RewardPackage[]>([]);
  const [diamondRate, setDiamondRate] = useState<DiamondConversion | null>(null);
  const [missions, setMissions] = useState<RewardMission[]>([]);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [selected, setSelected] = useState<RewardMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const hasDataRef = useRef(false);

  const applyMe = useCallback((me: Awaited<ReturnType<typeof getRewardsMe>> | null | undefined) => {
    const next = walletFrom(me?.wallet ? { wallet: me.wallet } : null);
    if (next) {
      setWallet({
        points: Number(next.points || 0),
        gold: Number(next.gold || 0),
        diamond: Number(next.diamond || 0),
      });
    }
    setPackages(Array.isArray(me?.conversions?.pointsToGold) ? me.conversions.pointsToGold : []);
    setDiamondRate(me?.conversions?.goldToDiamond ?? null);
  }, []);

  const load = useCallback(
    async (nextPeriod = period) => {
      const current = requests.start();
      if (!hasDataRef.current) setLoading(true);
      setError("");
      try {
        const [me, missionList, catalogList, history] = await Promise.all([
          getRewardsMe(),
          listRewardMissions(nextPeriod),
          listRewardCatalog(),
          listRewardRedemptions(),
        ]);
        if (!current()) return;
        applyMe(me);
        setMissions(Array.isArray(missionList) ? missionList : []);
        setCatalog(Array.isArray(catalogList) ? catalogList : []);
        setRedemptions(Array.isArray(history) ? history : []);
        setDataPeriod(nextPeriod);
        hasDataRef.current = true;
        setHasData(true);
      } catch (err) {
        if (!current()) return;
        setError(describeApiError(err));
      } finally {
        if (current()) setLoading(false);
      }
    },
    [applyMe, period, requests],
  );

  useEffect(() => {
    void load(period);
  }, [load, period]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const playable = useMemo(
    () => (dataPeriod === period ? missions.filter(isPlayableRewardMission) : []),
    [dataPeriod, missions, period],
  );
  const offers = useMemo(() => diamondOffers(diamondRate), [diamondRate]);
  const periodMeta = PERIODS.find((item) => item.id === period) ?? PERIODS[0];
  const renewal = formatRenewal(playable[0]?.periodEnd ?? missions.find((item) => item.period === period)?.periodEnd, now);
  const completed = playable.filter((mission) => mission.completed).length;
  const pendingPeriod = hasData && dataPeriod !== period;
  const openMission = selected && playable.some((mission) => mission.id === selected.id) ? selected : null;

  async function runAction(work: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      setNotice(await work());
    } catch (err) {
      setNotice(rewardsActionMessage(describeApiError(err)));
    } finally {
      setBusy(false);
    }
  }

  async function refreshAfter(confirmed: RewardWallet | null) {
    if (confirmed) {
      setWallet({
        points: Number(confirmed.points || 0),
        gold: Number(confirmed.gold || 0),
        diamond: Number(confirmed.diamond || 0),
      });
    }
    try {
      await load(period);
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function askConvert(pack: RewardPackage) {
    if (busy || pack.enabled === false) return;
    const price = `${formatRewardAmount(pack.pointsCost)} pontos`;
    const accepted = window.confirm(`Converter ${price} em ${formatRewardAmount(pack.goldGranted || pack.amount)} Gold? O custo é calculado no servidor.`);
    if (!accepted) return;
    void runAction(async () => {
      const next = walletFrom(await convertRewards("POINTS_TO_GOLD", pack.amount));
      await refreshAfter(next);
      if (!next) return "Conversão confirmada pelo servidor.";
      return `Conversão confirmada. Pontos: ${formatRewardAmount(next.points)}. Gold: ${formatRewardAmount(next.gold)}. Diamond: ${formatRewardAmount(next.diamond)}.`;
    });
  }

  function askDiamond(offer: { amount: number; goldCost: number }) {
    if (busy) return;
    const accepted = window.confirm(
      `Converter ${formatRewardAmount(offer.goldCost)} Gold em ${formatRewardAmount(offer.amount)} Diamond? O custo é calculado no servidor.`,
    );
    if (!accepted) return;
    void runAction(async () => {
      const next = walletFrom(await convertRewards("GOLD_TO_DIAMOND", offer.amount));
      await refreshAfter(next);
      if (!next) return "Conversão confirmada pelo servidor.";
      return `Conversão confirmada. Pontos: ${formatRewardAmount(next.points)}. Gold: ${formatRewardAmount(next.gold)}. Diamond: ${formatRewardAmount(next.diamond)}.`;
    });
  }

  function askRedeem(item: RewardCatalogItem) {
    if (busy || !item.priceConfigured) return;
    const accepted = window.confirm(`Resgatar "${item.name}" por ${catalogPrice(item)}? O débito é feito no servidor.`);
    if (!accepted) return;
    void runAction(async () => {
      const result = await redeemReward(item.id);
      await refreshAfter(walletFrom(result));
      const status = result.redemption?.status;
      return (status && STATUS_LABEL[status]) || result.redemption?.message || "Resgate confirmado pelo servidor.";
    });
  }

  return (
    <PageContainer size="wide">
      <div className="rewards-stage">
        <header className="rewards-top">
          <div>
            <p className="rewards-kicker">Sistema de recompensas</p>
            <p className="rewards-brand-sub">Rewards · Missões · Conquistas</p>
          </div>
          <div className="rewards-points">
            <span className="rewards-coin" aria-hidden="true">R</span>
            <span>
              <small>Seus pontos</small>
              <strong>{hasData ? formatRewardAmount(wallet.points) : "—"}</strong>
            </span>
          </div>
        </header>

        <section className="rewards-hero" aria-label="Rewards">
          <img src={art("hero.webp")} alt="" />
          <div className="rewards-hero__copy">
            <span>Sistema de recompensas</span>
            <h1>REWARDS</h1>
            <p>Jogue · Explore · Conquiste · Evolua</p>
          </div>
        </section>

        <section className="rewards-summary">
          <div className="rewards-player">
            <span className="rewards-avatar" aria-hidden="true">⚔</span>
            <div>
              <small>Aventureiro</small>
              <strong>{activeCharacter?.name || "Seu progresso no RuneCodex"}</strong>
            </div>
          </div>
          <div className="rewards-reset">
            <small>Próxima renovação</small>
            <strong>{hasData ? renewal || "—" : "—"}</strong>
          </div>
        </section>

        {error ? (
          <div className="rewards-banner" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void load(period)}>Tentar novamente</button>
          </div>
        ) : null}
        {notice ? <p className="rewards-notice" role="status">{notice}</p> : null}
        {loading && !hasData ? <p className="rewards-loading">Carregando rewards</p> : null}

        {hasData ? (
          <>
            <section className="rewards-block" aria-labelledby="rewards-missions-title">
              <div className="rewards-block__head">
                <div>
                  <h2 id="rewards-missions-title">Missões <span>{periodMeta.label}</span></h2>
                  <p>Escolha um período e complete as atividades para acumular pontos.</p>
                </div>
                <p>{pendingPeriod ? "—" : `${completed} / ${playable.length} concluídas`}</p>
              </div>
              <div className="rewards-tabs" role="tablist" aria-label="Período das missões">
                {PERIODS.map((item) => (
                  <button
                    key={item.id}
                    aria-selected={item.id === period}
                    className={item.id === period ? "is-active" : undefined}
                    onClick={() => setPeriod(item.id)}
                    role="tab"
                    type="button"
                  >
                    {item.label} {item.id === period && !pendingPeriod ? <span>{playable.length}</span> : null}
                  </button>
                ))}
              </div>
              {pendingPeriod ? <p className="rewards-loading">Carregando missões</p> : null}
              {!pendingPeriod && playable.length === 0 ? (
                <p className="rewards-empty">Nenhuma missão disponível neste período.</p>
              ) : (
                <div className="rewards-missions">
                  {playable.map((mission) => {
                    const file = missionArtFile(mission);
                    const percent = progressPercent(mission.current, mission.target);
                    return (
                      <button key={mission.id} className="rewards-mission" onClick={() => setSelected(mission)} type="button">
                        {file ? <img src={art(file)} alt="" /> : <span className="rewards-mission__fallback" />}
                        <span className="rewards-mission__shade" />
                        <span className="rewards-mission__body">
                          <span className="rewards-mission__top">
                            <strong>{CATEGORY_LABEL[mission.category] || mission.category}</strong>
                            <b>+{formatRewardAmount(mission.rewardPoints)} pts</b>
                          </span>
                          <span className="rewards-mission__title">{mission.title}</span>
                          <span className="rewards-mission__desc">{mission.description}</span>
                          <span className="rewards-progress">
                            <i><i style={{ width: `${percent}%` }} /></i>
                            <b>{mission.current} / {mission.target}</b>
                          </span>
                          <span className="rewards-mission__action">
                            <em>Progresso</em>
                            <b>{mission.completed ? "CONCLUÍDA" : mission.current > 0 ? "CONTINUAR" : "COMEÇAR"}</b>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rewards-block" aria-labelledby="rewards-economy-title">
              <div className="rewards-block__head">
                <div>
                  <h2 id="rewards-economy-title">Economia <span>RuneCodex</span></h2>
                  <p>Entenda rapidamente como seus pontos viram moedas permanentes.</p>
                </div>
                <p>3 moedas</p>
              </div>
              <div className="rewards-economy">
                <div className="rewards-economy__intro">
                  <h3>PONTOS → GOLD → DIAMOND</h3>
                  <p>Os pontos são conquistados nas missões. Gold e Diamond ficam com você entre as temporadas.</p>
                  <div className="rewards-balances">
                    <span>Pontos: <b>{formatRewardAmount(wallet.points)}</b></span>
                    <span>Gold: <b>{formatRewardAmount(wallet.gold)}</b></span>
                    <span className="is-diamond">Diamond: <b>{formatRewardAmount(wallet.diamond)}</b></span>
                  </div>
                </div>
                <div className="rewards-group">
                  <h4>Conversão para Gold<span /></h4>
                  {packages.length === 0 ? <p className="rewards-empty">Nenhum pacote de conversão foi publicado.</p> : null}
                  <div className="rewards-conversions">
                    {packages.map((pack) => {
                      const file = goldArtFile(pack.amount);
                      const unitCost = packages.find((item) => item.amount === 1)?.pointsCost;
                      const savings = pack.amount > 1 && unitCost ? unitCost * pack.amount - pack.pointsCost : 0;
                      return (
                        <article key={pack.amount} className="rewards-convert">
                          {file ? <img src={art(file)} alt="" /> : <span className="rewards-convert__art" />}
                          <div>
                            <small>{pack.amount === 1 ? "Conversão padrão" : "Pacote com bônus"}</small>
                            <h5>{formatRewardAmount(pack.goldGranted || pack.amount)} GOLD {pack.amount === 1 ? "COIN" : "COINS"}</h5>
                            <strong>{formatRewardAmount(pack.pointsCost)} pontos</strong>
                            <p>{savings > 0 ? `Economize ${formatRewardAmount(savings)} pontos ao escolher o pacote.` : "Troque seus pontos por Gold permanente."}</p>
                            <button disabled={busy || pack.enabled === false} onClick={() => askConvert(pack)} type="button">
                              Converter
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <div className="rewards-group">
                  <h4>Conversão para Diamond<span /></h4>
                  <div className="rewards-conversions">
                    {offers.map((offer) => (
                      <article key={offer.amount} className="rewards-convert is-diamond">
                        <img src={art(offer.amount === 1 ? "diamond-1.png" : "diamond-3.png")} alt="" />
                        <div>
                          <small>{offer.amount === 1 ? "Moeda permanente" : "Pacote"}</small>
                          <h5>{offer.amount} DIAMOND{offer.amount === 1 ? "" : "S"}</h5>
                          {offer.enabled && offer.goldCost != null ? (
                            <strong>{formatRewardAmount(offer.goldCost)} Gold</strong>
                          ) : (
                            <strong className="is-soon">EM BREVE</strong>
                          )}
                          <p>
                            {offer.enabled
                              ? "Use Gold acumulado para conquistar Diamond."
                              : "A taxa Gold → Diamond ainda não foi publicada."}
                          </p>
                          <button
                            disabled={busy || !offer.enabled || offer.goldCost == null}
                            onClick={() => offer.goldCost != null && askDiamond({ amount: offer.amount, goldCost: offer.goldCost })}
                            type="button"
                          >
                            {offer.enabled ? "Converter" : "INDISPONÍVEL"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
                <p className="rewards-rule">
                  <b>O caminho é direto: </b>
                  {packages.filter((pack) => pack.enabled !== false).map((pack, index) => (
                    <span key={pack.amount}>
                      {index > 0 ? " · " : ""}
                      <b className="is-gold">{formatRewardAmount(pack.pointsCost)} pontos → {formatRewardAmount(pack.goldGranted || pack.amount)} Gold</b>
                    </span>
                  ))}
                  {" · "}
                  {offers.some((offer) => offer.enabled) ? (
                    offers.filter((offer) => offer.enabled && offer.goldCost != null).map((offer) => (
                      <b key={offer.amount} className="is-blue">{formatRewardAmount(offer.goldCost || 0)} Gold → {offer.amount} Diamond</b>
                    ))
                  ) : (
                    <b className="is-blue">Gold → Diamond ainda não configurado</b>
                  )}
                  .
                </p>
              </div>
            </section>

            <section className="rewards-block" aria-labelledby="rewards-store-title">
              <div className="rewards-block__head">
                <div>
                  <h2 id="rewards-store-title">Loja de <span>Recompensas</span></h2>
                  <p>Use seus Golds para resgatar recompensas e Diamonds para itens premium.</p>
                </div>
                <p>{catalog.length === 1 ? "1 item" : `${catalog.length} itens`}</p>
              </div>
              {catalog.length === 0 ? <p className="rewards-empty">Nenhum item disponível no catálogo.</p> : null}
              <div className="rewards-store">
                {catalog.map((item) => {
                  const file = catalogArtFile(item);
                  const premium = item.premium || item.currency === "DIAMOND";
                  const balance = item.currency === "DIAMOND" ? wallet.diamond : wallet.gold;
                  const percent = affordancePercent(balance, item.price, item.priceConfigured);
                  return (
                    <article key={item.id} className={premium ? "rewards-item is-diamond" : "rewards-item"}>
                      {file ? <img src={art(file)} alt="" /> : <span className="rewards-item__art" />}
                      <div>
                        <small>{catalogType(item)}</small>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <strong>{catalogPrice(item)}</strong>
                        <span className="rewards-item__meta"><span>Progresso</span><span>{percent == null ? "—" : `${percent}%`}</span></span>
                        <span className="rewards-bar"><i style={{ width: `${percent ?? 0}%` }} /></span>
                        {item.redemptionCount != null ? (
                          <span className="rewards-item__meta"><span>Resgates</span><span>{formatRewardAmount(item.redemptionCount)} jogadores</span></span>
                        ) : null}
                        <button disabled={busy || !item.priceConfigured} onClick={() => askRedeem(item)} type="button">Resgatar</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rewards-block" aria-labelledby="rewards-history-title">
              <div className="rewards-block__head">
                <div>
                  <h2 id="rewards-history-title">Histórico de <span>resgates</span></h2>
                  <p>Status confirmado pelo servidor para cada resgate.</p>
                </div>
              </div>
              <div className="rewards-history">
                {redemptions.length === 0 ? <p>Nenhum resgate ainda.</p> : redemptions.map((item) => (
                  <article key={item.id}>
                    <h3>{item.name || "Resgate"}</h3>
                    <p>
                      {formatRewardAmount(item.price ?? item.cost ?? 0)} {item.currency === "DIAMOND" ? "Diamond" : "Gold"}
                      {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString("pt-BR")}` : ""}
                    </p>
                    <p>{STATUS_LABEL[item.status] || item.message || item.status}</p>
                    {item.adminNote ? <p>{item.adminNote}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      {openMission ? (
        <div className="rewards-modal" role="presentation" onClick={() => setSelected(null)}>
          <div aria-labelledby="rewards-mission-dialog" aria-modal="true" className="rewards-modal__box" role="dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <h3 id="rewards-mission-dialog">{openMission.title}</h3>
              <button aria-label="Fechar" onClick={() => setSelected(null)} type="button">×</button>
            </header>
            <p>{periodMeta.one} · {openMission.description}</p>
            <span className="rewards-progress">
              <i><i style={{ width: `${progressPercent(openMission.current, openMission.target)}%` }} /></i>
              <b>{openMission.current} / {openMission.target}</b>
            </span>
            <p className="rewards-modal__reward">Recompensa: +{formatRewardAmount(openMission.rewardPoints)} pontos</p>
            <p>{openMission.completed ? "CONCLUÍDA" : "O progresso atualiza quando você conclui a ação e o servidor confirma."}</p>
            {openMission.eventType === "FORUM_TOPIC_CREATED" || openMission.eventType === "FORUM_COMMENT_CREATED" ? (
              <Link to="/forum">Ir para o fórum</Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
