import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // 1. ESSENTIAL for LinkedIn/Social Images to show up correctly
  metadataBase: new URL('https://mirrorsource.app'), 

  // 2. SAFE TITLES (No "Paywall" keyword in the title)
  title: "MirrorSource | See the Whole Story",
  
  // 3. SAFE DESCRIPTION (>100 chars for LinkedIn, No "Paywall" keyword)
  description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
  
  keywords: [
    "news summary",
    "public sources",
    "media coverage",
    "article search",
    "neutral news",
    "research tool"
  ],

  openGraph: {
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
    url: "https://mirrorsource.app",
    siteName: "MirrorSource",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", // Resolves via metadataBase
        width: 1200,
        height: 630,
        alt: "MirrorSource - See the whole story",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MirrorSource | See the Whole Story",
    description: "Paste any news link. We’ll scout the web to generate a neutral summary and find free, public coverage of the same story.",
    creator: "@UseMirrorSource", // Updated to your new handle
    images: ["/og-image.png"],
  },

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