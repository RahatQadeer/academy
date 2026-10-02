import "./globals.css";
import type { Metadata } from "next";
import { AuthHashHandler } from "@/base/auth/AuthHashHandler";

export const metadata: Metadata = {
  title: "Private Attaché — Whitby plans and runs it with you.",
  description:
    "Bring a relocation, a board packet, or a residence opening. Whitby drafts it and runs it with you.",
  openGraph: {
    title: "Private Attaché — Whitby plans and runs it with you.",
    description:
      "Bring a relocation, a board packet, or a residence opening. Whitby drafts it and runs it with you.",
    type: "website",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/monogram.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-clip">
      <body className="min-h-dvh max-w-full overflow-x-clip bg-canvas antialiased">
        <AuthHashHandler />
        {children}
      </body>
    </html>
  );
}
