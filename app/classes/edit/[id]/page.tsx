import ClassEdit from '@/components/pages/ClassEdit';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export const metadata = {
  title: "Edit Class - GC Scan",
};

interface ClassEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClassEditPage({ params }: ClassEditPageProps) {
  const { id } = await params;
  return (
    <ProtectedLayout>
      <ClassEdit classId={id} />
    </ProtectedLayout>
  );
}