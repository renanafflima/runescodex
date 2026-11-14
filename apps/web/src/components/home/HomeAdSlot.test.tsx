import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { HomeAdSlot } from "./HomeAdSlot";

describe("HomeAdSlot", () => {
  afterEach(() => cleanup());

  it("renders nothing when the campaign is inactive", () => {
    const { container } = render(
      <HomeAdSlot
        active={false}
        campaignType="house"
        slot="middle"
        title="Oculto"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes image, title, link and campaign type", () => {
    render(
      <MemoryRouter>
        <HomeAdSlot
          active
          campaignType="season"
          href="/rewards"
          image="/runescodex/images/home/rewards.png"
          slot="primary"
          title="Banner principal"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Banner principal/i });
    expect(link).toHaveAttribute("href", "/rewards");
    expect(link.querySelector("img")).toHaveAttribute("src", "/runescodex/images/home/rewards.png");
  });
});
