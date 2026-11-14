import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  listCommunityRotations,
  type CommunityRotationCard,
} from "../../services/api/community-rotations";
import { Section } from "../layout/Section";
import { editorialCommunity, type HomeEditorialItem } from "./home-content";

function rotationToItem(rotation: CommunityRotationCard): HomeEditorialItem {
  return {
    id: rotation.id,
    title: rotation.title,
    excerpt: rotation.description?.trim() || "Rota compartilhada pela comunidade.",
    to: `/bosstiary/community/${rotation.id}`,
  };
}

export function HomeCommunityHighlights() {
  const { isAuthenticated, user } = useAuth();
  const premium = Boolean(isAuthenticated && user?.premium?.access);
  const [items, setItems] = useState<HomeEditorialItem[]>(editorialCommunity);

  useEffect(() => {
    if (!premium) {
      setItems(editorialCommunity);
      return;
    }

    let cancelled = false;
    void listCommunityRotations({ page: 1, limit: 4, sort: "LIKES" })
      .then((page) => {
        if (cancelled) return;
        const live = page.items.slice(0, 4).map(rotationToItem);
        setItems(live.length > 0 ? live : editorialCommunity);
      })
      .catch(() => {
        if (!cancelled) setItems(editorialCommunity);
      });

    return () => {
      cancelled = true;
    };
  }, [premium]);

  return (
    <Section
      className="home-portal-feed"
      description="Rotas e conversas para jogar junto."
      eyebrow="Comunidade"
      title="Destaques da comunidade"
    >
      <div className="home-portal-feed__grid">
        {items.map((item) => (
          <Link className="home-portal-feed__card" key={item.id} to={item.to}>
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
