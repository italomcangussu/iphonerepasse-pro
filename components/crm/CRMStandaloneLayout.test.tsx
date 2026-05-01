import { render, screen } from "@testing-library/react";
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
});
