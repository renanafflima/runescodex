export const FORUM_CATEGORIES = [
  { id: "bestiary", api: "BESTIARY", titleKey: "forum.catBestiary" },
  { id: "hunts", api: "HUNTS", titleKey: "forum.catHunts" },
  { id: "profit", api: "PROFIT", titleKey: "forum.catProfit" },
  { id: "xp", api: "XP", titleKey: "forum.catXp" },
  { id: "tips", api: "TIPS", titleKey: "forum.catTips" },
];

const BY_ID = new Map(FORUM_CATEGORIES.map((item) => [item.id, item]));
const BY_API = new Map(FORUM_CATEGORIES.map((item) => [item.api, item]));

export function forumCategoryById(id) {
  return BY_ID.get(id) || null;
}

export function forumCategoryTitleKey(value) {
  const api = String(value || "").trim().toUpperCase();
  return BY_API.get(api)?.titleKey || "";
}

export function forumThreadPayload({ title, body, categoryId }) {
  const category = forumCategoryById(categoryId);
  const trimmedTitle = String(title || "").trim();
  const trimmedBody = String(body || "").trim();
  if (!category || !trimmedTitle || !trimmedBody) return null;
  return {
    title: trimmedTitle,
    body: trimmedBody,
    category: category.api,
  };
}
