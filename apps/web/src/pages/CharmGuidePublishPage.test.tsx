import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { CharmGuidePublishPage } from "./CharmGuidePublishPage";

const api = vi.hoisted(() => ({
  listBestiaryPage: vi.fn(),
  listHuntsPage: vi.fn(),
  createCharmGuide: vi.fn(),
  updateCharmGuide: vi.fn(),
  submitCharmGuide: vi.fn(),
  getHuntBySlug: vi.fn(),
}));

const HYDRA = "c30000001-0001-4000-8000-000000000022";
const BANUTA_HUNT_ID = "hunt-012";

vi.mock("../services/api/bestiary", () => ({
  listBestiaryPage: api.listBestiaryPage,
}));

vi.mock("../services/api/hunts", () => ({
  listHuntsPage: api.listHuntsPage,
  getHuntBySlug: api.getHuntBySlug,
}));

vi.mock("../services/api/charm-guides", () => ({
  createCharmGuide: api.createCharmGuide,
  updateCharmGuide: api.updateCharmGuide,
  submitCharmGuide: api.submitCharmGuide,
}));

const navigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const CREATURE_ID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const GUIDE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function renderPublish() {
  return render(
    <MemoryRouter>
      <CharmGuidePublishPage />
    </MemoryRouter>,
  );
}

async function fillGuideBasics() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Guia teste" } });
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Descrição longa o bastante para publicação." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("CharmGuidePublishPage", () => {
  beforeEach(() => {
    api.listBestiaryPage.mockReset();
    api.listHuntsPage.mockReset();
    api.createCharmGuide.mockReset();
    api.updateCharmGuide.mockReset();
    api.submitCharmGuide.mockReset();
    api.getHuntBySlug.mockReset();
    navigate.mockReset();
    api.listBestiaryPage.mockResolvedValue({ items: [], page: 1, limit: 8, total: 0, hasMore: false });
    api.listHuntsPage.mockResolvedValue({ items: [], page: 1, limit: 8, total: 0, hasMore: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("persists a draft on review and submits that guide id", async () => {
    api.createCharmGuide.mockResolvedValue({
      id: GUIDE_ID,
      title: "Guia teste",
      description: "Descrição longa o bastante para publicação.",
      cpCategory: "CP_100",
      difficulty: "EASY",
      steps: [],
      status: "DRAFT",
    });
    api.updateCharmGuide.mockResolvedValue({
      id: GUIDE_ID,
      title: "Guia teste",
      status: "DRAFT",
      steps: [],
    });
    api.submitCharmGuide.mockResolvedValue({
      id: GUIDE_ID,
      status: "PENDING_REVIEW",
    });

    renderPublish();
    await fillGuideBasics();

    api.listBestiaryPage.mockResolvedValue({
      items: [
        {
          id: CREATURE_ID,
          name: "Dragon",
          slug: "dragon",
          charmPoints: 25,
          locations: [],
          together: [],
          elements: [],
        },
      ],
      page: 1,
      limit: 8,
      total: 1,
      hasMore: false,
    });

    const search = screen.getByPlaceholderText("Nome da criatura");
    fireEvent.change(search, { target: { value: "Dra" } });

    await waitFor(() => {
      expect(api.listBestiaryPage).toHaveBeenCalled();
    });

    await screen.findByRole("button", { name: /Dragon/ });
    fireEvent.click(screen.getByRole("button", { name: /Dragon/ }));

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));

    await waitFor(() => {
      expect(api.createCharmGuide).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Enviar para análise" }));

    await waitFor(() => {
      expect(api.submitCharmGuide).toHaveBeenCalledWith(GUIDE_ID, `publish:${GUIDE_ID}`);
      expect(api.createCharmGuide).toHaveBeenCalledTimes(1);
      expect(api.updateCharmGuide).toHaveBeenCalledTimes(1);
    });

    expect(navigate).toHaveBeenCalledWith(`/bestiary/guides/${GUIDE_ID}`);
  });

  it("shows API message when submit returns 404", async () => {
    api.createCharmGuide.mockResolvedValue({ id: GUIDE_ID, status: "DRAFT", steps: [] });
    api.updateCharmGuide.mockResolvedValue({ id: GUIDE_ID, status: "DRAFT", steps: [] });
    api.submitCharmGuide.mockRejectedValue(
      new ApiError("HTTP_ERROR", 404, "Guia não encontrado.", { message: "Guia não encontrado." }),
    );

    renderPublish();
    await fillGuideBasics();

    api.listBestiaryPage.mockResolvedValue({
      items: [{ id: CREATURE_ID, name: "Dragon", slug: "dragon", locations: [], together: [], elements: [] }],
      page: 1,
      limit: 8,
      total: 1,
      hasMore: false,
    });
    fireEvent.change(screen.getByPlaceholderText("Nome da criatura"), { target: { value: "Dra" } });
    await screen.findByRole("button", { name: /Dragon/ });
    fireEvent.click(screen.getByRole("button", { name: /Dragon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    await waitFor(() => expect(api.createCharmGuide).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Enviar para análise" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Guia não encontrado.");
  });

  it("shows legacy catalog creatures such as Hydra in search results", async () => {
    renderPublish();
    await fillGuideBasics();

    api.listBestiaryPage.mockResolvedValue({
      items: [
        {
          id: HYDRA,
          name: "Hydra",
          slug: "hydra",
          charmPoints: null,
          locations: [],
          together: [],
          elements: [],
        },
      ],
      page: 1,
      limit: 8,
      total: 1,
      hasMore: false,
    });

    fireEvent.change(screen.getByPlaceholderText("Nome da criatura"), { target: { value: "Hyd" } });
    expect(await screen.findByRole("button", { name: /Hydra/ })).toBeInTheDocument();
  });

  it("includes legacy hunt spawn creatures when attaching Banuta", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPublish();
    await fillGuideBasics();

    api.listHuntsPage.mockResolvedValue({
      items: [{ id: BANUTA_HUNT_ID, slug: "banuta", name: "Banuta", location: "Banuta" }],
      page: 1,
      limit: 8,
      total: 1,
      hasMore: false,
    });

    api.getHuntBySlug.mockResolvedValue({
      id: BANUTA_HUNT_ID,
      slug: "banuta",
      name: "Banuta",
      creatures: [
        {
          id: "hc-1",
          creature: {
            id: HYDRA,
            name: "Hydra",
            slug: "hydra",
            image: "",
            bestiary: { charmPoints: null, hasEntry: false },
          },
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText("Nome da Hunt"), { target: { value: "Ban" } });
    vi.advanceTimersByTime(260);
    await waitFor(() => expect(api.listHuntsPage).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: /^Banuta$/ }));
    await waitFor(() => expect(api.getHuntBySlug).toHaveBeenCalledWith("banuta"));
    expect(await screen.findByText(/Hydra/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("drops stale creature search responses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    api.listBestiaryPage
      .mockImplementationOnce(() => slow)
      .mockResolvedValueOnce({
        items: [{ id: CREATURE_ID, name: "Wolf", slug: "wolf", locations: [], together: [], elements: [] }],
        page: 1,
        limit: 8,
        total: 1,
        hasMore: false,
      });

    renderPublish();
    await fillGuideBasics();

    const search = screen.getByPlaceholderText("Nome da criatura");
    fireEvent.change(search, { target: { value: "Wo" } });
    vi.advanceTimersByTime(260);

    fireEvent.change(search, { target: { value: "Wolf" } });
    vi.advanceTimersByTime(260);

    await waitFor(() => expect(api.listBestiaryPage).toHaveBeenCalledTimes(2));

    resolveSlow({
      items: [{ id: CREATURE_ID, name: "Stale", slug: "stale", locations: [], together: [], elements: [] }],
      page: 1,
      limit: 8,
      total: 1,
      hasMore: false,
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Stale/ })).not.toBeInTheDocument();
    });
    await screen.findByRole("button", { name: /Wolf/ });
  });
});
