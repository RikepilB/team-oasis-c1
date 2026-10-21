/* eslint-disable @next/next/no-page-custom-font -- this is the App Router root layout, so the Inter link loads on every page */
import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
export const metadata: Metadata = { title: "Synapse · Team Oasis", description: "A local replay demonstration of sourced, checked and human-approved funder reporting." };
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) { return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" /></head><body><Shell>{children}</Shell></body></html>; }
