import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "../globals.css";
import { RootProviders } from "@/components/providers/RootProviders";

const poppins = Poppins({
  weight: ["600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: "GCSC",
  description: "Gordon College Smart Check - Automated exam grading system",
  icons: {
    icon: "/favicon.ico",
    apple: "/gclogo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GC Smart Check",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.variable + " antialiased"}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}