import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // 1. Sets the base URL for all relative links (Best Practice)
  metadataBase: new URL('https://mirrorsource.app'),

  // 2. Safe Title & Description
  title: "MirrorSource | See the Whole Story",
  description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
  
  keywords: [
    "news summary",
    "public sources",
    "media coverage",
    "article search",
    "neutral news",
    "research tool"
  ],

  // 3. OpenGraph (Facebook, LinkedIn, Discord)
  openGraph: {
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
    url: "https://mirrorsource.app",
    siteName: "MirrorSource",
    locale: "en_US",
    type: "website",
    images: [
      {
        // FORCE ABSOLUTE URL: This fixes the "No Image" error on LinkedIn
        url: "https://www.mirrorsource.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "MirrorSource - See the whole story",
      },
    ],
  },

  // 4. Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
    creator: "@UseMirrorSource", // Your new handle
    images: ["https://www.mirrorsource.app/og-image.png"], // Force absolute URL here too
  },

  // 5. Icons
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
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