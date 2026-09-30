import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow & Forecast | Budget vs Actual + Cash Flow",
  description: "A finance workspace for budget performance and 13-week cash flow planning.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
