import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { RootProviders } from "@/components/providers/RootProviders";

const poppins = Poppins({
  weight: ["500", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIA - Smart Exam Checking & Auto-Grading System",
  description: "A streamlined, paper-based exam checking solution for efficient exam management and automatic grading.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
