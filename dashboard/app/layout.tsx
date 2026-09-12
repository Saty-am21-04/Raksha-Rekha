import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ExtensionNoiseFilter } from "@/components/extension-noise-filter";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAKSHA-REKHA — Disaster Relocation Planning",
  description:
    "Geospatial decision support for prioritising habitation relocation from hazard-prone zones. Wayanad, Kerala prototype.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * suppressHydrationWarning on <html> and <body> is defensive, not a cover-up.
 *
 * Ad-blocker and security extensions mutate the DOM before React hydrates,
 * stamping attributes onto elements they have scanned — we see bis_skin_checked,
 * bis_register and __processed_<uuid>__ from extension
 * eppiocemhmnlbhjplcgkofciiegomcon. React then compares its server HTML against
 * an already-modified DOM and reports a mismatch that no application change can
 * prevent.
 *
 * These two elements are the whole of it now. The dashboard subtree, which the
 * extension stamped on roughly 25 nested divs, is no longer server-rendered at
 * all — see components/dashboard-client.tsx. That matters because this flag
 * applies only to the element it is set on and never to descendants, so it could
 * never have covered that tree.
 *
 * This app has no genuine hydration hazard: no typeof window branches, no
 * Date.now()/Math.random(), and every number format pins an explicit "en-IN"
 * locale so server and client render identical strings. Audited before adding
 * this.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="bg-bg text-fg min-h-full flex flex-col"
      >
        <ExtensionNoiseFilter />
        {children}
      </body>
    </html>
  );
}
