import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import UploadSummaryReport from '@/components/pages/UploadSummaryReport';

export default function UploadReportPage() {
  return (
    <ProtectedLayout>
      <UploadSummaryReport />
    </ProtectedLayout>
  );
}
