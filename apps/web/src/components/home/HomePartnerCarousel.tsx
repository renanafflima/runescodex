import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../layout/PageContainer";
import { Icon } from "../ui/Icon";
import { homePartnerBanners, type HomePartnerBanner } from "./home-content";

const ROTATE_MS = 7000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function activeBanners(banners: HomePartnerBanner[]) {
  return banners.filter((banner) => banner.active);
}

function BannerSurface({ banner }: { banner: HomePartnerBanner }) {
  const image = (
    <img
      alt={banner.alt}
      className="home-portal-partners__image"
      decoding="async"
      height={360}
      src={banner.image}
      width={1280}
    />
  );

  if (!banner.href) {
    return <div className="home-portal-partners__slide">{image}</div>;
  }

  if (banner.external) {
    return (
      <a
        className="home-portal-partners__slide home-portal-partners__slide--link"
        href={banner.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {image}
      </a>
    );
  }

  return (
    <Link className="home-portal-partners__slide home-portal-partners__slide--link" to={banner.href}>
      {image}
    </Link>
  );
}

export function HomePartnerCarousel() {
  const banners = activeBanners(homePartnerBanners);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const multi = banners.length > 1;

  const goTo = useCallback(
    (next: number) => {
      if (!multi) return;
      const total = banners.length;
      setIndex(((next % total) + total) % total);
    },
    [banners.length, multi],
  );

  useEffect(() => {
    if (!multi || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % banners.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [banners.length, multi, paused, reducedMotion]);

  if (banners.length === 0) return null;

  const current = banners[index] ?? banners[0];

  return (
    <section aria-label="Parcerias e campanhas" className="home-portal-partners">
      <PageContainer className="home-portal-partners__inner" size="wide">
        <div
          className="home-portal-partners__viewport"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setPaused(false);
            }
          }}
          onFocus={() => setPaused(true)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="home-portal-partners__track"
            style={{
              transform: multi ? `translateX(-${index * 100}%)` : undefined,
            }}
          >
            {banners.map((banner) => (
              <div className="home-portal-partners__frame" key={banner.id}>
                <BannerSurface banner={banner} />
              </div>
            ))}
          </div>

          {multi ? (
            <>
              <button
                aria-label="Banner anterior"
                className="home-portal-partners__nav home-portal-partners__nav--prev"
                onClick={() => goTo(index - 1)}
                type="button"
              >
                <Icon name="chevron-right" size={18} />
              </button>
              <button
                aria-label="Próximo banner"
                className="home-portal-partners__nav home-portal-partners__nav--next"
                onClick={() => goTo(index + 1)}
                type="button"
              >
                <Icon name="chevron-right" size={18} />
              </button>
              <div className="home-portal-partners__dots" role="tablist" aria-label="Selecionar banner">
                {banners.map((banner, dotIndex) => (
                  <button
                    aria-label={`Exibir banner ${banner.campaignId}`}
                    aria-selected={dotIndex === index}
                    className="home-portal-partners__dot"
                    key={banner.id}
                    onClick={() => goTo(dotIndex)}
                    role="tab"
                    type="button"
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {multi && current ? (
          <p className="sr-only" aria-live="polite">
            {current.alt}
          </p>
        ) : null}
      </PageContainer>
    </section>
  );
}