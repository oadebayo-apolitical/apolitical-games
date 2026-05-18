import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "British Connections",
  description: "Group the words into four. With a British accent.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
