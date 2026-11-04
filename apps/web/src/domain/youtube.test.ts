import { describe, expect, it } from "vitest";
import { youtubeThumbnailUrl, youtubeVideoId } from "./youtube";

describe("youtube helpers", () => {
  it("extracts the id from a watch URL", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts the id from a short youtu.be URL", () => {
    expect(youtubeVideoId("https://youtu.be/abc123")).toBe("abc123");
  });

  it("extracts the id from an embed URL", () => {
    expect(youtubeVideoId("https://www.youtube.com/embed/abc123")).toBe("abc123");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(youtubeVideoId("https://example.com/video")).toBeNull();
  });

  it("returns null for a missing URL", () => {
    expect(youtubeVideoId(null)).toBeNull();
    expect(youtubeVideoId(undefined)).toBeNull();
  });

  it("builds a thumbnail URL from a real video id, without inventing one otherwise", () => {
    expect(youtubeThumbnailUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://img.youtube.com/vi/abc123/hqdefault.jpg",
    );
    expect(youtubeThumbnailUrl("https://example.com/video")).toBeNull();
  });
});
