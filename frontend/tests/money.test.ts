import { expect, test } from "vitest";
import { money } from "../components/finance-shared";
test("money display preserves decimals beyond binary floating-point precision", () => {
  expect(
    money("100000000000000000000.01", "NPR").replaceAll("\u00a0", " "),
  ).toBe("NPR 100,000,000,000,000,000,000.01");
  expect(money("9007199254740993.125")).toBe("9,007,199,254,740,993.13");
  expect(money("-0.125", "USD")).toBe("-$0.13");
  expect(money(null)).toBe("—");
});
