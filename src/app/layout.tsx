import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/env";
import { THEME_COLORS, themeScript } from "@/lib/theme";

// Variable font — no weight array needed.
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  // Without this, relative OG image URLs resolve against localhost.
  metadataBase: new URL(appUrl()),
  title: "Junto — Sign up. Show up.",
  description:
    "Create an event, set up jobs, share the link. Junto makes group signups effortless.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The head script may set data-theme before React hydrates.
    <html
      lang="en"
      className={`h-full ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
