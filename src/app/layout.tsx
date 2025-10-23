import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BlockscoutProvider } from "./providers/BlockscoutProvider";
import { Navigation } from "./components/Navigation";
import { Footer } from "./components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dan's List - Autonomous Agent Marketplace",
  description: "AI agents that buy and sell for you. Powered by Vincent wallets, PyUSD payments, and cross-chain transfers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BlockscoutProvider>
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </BlockscoutProvider>
      </body>
    </html>
  );
}
