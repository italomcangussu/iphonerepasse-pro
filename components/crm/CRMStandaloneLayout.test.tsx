import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CRMStandaloneLayout from "./CRMStandaloneLayout";

const useAuthMock = vi.fn();
const useCRMStoreMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("./useCRMStore", () => ({
  useCRMStore: () => useCRMStoreMock(),
}));

vi.mock("../BrandLogo", () => ({
  default: () => <div>Logo</div>,
}));

describe("CRMStandaloneLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    useAuthMock.mockReturnValue({
      role: "admin",
      user: { email: "admin@iphonerepasse.com" },
      signOut: signOutMock,
    });
    useCRMStoreMock.mockReturnValue({
      stores: [
        { id: "store-1", name: "Fortaleza", city: "Fortaleza" },
        { id: "store-2", name: "Sobral", city: "Sobral" },
      ],
      selectedStoreId: "store-1",
      selectedStore: { id: "store-1", name: "Fortaleza", city: "Fortaleza" },
      setSelectedStoreId: vi.fn(),
    });
  });

  it("does not render a global store selector in CRM Plus", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route index element={<div>Conteúdo CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Loja")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Loja" })).not.toBeInTheDocument();
    expect(screen.getByText("Conteúdo CRM")).toBeInTheDocument();
  });

  it("shows the simulator entry to CRM sellers and admins", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route index element={<div>Conteúdo CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Simulador/i })).toBeInTheDocument();
  });

  it("keeps the conversation layout mode for direct conversation routes", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/conversations/conversation-1"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route path="/conversations/:conversationId" element={<div>Thread aberta</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Thread aberta")).toBeInTheDocument();
    expect(container.querySelector(".crm-shell-grid")).toHaveClass("is-crm-conversation-route");
  });

  it("hides the desktop menu from the icon inside the sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={["/conversations"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route path="/conversations" element={<div>Conversas CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const brand = container.querySelector(".crm-brand");
    expect(brand).not.toBeNull();
    await user.click(within(brand as HTMLElement).getByRole("button", { name: "Ocultar menu lateral" }));

    expect(container.querySelector(".crm-shell-grid")).toHaveClass("is-sidebar-hidden");
  });

  it("renders a five-item bottom tab bar on mobile with role-aware primary pages", () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route index element={<div>Conteúdo CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const tabBar = screen.getByRole("navigation", { name: "Navegação principal CRM" });
    expect(tabBar).toHaveClass("crm-mobile-tabbar");
    expect(within(tabBar).getAllByRole("link")).toHaveLength(4);
    expect(within(tabBar).getByRole("link", { name: /Conversas/i })).toBeInTheDocument();
    expect(within(tabBar).getByRole("link", { name: /Leads/i })).toBeInTheDocument();
    expect(within(tabBar).getByRole("link", { name: /Simulador/i })).toBeInTheDocument();
    expect(within(tabBar).getByRole("link", { name: /Estatísticas/i })).toBeInTheDocument();
    expect(within(tabBar).getByRole("button", { name: /Mais/i })).toBeInTheDocument();
  });

  it("does not render the global CRM header on mobile", () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={["/leads"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route path="/leads" element={<div>Leads CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação principal CRM" })).toBeInTheDocument();
    expect(screen.getByText("Leads CRM")).toBeInTheDocument();
  });

  it("keeps the hidden viewport debug hotspot inside the status-bar safe area", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route index element={<button type="button">Voltar</button>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const hotspot = container.querySelector('button[aria-hidden="true"][tabindex="-1"]');
    expect(hotspot).toHaveStyle({ height: "env(safe-area-inset-top, 0px)" });
  });

  it("opens the mobile more sheet with overflow pages allowed for the current role", async () => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<CRMStandaloneLayout />}>
            <Route index element={<div>Conteúdo CRM</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Mais/i }));

    const sheet = screen.getByRole("dialog", { name: "Mais páginas do CRM" });
    expect(within(sheet).getByRole("link", { name: /Comentários/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /Configurações/i })).toBeInTheDocument();
  });
});
