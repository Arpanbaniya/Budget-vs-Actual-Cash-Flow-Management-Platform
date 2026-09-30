import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import Home from "../app/page";

afterEach(cleanup);

test("illustrative figures are clearly identified", () => {
  render(<Home />);
  expect(screen.getByText("Illustrative")).toBeTruthy();
  expect(screen.getByText("Illustration only")).toBeTruthy();
});
