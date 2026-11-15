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
        campaignId="demo"
        description="Descrição"
        eyebrow="Promoção"
        id="inactive"
        slot="primary"
        title="Oculto"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes image, title, description and link", () => {
    render(
      <MemoryRouter>
        <HomeAdSlot
          active
          campaignId="natal-demo"
          description="Indique um amigo e ganhe 25 TC Globais."
          eyebrow="Promoção de Natal"
          href="/rewards"
          id="promo"
          image="/runescodex/images/home/rewards.png"
          imageAlt="Recompensas"
          slot="primary"
          theme="seasonal"
          title="Não perca a promoção de Natal!"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: /Não perca a promoção de Natal!/i,
    });
    expect(link).toHaveAttribute("href", "/rewards");
    expect(screen.getByText(/Indique um amigo e ganhe 25 TC Globais/i)).toBeInTheDocument();
    expect(link.querySelector("img")).toHaveAttribute("src", "/runescodex/images/home/rewards.png");
  });
});