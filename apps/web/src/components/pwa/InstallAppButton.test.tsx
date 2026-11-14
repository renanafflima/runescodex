import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallAppButton } from "./InstallAppButton";

const install = vi.hoisted(() => ({
  status: "unsupported" as "available" | "ios" | "installed" | "unsupported",
  promptInstall: vi.fn(),
  canPrompt: false,
  showAction: false,
}));

vi.mock("../../hooks/usePwaInstall", () => ({
  usePwaInstall: () => install,
}));

describe("InstallAppButton", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    install.status = "unsupported";
    install.promptInstall.mockReset();
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
  });

  it("does not render a dead button without support", () => {
    const { container } = render(<InstallAppButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("prompts Chrome/Android only after an explicit click", async () => {
    install.status = "available";
    render(<InstallAppButton label="Instalar o RuneCodex" />);
    fireEvent.click(screen.getByRole("button", { name: /Instalar o RuneCodex/i }));
    expect(install.promptInstall).toHaveBeenCalledTimes(1);
  });

  it("opens iOS instructions instead of calling prompt", () => {
    install.status = "ios";
    render(<InstallAppButton />);
    fireEvent.click(screen.getByRole("button", { name: /Instalar o RuneCodex/i }));
    expect(install.promptInstall).not.toHaveBeenCalled();
    expect(document.querySelector(".modal__title")).toHaveTextContent("Adicionar à Tela de Início");
    expect(document.querySelector(".home-portal-ios-steps")).toHaveTextContent("Compartilhar");
  });

  it("removes the iOS modal from the document when closed", () => {
    install.status = "ios";
    render(<InstallAppButton />);
    const trigger = screen.getByRole("button", { name: /Instalar o RuneCodex/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Adicionar à Tela de Início" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar modal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("dialog")).not.toBeInTheDocument();
  });

  it("keeps the header button native-prompt only", () => {
    install.status = "ios";
    const { container } = render(<InstallAppButton variant="header" />);
    expect(container).toBeEmptyDOMElement();
    cleanup();

    install.status = "available";
    render(<InstallAppButton variant="header" />);
    expect(screen.getByRole("button", { name: "Instalar" })).toHaveClass("install-action");
  });
});
