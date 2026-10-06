import { apiRequest, withQuery } from "./client";

export type HuntComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: HuntComment[];
};

export type HuntCommentPage = {
  items: HuntComment[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  commentCount: number;
};

export function listHuntComments(slug: string, page = 1, limit = 20) {
  return apiRequest<HuntCommentPage>(
    withQuery(`/hunts/${encodeURIComponent(slug)}/comments`, { page, limit }),
    { auth: true },
  );
}

export function createHuntComment(slug: string, content: string, parentId?: string) {
  return apiRequest<HuntComment>(`/hunts/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    json: parentId ? { content, parentId } : { content },
  });
}

export function updateHuntComment(slug: string, commentId: string, content: string) {
  return apiRequest<HuntComment>(
    `/hunts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`,
    { method: "PATCH", json: { content } },
  );
}

export function deleteHuntComment(slug: string, commentId: string) {
  return apiRequest<HuntComment>(
    `/hunts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );
}

export function likeHuntComment(slug: string, commentId: string) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/like`, {
    method: "POST",
  });
}

export function unlikeHuntComment(slug: string, commentId: string) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}/like`, {
    method: "DELETE",
  });
}
