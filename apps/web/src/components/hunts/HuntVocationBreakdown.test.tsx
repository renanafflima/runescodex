import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HuntVocationBreakdown } from "./HuntVocationBreakdown";
import type { HuntVocation } from "../../services/api/types";

const vocations: HuntVocation[] = [
  { vocation: "ED", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 3_000_000, profitPerHour: 250_000, difficulty: null, notes: null },
  { vocation: "ED", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 3_500_000, profitPerHour: 300_000, difficulty: null, notes: null },
  { vocation: "MS", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 4_500_000, profitPerHour: 250_000, difficulty: null, notes: null },
  { vocation: "MS", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 5_000_000, profitPerHour: 300_000, difficulty: null, notes: null },
];

describe("HuntVocationBreakdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders each vocation with its own level ranges and stats, without mixing them", () => {
    render(<HuntVocationBreakdown vocations={vocations} />);

    const edHeading = screen.getByRole("heading", { name: "Druid" });
    const edGroup = edHeading.closest(".hunt-vocations__group") as HTMLElement;
    expect(within(edGroup).getByText("Level 270–399")).toBeInTheDocument();
    expect(within(edGroup).getByText("3M XP/h · 250k Profit/h")).toBeInTheDocument();
    expect(within(edGroup).getByText("Level 400–600")).toBeInTheDocument();
    expect(within(edGroup).getByText("3,5M XP/h · 300k Profit/h")).toBeInTheDocument();

    const msHeading = screen.getByRole("heading", { name: "Sorcerer" });
    const msGroup = msHeading.closest(".hunt-vocations__group") as HTMLElement;
    expect(within(msGroup).getByText("4,5M XP/h · 250k Profit/h")).toBeInTheDocument();
    expect(within(msGroup).getByText("5M XP/h · 300k Profit/h")).toBeInTheDocument();

    expect(within(edGroup).getAllByText("Recomendada")).toHaveLength(1);
  });

  it("does not assume every hunt has multiple ranges or every vocation", () => {
    render(
      <HuntVocationBreakdown
        vocations={[
          { vocation: "EK", isRecommended: true, levelMin: 100, levelMax: null, xpPerHour: 1_000_000, profitPerHour: 50_000, difficulty: null, notes: null },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByText("Level 100+")).toBeInTheDocument();
  });

  it("renders nothing when the hunt has no vocations", () => {
    const { container } = render(<HuntVocationBreakdown vocations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
