import { assetUrl } from "../../lib/assets";
import { ButtonLink } from "../ui/Button";

export function HomeRewardsPromo() {
  return (
    <section className="home-portal-rewards" aria-labelledby="home-rewards-title">
      <img alt="" className="home-portal-rewards__mark" src={assetUrl("images/home/rewards.png")} />
      <div>
        <span className="eyebrow">Rewards</span>
        <h2 id="home-rewards-title">Missões, pontos e conquistas.</h2>
        <p>Complete missões, acumule ouro e diamantes e acompanhe o progresso da conta.</p>
        <ButtonLink to="/rewards" variant="secondary">
          Abrir Rewards
        </ButtonLink>
      </div>
    </section>
  );
}
