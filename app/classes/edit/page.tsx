import ClassEdit from '@/components/pages/ClassEdit';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export const metadata = {
  title: "Edit Class - SIA",
};

export default function ClassEditPage() {
  return (
    <ProtectedLayout>
      <ClassEdit />
    </ProtectedLayout>
  );
}