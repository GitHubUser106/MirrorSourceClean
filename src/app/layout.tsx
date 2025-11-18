import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MirrorSource",
  description: "Want to see the whole story? Paste a news URL, and MirrorSource will find and summarize free, public articles on the same topic from across the web.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
