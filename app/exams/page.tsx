import { Metadata } from "next";
import Exams from "@/components/pages/Exams";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "Exams - GCSC",
};

export default function ExamsPage() {
  return (
    <ProtectedLayout>
      <Exams />
    </ProtectedLayout>
  );
}
