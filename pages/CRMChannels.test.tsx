import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CRMChannels from "./CRMChannels";

const useDataMock = vi.fn();
const useCRMStoreMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const supabaseFromMock = vi.fn();
const insertMock = vi.fn();

vi.mock("../services/dataContext", () => ({
  useData: () => useDataMock(),
}));

vi.mock("../components/crm/useCRMStore", () => ({
  useCRMStore: () => useCRMStoreMock(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    confirm: vi.fn(),
  }),
}));

vi.mock("../services/supabase", () => ({
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

const makeSelectOrderChain = (data: any[]) => {
  const order = vi.fn().mockResolvedValue({ data, error: null });
  const chain: any = { order };
  chain.eq = vi.fn().mockReturnValue(chain);
  const select = vi.fn().mockReturnValue(chain);
  return { select, eq: chain.eq, order };
};

describe("CRMChannels unified store behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDataMock.mockReturnValue({
      stores: [
        { id: "store-fortaleza", name: "Fortaleza", city: "Fortaleza" },
        { id: "store-sobral", name: "Sobral", city: "Sobral" },
      ],
    });
    useCRMStoreMock.mockReturnValue({
      selectedStoreId: "store-fortaleza",
      selectedStore: { id: "store-fortaleza", name: "Fortaleza", city: "Fortaleza" },
      stores: [],
      setSelectedStoreId: vi.fn(),
    });
    insertMock.mockResolvedValue({ error: null });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "crm_channels") {
        return {
          ...makeSelectOrderChain([]),
          insert: insertMock,
          update: vi.fn(),
          delete: vi.fn(),
        };
      }
      if (table === "crm_funnels") {
        return makeSelectOrderChain([{ id: "funnel-1", name: "Vendas", store_id: "store-fortaleza" }]);
      }
      if (table === "crm_funnel_stages") {
        return makeSelectOrderChain([{ id: "new_lead" }]);
      }
      return makeSelectOrderChain([]);
    });
  });

  it("does not show store filter or store field", async () => {
    render(<CRMChannels />);

    await screen.findByRole("heading", { name: "CRM Canais" });

    expect(screen.queryByLabelText("Loja")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Novo Canal" }));

    expect(screen.getByRole("heading", { name: "Novo Canal CRM" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Loja")).not.toBeInTheDocument();
  });

  it("creates a channel with the CRM default store automatically", async () => {
    const user = userEvent.setup();
    render(<CRMChannels />);

    await screen.findByRole("heading", { name: "CRM Canais" });
    await user.click(screen.getByRole("button", { name: "Novo Canal" }));
    fireEvent.change(screen.getByLabelText("Nome do Canal"), { target: { value: "WhatsApp Geral" } });
    expect(screen.getByLabelText("Nome do Canal")).toHaveValue("WhatsApp Geral");
    await user.click(screen.getByRole("button", { name: "Salvar Canal" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        store_id: "store-fortaleza",
        name: "WhatsApp Geral",
      }));
    });
    expect(toastErrorMock).not.toHaveBeenCalledWith("Informe loja e nome do canal.");
  });
});
