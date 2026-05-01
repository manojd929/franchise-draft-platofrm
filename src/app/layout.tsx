import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { APP_NAME } from "@/constants/app";
import { APP_THEME_STORAGE_KEY } from "@/constants/theme-storage";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Simple live auction for sports clubs: teams, player photos, turn order, and a big TV screen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var k=${JSON.stringify(APP_THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var r=document.documentElement;r.classList.remove("light","dark");var a;if(s==="light"||s==="dark")a=s;else if(s==="system")a=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";else a="dark";r.classList.add(a);}catch(e){document.documentElement.classList.remove("light","dark");document.documentElement.classList.add("dark");}})();`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
