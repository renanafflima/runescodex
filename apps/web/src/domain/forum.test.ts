import { describe, expect, it } from "vitest";
import {
  composeForumBody,
  featuredForumThreads,
  forumAuthorLabel,
  forumCategoryLabel,
  forumExcerpt,
  forumReplyCount,
  formatForumRelativeTime,
  normalizeForumCategory,
  validateForumCompose,
} from "./forum";

describe("forum domain", () => {
  it("normalizes known categories and rejects unknown values", () => {
    expect(normalizeForumCategory("hunts")).toBe("HUNTS");
    expect(normalizeForumCategory("TIPS")).toBe("TIPS");
    expect(normalizeForumCategory("geral")).toBeNull();
    expect(forumCategoryLabel("BESTIARY")).toBe("Bestiário");
    expect(forumCategoryLabel(null)).toBe("Geral");
  });

  it("never exposes private author data", () => {
    expect(forumAuthorLabel("user-abcdef", "user-abcdef")).toBe("Você");
    expect(forumAuthorLabel("user-abcdef")).toBe("Aventureiro · user-abc");
  });

  it("picks featured threads from real reply counts", () => {
    const featured = featuredForumThreads([
      { id: "a", replyCount: 1, createdAt: "2026-01-02" },
      { id: "b", replyCount: 8, createdAt: "2026-01-01" },
      { id: "c", comments: [{}, {}], createdAt: "2026-01-03" },
    ]);
    expect(featured.map((item) => item.id)).toEqual(["b", "c"]);
    expect(forumReplyCount({ comments: [{}, {}, {}] })).toBe(3);
  });

  it("appends optional hunt context and validates required fields", () => {
    expect(
      composeForumBody({
        title: "Hunt",
        category: "HUNTS",
        body: "Preciso de uma rota.",
        level: "250",
        vocation: "EK",
      }),
    ).toContain("Level: 250");

    expect(
      validateForumCompose({ title: "", category: "", body: "" }),
    ).toEqual({
      title: "Informe um título objetivo para a discussão.",
      category: "Escolha uma categoria.",
      body: "Descreva o assunto com contexto suficiente.",
    });

    expect(
      validateForumCompose({
        title: "Qual hunt vocês recomendam?",
        category: "HUNTS",
        body: "Estou no 200 EK e quero XP com algum profit.",
      }),
    ).toEqual({});
  });

  it("formats relative dates and excerpts", () => {
    const now = new Date("2026-10-09T12:00:00.000Z").getTime();
    expect(formatForumRelativeTime("2026-10-09T11:48:00.000Z", now)).toBe("há 12 min");
    expect(forumExcerpt("  uma   frase longa o suficiente para cortar o texto extra aqui mesmo  ", 24)).toMatch(/…$/);
  });
});
