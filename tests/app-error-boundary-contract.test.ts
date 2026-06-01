import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("app error boundary contract", () => {
  it("wraps the React app root so route transition crashes do not leave a blank screen", () => {
    const entry = read("index.tsx");

    expect(entry).toContain("AppErrorBoundary");
    expect(entry).toContain("<AppErrorBoundary>");
    expect(entry).toContain("</AppErrorBoundary>");
  });
});
