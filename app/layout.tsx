import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Aimuselim Online Store",
  description: "Aimuselim Online Store - tracking dashboard",
  icons: {
    icon: "/icon-store.png",
    shortcut: "/icon-store.png",
    apple: "/icon-store.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={manrope.className}>{children}</body>
    </html>
  );
}
