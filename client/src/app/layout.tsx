import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: { default: "BidVault — Live Auction Marketplace", template: "%s | BidVault" },
  description: "Buy and sell rare collectibles, electronics, fashion, and more in real-time live auctions.",
  openGraph: {
    title: "BidVault — Live Auction Marketplace",
    description: "Real-time live auctions for rare finds",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
