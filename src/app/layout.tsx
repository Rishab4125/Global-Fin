import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Global Fin", template: "%s · Global Fin" },
  description: "Investment portfolio and realised gain tracker for India",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((t!=='light')&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hideAmounts = (await cookies()).get("hide-amounts")?.value === "1";
  return (
    <html lang="en" className={`${inter.variable}${hideAmounts ? " hide-amounts" : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
