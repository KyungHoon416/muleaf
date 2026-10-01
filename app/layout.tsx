import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "muleaf · 뮤리프 — Beyond Music",
  description: "발견하고, 듣고, 함께 만드는 AI 음악. 뮤리프에서 만나는 새로운 음악.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
