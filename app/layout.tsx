import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
export const metadata: Metadata = { title: "Synapse · Team Oasis", description: "A local replay demonstration of sourced, checked and human-approved funder reporting." };
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) { return <html lang="en"><body><Shell>{children}</Shell></body></html>; }
