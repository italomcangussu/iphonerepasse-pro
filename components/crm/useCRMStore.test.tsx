import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRMStoreProvider, useCRMStore } from "./useCRMStore";

const useDataMock = vi.fn();

vi.mock("../../services/dataContext", () => ({
  useData: () => useDataMock(),
}));

const Probe = () => {
  const { selectedStoreId, selectedStore } = useCRMStore();
  return (
    <div>
      <span data-testid="selected-store-id">{selectedStoreId}</span>
      <span data-testid="selected-store-name">{selectedStore?.name || ""}</span>
    </div>
  );
};

describe("CRMStoreProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem("crm_plus_selected_store_id", "store-sobral");
    useDataMock.mockReturnValue({
      stores: [
        { id: "store-sobral", name: "Sobral", city: "Sobral" },
        { id: "store-fortaleza", name: "Fortaleza", city: "Fortaleza" },
      ],
    });
  });

  it("resolves the CRM default store locally without querying crm_settings.value_text", () => {
    render(
      <CRMStoreProvider>
        <Probe />
      </CRMStoreProvider>,
    );

    expect(screen.getByTestId("selected-store-id")).toHaveTextContent("store-fortaleza");
    expect(screen.getByTestId("selected-store-name")).toHaveTextContent("Fortaleza");
    expect(window.localStorage.getItem("crm_plus_selected_store_id")).toBe("store-sobral");
  });
});
