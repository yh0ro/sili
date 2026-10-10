import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Silicon Man",
  description: "Create an AI Agent. It explores the world, meets others, and remembers.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="preload" href="/fonts/plex-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
