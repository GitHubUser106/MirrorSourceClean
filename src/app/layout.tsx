import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import InstallPromptWrapper from "@/components/InstallPromptWrapper";
import { Analytics } from '@vercel/analytics/react';

// Optimize font loading - prevents FOUT
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MirrorSource | See the Whole Story",
  description: "Paste any news link to get a neutral AI summary and find free, public coverage of the same story from multiple sources.",
  keywords: ["news", "summary", "alternative sources", "media bias", "free news", "news comparison"],
  authors: [{ name: "MirrorSource" }],
  creator: "MirrorSource", 
  publisher: "MirrorSource",
  metadataBase: new URL("https://mirrorsource.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mirrorsource.app",
    siteName: "MirrorSource",
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link to get a neutral AI summary and find free, public coverage of the same story.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MirrorSource - See the Whole Story",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link to get a neutral AI summary and find free, public coverage of the same story.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MirrorSource",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="Obu9ZJp1ML2sUHm2P5LfOGNNX4FjlX9p9wDI-s_N3Qo" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Skip to content
        </a>
        {children}
        <InstallPromptWrapper />
        <Analytics />
      </body>
    </html>
  );
}