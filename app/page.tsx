import { Metadata } from "next";
import Landing from "@/components/pages/Landing";

export const metadata: Metadata = {
  title: "GC Scan: Smart Exam Checking System",
  description: "A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results using mobile scanning and web-based management tools.",
};

export default function Home() {
  return <Landing />;
}
