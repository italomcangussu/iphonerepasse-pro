import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CRMPwaControls from "./CRMPwaControls";

const mockPush = vi.hoisted(() => ({
  status: "default",
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

const mockPwa = vi.hoisted(() => ({
  state: {
    ready: true,
    isStandalone: true,
    isIOS: true,
    registration: null,
    updateAvailable: false,
    installPromptEvent: null,
  },
}));

vi.mock("../../hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(() => ({
    status: mockPush.status,
    platform: "ios",
    subscribe: mockPush.subscribe,
    unsubscribe: mockPush.unsubscribe,
    updateTopics: vi.fn(),
  })),
}));

vi.mock("../../services/pwa", () => ({
  getPwaState: vi.fn(() => mockPwa.state),
  promptInstall: vi.fn(),
  subscribePwa: vi.fn(() => vi.fn()),
}));

describe("CRMPwaControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPush.status = "default";
    mockPush.subscribe.mockReset();
    mockPush.unsubscribe.mockReset();
    mockPwa.state = {
      ready: true,
      isStandalone: true,
      isIOS: true,
      registration: null,
      updateAvailable: false,
      installPromptEvent: null,
    };

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
    });
  });

  it("shows a persistent activation banner when CRM Plus is installed but push is not active", () => {
    render(<CRMPwaControls />);

    expect(screen.getByRole("status", { name: "Ativar notificações CRM" })).toBeInTheDocument();
    expect(screen.getByText(/Ative notificações para receber novas mensagens/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar notificações CRM" })).toBeInTheDocument();
  });

  it("does not show the activation banner before the iOS PWA is installed", () => {
    mockPush.status = "needs_install";
    mockPwa.state = {
      ...mockPwa.state,
      isStandalone: false,
    };

    render(<CRMPwaControls />);

    expect(screen.queryByRole("status", { name: "Ativar notificações CRM" })).not.toBeInTheDocument();
  });

  it("hides the activation banner for 14 days after it is dismissed", () => {
    localStorage.setItem(
      "push.permission.prompt.dismissed.at:crmplus",
      String(Date.now()),
    );

    render(<CRMPwaControls />);

    expect(screen.queryByRole("status", { name: "Ativar notificações CRM" })).not.toBeInTheDocument();
  });

  it("shows the activation banner again after the 14 day dismissal window", () => {
    localStorage.setItem(
      "push.permission.prompt.dismissed.at:crmplus",
      String(Date.now() - 15 * 24 * 60 * 60 * 1000),
    );

    render(<CRMPwaControls />);

    expect(screen.getByRole("status", { name: "Ativar notificações CRM" })).toBeInTheDocument();
  });

  it("subscribes to CRM topics from the persistent activation banner", async () => {
    const user = userEvent.setup();

    render(<CRMPwaControls />);

    await user.click(screen.getByRole("button", { name: "Ativar notificações CRM" }));
    await user.click(await screen.findByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(mockPush.subscribe).toHaveBeenCalledWith(["crm_inbox", "transfer_pending", "new_lead"], undefined, "granted");
    });
  });
});
