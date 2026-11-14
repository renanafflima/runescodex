import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { featuredForumThreads } from "../../domain/forum";
import { listForumThreads, type ForumThread } from "../../services/api/forum";
import { Section } from "../layout/Section";
import { editorialNews, type HomeEditorialItem } from "./home-content";

function threadToItem(thread: ForumThread): HomeEditorialItem {
  return {
    id: thread.id,
    title: thread.title,
    excerpt: thread.body.replace(/\s+/g, " ").trim().slice(0, 140),
    to: `/forum/${thread.id}`,
  };
}

export function HomeNews() {
  const { isAuthenticated, user } = useAuth();
  const premium = Boolean(isAuthenticated && user?.premium?.access);
  const [items, setItems] = useState<HomeEditorialItem[]>(editorialNews);

  useEffect(() => {
    if (!premium) {
      setItems(editorialNews);
      return;
    }

    let cancelled = false;
    void listForumThreads({ page: 1, limit: 6 })
      .then((page) => {
        if (cancelled) return;
        const featured = featuredForumThreads(page.items, 3).map(threadToItem);
        setItems(featured.length > 0 ? featured : editorialNews);
      })
      .catch(() => {
        if (!cancelled) setItems(editorialNews);
      });

    return () => {
      cancelled = true;
    };
  }, [premium]);

  return (
    <Section
      className="home-portal-feed"
      description="Atualizações e discussões em destaque no portal."
      eyebrow="Novidades"
      title="O que está acontecendo"
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
