import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdsPage from "./AdsPage";

const supabaseRpcMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("../../services/supabase", () => ({
  supabase: {
    rpc: (...args: any[]) => supabaseRpcMock(...args),
  },
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({
    error: toastErrorMock,
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("../../components/crm/useCRMStore", () => ({
  useCRMStore: () => ({
    selectedStoreId: "store-1",
    selectedStore: { id: "store-1", name: "Fortaleza" },
    stores: [{ id: "store-1", name: "Fortaleza" }],
    setSelectedStoreId: vi.fn(),
  }),
}));

vi.mock("../../components/crm/CRMPageFrame", () => ({
  default: ({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}));

describe("AdsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseRpcMock.mockResolvedValue({
      data: {
        summary: {
          active_campaigns: 1,
          total_campaigns: 1,
          total_leads: 4,
          total_customers: 3,
          real_customers: 2,
          total_revenue: 10780,
          direct_revenue: 10780,
          fallback_revenue: 0,
          conversion_rate: 0.75,
          real_conversion_rate: 0.5,
        },
        groups: [
          {
            group_key: "campaign-15-pro",
            auto_name: "Campanha iPhone 15 Pro",
            status: "approved",
            source_app: "facebook",
            sample_title: "iPhone 15 Pro na vitrine",
            sample_body: "Oferta limitada",
            sample_media_url: null,
            sample_thumbnail_url: null,
            sample_source_url: "https://facebook.example/ad",
            creative_image_url: null,
            creative_source_url: "https://facebook.example/ad",
            first_seen_at: "2026-07-01T10:00:00.000Z",
            last_seen_at: "2026-07-07T10:00:00.000Z",
            last_attribution_at: "2026-07-07T11:00:00.000Z",
            attributions: 4,
            leads: 4,
            customers: 3,
            real_customers: 2,
            revenue: 10780,
            direct_revenue: 10780,
            fallback_revenue: 0,
            conversion_rate: 0.75,
            real_conversion_rate: 0.5,
            score: 100,
            grade: "A",
            is_active: true,
            conversions: [
              {
                lead_id: "lead-2",
                lead_name: "Joao Lead",
                lead_phone: "+5585888880000",
                customer_id: "cust-1",
                customer_name: "Joao Cliente",
                customer_phone: "+5585888880000",
                sale_id: "sale-1",
                sale_number: 42,
                sale_total: 5390,
                sale_date: "2026-07-08T12:00:00.000Z",
                sale_store_id: "store-2",
                items_count: 1,
                product_models: ["iPhone 15 Pro 256GB"],
                conversion_source: "customer_id_sale",
              },
            ],
          },
        ],
      },
      error: null,
    });
  });

  it("opens a campaign traceability panel with real conversion, lead, customer and purchase details", async () => {
    render(<AdsPage />);

    const campaignButton = await screen.findByRole("button", { name: /Campanha iPhone 15 Pro/i });
    expect(screen.getAllByText("Conversao real").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50.0%").length).toBeGreaterThan(0);

    fireEvent.click(campaignButton);

    const panel = await screen.findByRole("region", { name: /Detalhes da campanha Campanha iPhone 15 Pro/i });
    expect(within(panel).getByText("Joao Lead")).toBeInTheDocument();
    expect(within(panel).getByText(/Cliente: Joao Cliente/)).toBeInTheDocument();
    expect(within(panel).getByText(/#42/)).toBeInTheDocument();
    expect(within(panel).getByText(/R\$ 5\.390/)).toBeInTheDocument();
    expect(within(panel).getByText("iPhone 15 Pro 256GB")).toBeInTheDocument();
    expect(within(panel).getByText("Venda pelo cliente vinculado")).toBeInTheDocument();
    expect(within(panel).getByText("Sem mídia")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Anuncio/i })).toHaveAttribute("href", "https://facebook.example/ad");

    await waitFor(() => {
      expect(supabaseRpcMock).toHaveBeenCalledWith("get_crm_ads_dashboard", { p_store_id: "store-1" });
    });
  });
});
