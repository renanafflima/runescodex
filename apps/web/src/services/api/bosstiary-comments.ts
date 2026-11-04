import { apiRequest, withQuery } from "./client";

export type BosstiaryComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: BosstiaryComment[];
};

export type BosstiaryCommentPage = {
  items: BosstiaryComment[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  commentCount: number;
};

export function listBosstiaryComments(slug: string, page = 1, limit = 20) {
  return apiRequest<BosstiaryCommentPage>(
    withQuery(`/bosstiary/${encodeURIComponent(slug)}/comments`, { page, limit }),
    { auth: true },
  );
}

export function createBosstiaryComment(slug: string, content: string, parentId?: string) {
  return apiRequest<BosstiaryComment>(`/bosstiary/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    json: parentId ? { content, parentId } : { content },
  });
}

export function updateBosstiaryComment(slug: string, commentId: string, content: string) {
  return apiRequest<BosstiaryComment>(
    `/bosstiary/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`,
    { method: "PATCH", json: { content } },
  );
}

export function deleteBosstiaryComment(slug: string, commentId: string) {
  return apiRequest<BosstiaryComment>(
    `/bosstiary/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );
}

export function likeBosstiaryComment(slug: string, commentId: string) {
  return apiRequest(`/bosstiary/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/like`, {
    method: "POST",
  });
}

export function unlikeBosstiaryComment(slug: string, commentId: string) {
  return apiRequest(`/bosstiary/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/like`, {
    method: "DELETE",
  });
}
