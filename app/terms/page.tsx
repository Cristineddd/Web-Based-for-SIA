'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground mt-2">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                By accessing and using SIA, you accept and agree to be bound by the terms and provision
                of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Use License</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Permission is granted to temporarily download one copy of the materials (information or
                software) on SIA for personal, non-commercial transitory viewing only. This is the grant
                of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Modifying or copying the materials</li>
                <li>Using the materials for any commercial purpose</li>
                <li>Attempting to decompile or reverse engineer any software</li>
                <li>Removing any copyright or other proprietary notations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                The materials on SIA are provided on an 'as is' basis. SIA makes no warranties, expressed
                or implied, and hereby disclaims and negates all other warranties including, without limitation,
                implied warranties or conditions of merchantability, fitness for a particular purpose, or
                non-infringement of intellectual property or other violation of rights.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Limitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                In no event shall SIA or its suppliers be liable for any damages (including, without limitation,
                damages for loss of data or profit, or due to business interruption) arising out of the use or
                inability to use the materials on SIA, even if SIA or an authorized representative has been
                notified orally or in writing of the possibility of such damage.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
