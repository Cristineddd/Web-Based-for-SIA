import AuditLogsViewer from "@/components/pages/AuditLogs";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

export default function AuditLogsPage() {
  return (
    <ProtectedLayout>
      <AuditLogsViewer />
    </ProtectedLayout>
  );
}
