import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePartnerCarousel } from "./HomePartnerCarousel";
import * as homeContent from "./home-content";

function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("HomePartnerCarousel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.restoreAllMocks();
    stubMatchMedia();
  });

  it("renders the active partner banner", () => {
    render(
      <MemoryRouter>
        <HomePartnerCarousel />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: /Campanha de parceria RuneCodex/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Próximo banner/i })).not.toBeInTheDocument();
  });

  it("shows carousel controls when multiple active banners exist", () => {
    const first = homeContent.homePartnerBanners[0]!;
    vi.spyOn(homeContent, "homePartnerBanners", "get").mockReturnValue([
      first,
      {
        active: true,
        id: "partner-second",
        campaignId: "parceria-segunda",
        alt: "Segunda campanha de parceria",
        image: first.image,
      },
    ]);

    render(
      <MemoryRouter>
        <HomePartnerCarousel />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Próximo banner" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo banner" }));
    expect(screen.getByRole("img", { name: /Segunda campanha de parceria/i })).toBeInTheDocument();
  });
});