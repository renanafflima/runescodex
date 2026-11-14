import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeTriTechBanner } from "./HomeTriTechBanner";

describe("HomeTriTechBanner", () => {
  afterEach(() => cleanup());

  it("links to TriTech in a new tab", () => {
    render(<HomeTriTechBanner />);

    const link = screen.getByRole("link", { name: /TriTech — Soluções Digitais/i });
    expect(link).toHaveAttribute("href", "https://tritech.app.br");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("tritech-institutional-banner.png"),
    );
  });
});