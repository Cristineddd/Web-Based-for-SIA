import { Metadata } from "next";
import NewExam from "@/components/pages/NewExam";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export const metadata: Metadata = {
  title: "New Exam - GCSC",
};

export default function NewExamPage() {
  return (
    <ProtectedLayout>
      <NewExam />
    </ProtectedLayout>
  );
}
