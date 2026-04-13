import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "../globals.css";
import { RootProviders } from "@/components/providers/RootProviders";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GCSC",
  description: "Gordon College Smart Check - Automated exam grading system",
  icons: {
    icon: "/favicon.ico",
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