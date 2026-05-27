import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { RootProviders } from "@/components/providers/RootProviders";

const poppins = Poppins({
  weight: ["600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GCSC",
  description: "Gordon College Smart Check - Automated exam grading system",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/gclogo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GC Scan",
  },
  themeColor: "#16a34a",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GC Scan" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className={poppins.variable + " antialiased"}>
        <RootProviders>{children}</RootProviders>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}