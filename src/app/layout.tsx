import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MirrorSource",
  description:
    "Want to see the whole story? Paste a news URL, and MirrorSource will find and summarize free, public articles on the same topic from across the web.",
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

        {/* Footer Section - Restored to clean gray style */}
        <footer className="w-full border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} MirrorSource.{" "}
            <Link href="/legal" className="underline hover:text-slate-800">
              Legal Information
            </Link>
          </p>
        </footer>

      </body>
    </html>
  );
}