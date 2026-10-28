import { apiRequest, withQuery } from "./client";
import { readPage, type PageResult } from "./page";

export type ForumThreadStatus = "open" | "closed";

export type ForumAuthor = {
  id: string;
};

export type ForumComment = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  author: ForumAuthor;
  createdByUserId?: string;
};

export type ForumThread = {
  id: string;
  title: string;
  body: string;
  category?: string | null;
  status: ForumThreadStatus;
  createdAt: string;
  updatedAt?: string;
  author: ForumAuthor;
  createdByUserId?: string;
  replyCount: number;
  comments: ForumComment[];
  commentsPage?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

export type ForumListQuery = {
  status?: "OPEN" | "CLOSED";
  category?: string;
  search?: string;
  authorId?: string;
  page?: number;
  limit?: number;
};

export type CreateForumThreadPayload = {
  title: string;
  body: string;
  category: string;
};

function asThread(payload: unknown): ForumThread {
  const data = (payload ?? {}) as Partial<ForumThread>;
  return {
    id: String(data.id ?? ""),
    title: String(data.title ?? ""),
    body: String(data.body ?? ""),
    category: data.category ?? null,
    status: data.status === "closed" ? "closed" : "open",
    createdAt: String(data.createdAt ?? ""),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    author: { id: String(data.author?.id ?? data.createdByUserId ?? "") },
    createdByUserId: data.createdByUserId ? String(data.createdByUserId) : undefined,
    replyCount: Number(data.replyCount) || 0,
    comments: Array.isArray(data.comments)
      ? data.comments.map((comment) => ({
          id: String(comment.id ?? ""),
          text: String(comment.text ?? ""),
          createdAt: String(comment.createdAt ?? ""),
          updatedAt: comment.updatedAt ? String(comment.updatedAt) : undefined,
          author: { id: String(comment.author?.id ?? comment.createdByUserId ?? "") },
          createdByUserId: comment.createdByUserId
            ? String(comment.createdByUserId)
            : undefined,
        }))
      : [],
    commentsPage: data.commentsPage,
  };
}

export async function listForumThreads(query: ForumListQuery = {}) {
  const payload = await apiRequest(
    withQuery("/forum", {
      status: query.status,
      category: query.category,
      search: query.search,
      authorId: query.authorId,
      page: query.page,
      limit: query.limit,
    }),
  );
  const page = readPage<ForumThread>(payload);
  return {
    ...page,
    items: page.items.map(asThread),
  } satisfies PageResult<ForumThread>;
}

export async function getForumThread(id: string, query: { page?: number; limit?: number } = {}) {
  const payload = await apiRequest(
    withQuery(`/forum/${encodeURIComponent(id)}`, {
      page: query.page,
      limit: query.limit,
    }),
  );
  return asThread(payload);
}

export function createForumThread(payload: CreateForumThreadPayload) {
  return apiRequest("/forum", {
    method: "POST",
    json: payload,
  }).then(asThread);
}

export function createForumReply(id: string, payload: { body: string }) {
  return apiRequest(`/forum/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    json: payload,
  }).then(asThread);
}

export function closeForumThread(id: string) {
  return apiRequest(`/forum/${encodeURIComponent(id)}/close`, {
    method: "PATCH",
  }).then(asThread);
}
