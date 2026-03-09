import ClassEdit from '@/components/pages/ClassEdit';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export const metadata = {
  title: "Edit Class - GC Scan",
};

interface ClassEditPageProps {
  params: {
    id: string;
  };
}

export default function ClassEditPage({ params }: ClassEditPageProps) {
  return (
    <ProtectedLayout>
      <ClassEdit classId={params.id} />
    </ProtectedLayout>
  );
}