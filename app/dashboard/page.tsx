import { Metadata } from "next";
import Dashboard from "@/components/pages/Dashboard";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Dashboard - GCSC",
};

export default function DashboardPage() {
  return (
    <ProtectedLayout>
      <Dashboard />
    </ProtectedLayout>
  );
}
