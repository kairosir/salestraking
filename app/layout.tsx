import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Aimuselim Online Store",
  description: "Aimuselim Online Store - tracking dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-store.png",
    shortcut: "/icon-store.png",
    apple: "/icon-store.png"
  },
  appleWebApp: {
    capable: true,
    title: "Aimuselim",
    statusBarStyle: "default"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Aimuselim" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon-store.png" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('salestraking:theme');if(t==='dark'){document.documentElement.classList.add('theme-dark');document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.classList.remove('theme-dark');document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();"
          }}
        />
      </head>
      <body className={manrope.className}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
