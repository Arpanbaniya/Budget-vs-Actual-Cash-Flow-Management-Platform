import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { InsightView } from "../components/insight-workspace";
afterEach(cleanup);
test("insight source and cache status are explicit and commentary remains plain text", () => {
  render(
    <InsightView
      result={{
        provider: "deterministic",
        fallback_used: true,
        cached: true,
        text: "<script>unsafe()</script> Revenue variance -10 NPR.",
      }}
    />,
  );
  expect(screen.getByText("Deterministic fallback")).toBeTruthy();
  expect(screen.getByText("Cached · unchanged facts")).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
});
