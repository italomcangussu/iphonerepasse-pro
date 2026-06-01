import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";

const ThrowingChild = () => {
  throw new Error("route chunk failed");
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("shows a recovery screen instead of leaving the app blank", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: /Não foi possível abrir esta tela/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recarregar app/i })).toBeInTheDocument();
  });
});
