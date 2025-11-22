import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MirrorSource | See the Whole Story", 
  description:
    "Want to see the whole story? Paste a news URL, and MirrorSource will find and summarize free, public articles on the same topic from across the web.",
  
  // 👇 1. ADDED: Explicitly points the browser tab icon to the PNG file
  icons: {
    icon: '/icon.png', 
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        
        {/* Main Content Area - grows to fill space */}
        <div className="flex-grow">
            {children}
        </div>

        {/* 👇 2. CLEANED UP: Subtle footer that matches the site aesthetic */}
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