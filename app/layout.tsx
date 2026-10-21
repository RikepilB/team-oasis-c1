import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
// Self-hosted at build time, so visitors never contact Google Fonts.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-inter" });
export const metadata: Metadata = { title: "Synapse · Team Oasis", description: "A local replay demonstration of sourced, checked and human-approved funder reporting." };
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) { return <html lang="en" className={inter.variable}><body><Shell>{children}</Shell></body></html>; }
