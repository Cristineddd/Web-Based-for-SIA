import ValidationLogs from '@/components/pages/ValidationLogs';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export default function ValidationLogsPage() {
  return (
    <ProtectedLayout>
      <ValidationLogs />
    </ProtectedLayout>
  );
}
