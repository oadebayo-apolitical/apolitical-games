import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Apolitical's brand face is Moderat (licensed). Inter is the closest free
// grotesque and ships as the fallback; the CSS font stack lists "Moderat"
// first so a licensed webfont drops in with no code change.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apolitical Games",
  description: "A little break between meetings.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
