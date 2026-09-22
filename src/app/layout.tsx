import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Golden eagle team",
  description: "Private Squad Community Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  );
}
