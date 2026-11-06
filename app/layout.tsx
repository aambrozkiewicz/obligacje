import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Obligacje | Mój portfel" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
