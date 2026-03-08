'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                SIA (Smart Exam Checking & Auto-Grading System) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you visit our website and use our services.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                We collect information you provide directly, such as when you create an account, including
                name, email address, and educational institution information.
              </p>
              <p>
                We automatically collect certain information about your device and how you interact with
                our services, including IP address, browser type, and pages visited.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                We use the information we collect to provide, maintain, and improve our services, process
                transactions, and send transactional and promotional communications.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                If you have questions about this Privacy Policy, please contact us at support@sia-system.com
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
