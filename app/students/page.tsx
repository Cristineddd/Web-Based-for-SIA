import Students from '@/components/pages/Students';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export default function StudentsPage() {
  return (
    <ProtectedLayout>
      <Students />
    </ProtectedLayout>
  );
}
