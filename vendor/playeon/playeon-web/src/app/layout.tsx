import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { TelegramInit } from "./telegram-init";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Playeon",
    template: "%s · Playeon",
  },
  description: "Playeon",
  applicationName: "Playeon",
  appleWebApp: {
    capable: true,
    title: "Playeon",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // required for env(safe-area-inset-*) to resolve in the mini app
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f4" },
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{
        '--font-onest': 'system-ui, sans-serif',
        '--font-rubik': 'system-ui, sans-serif',
        '--font-geist-mono': 'ui-monospace, monospace',
      } as React.CSSProperties}
      // telegram-web-app.js sets --tg-viewport-* inline on <html> before
      // hydration, and TelegramInit adds data-theme; neither exists on the server
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
          Safari pinned tabs need a monochrome SVG mask. Declared here rather
          than in `metadata.icons`, because setting that key drops the app-dir
          icon.png / apple-icon.png tags. React hoists this into <head>.
        */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#3a48a0" />
        {/* must run before hydration so WebApp exists when TelegramInit mounts */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js?59"
          strategy="beforeInteractive"
        />
        <TelegramInit />
        {children}
      </body>
    </html>
  );
}
