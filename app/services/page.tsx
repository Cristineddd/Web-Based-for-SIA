import { Services } from '@/components/pages/Services';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export const metadata = {
  title: 'System Services | SIA',
  description: 'Explore all available system services and features',
};

export default function ServicesPage() {
  return (
    <ProtectedLayout>
      <Services />
    </ProtectedLayout>
  );
}
