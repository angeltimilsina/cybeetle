import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cybeetle AI",
  description: "Cybeetle Browser: an integrated AI workspace with browser sessions, voice, and saved conversations.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
