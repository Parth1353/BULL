import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Bull AI | Financial Research Generator", description: "Evidence-backed financial research reports from company filings." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
