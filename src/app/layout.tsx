import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BlockscoutProvider } from "./providers/BlockscoutProvider";
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
  title: "Dan's List - AI-Powered Marketplace",
  description: "Decentralized marketplace with AI agent-based transactions and blockchain monitoring",
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
          {children}
        </BlockscoutProvider>
      </body>
    </html>
  );
}
