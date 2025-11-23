// src/app/layout.tsx

import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Assuming you kept the font import

const inter = Inter({ subsets: ["latin"] }); // Assuming you kept the font initialization

export const metadata: Metadata = {
  // FINALIZED SEO & SOCIAL CONFIGURATION
  title: "MirrorSource | Free News Summaries & Public Alternatives",
  description: "Don't let a paywall hide the facts. Paste any locked news link to get a neutral AI summary and find free, public coverage of the same story.",
  keywords: [
    "news summary",
    "paywall alternative",
    "free news reader",
    "media bias",
    "article summarizer",
    "public sources",
    "news aggregator"
  ],
  openGraph: {
    title: "MirrorSource | See the Whole Story",
    description: "Hit a paywall? Get a neutral summary and find free alternative sources instantly.",
    url: "https://mirrorsource.app",
    siteName: "MirrorSource",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://mirrorsource.app/og-image.png", // Make sure you have an image at public/og-image.png
        width: 1200,
        height: 630,
        alt: "MirrorSource - Don't let a paywall hide the facts.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MirrorSource | Don't let a paywall hide the facts",
    description: "Paste any locked news link. We'll scout the web for a neutral summary and public coverage.",
    creator: "@MirrorSourceApp", // Update this if you create a handle later
    images: ["https://mirrorsource.app/og-image.png"], // Same image as above
  },
  // Ensure the icon setting is correct for your PNG file:
  icons: {
    icon: "/icon.png", // Using the correct file name we previously fixed
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 ${inter.className}`}>
        
        {/* Main Content Area - grows to fill space */}
        <div className="flex-grow">
            {children}
        </div>

        {/* Footer Section */}
        <footer className="w-full py-6 text-center text-xs border-t border-slate-200">
          <p className="text-slate-500">
            &copy; {new Date().getFullYear()} MirrorSource.{" "}
            <Link href="/legal" className="text-slate-600 underline hover:text-slate-800">
              Legal Information
            </Link>
          </p>
        </footer>

      </body>
    </html>
  );
}