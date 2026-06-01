"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const linkClass = "hover:underline transition-all cursor-pointer";

function PrivacyContent() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">1. Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            GC Scan (Smart Exam Checking System) is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you visit our website and use our
            services.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">
            2. Information We Collect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            We collect information you provide directly, such as when you create
            an account, including name, email address, and educational
            institution information.
          </p>
          <p>
            We automatically collect certain information about your device and
            how you interact with our services, including IP address, browser
            type, and pages visited.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">
            3. How We Use Your Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            We use the information we collect to provide, maintain, and improve
            our services, process transactions, and send transactional and
            promotional communications.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">4. Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            If you have questions about this Privacy Policy, please contact us at
            gc.smartcheck@gmail.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">
            1. Agreement to Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            By accessing and using SIA, you accept and agree to be bound by the
            terms and provision of this agreement. If you do not agree to abide
            by the above, please do not use this service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">2. Use License</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            Permission is granted to temporarily download one copy of the
            materials (information or software) on SIA for personal,
            non-commercial transitory viewing only. This is the grant of a
            license, not a transfer of title, and under this license you may
            not:
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
          <CardTitle className="text-lg text-black">3. Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            The materials on SIA are provided on an 'as is' basis. SIA makes no
            warranties, expressed or implied, and hereby disclaims and negates
            all other warranties including, without limitation, implied
            warranties or conditions of merchantability, fitness for a particular
            purpose, or non-infringement of intellectual property or other
            violation of rights.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black">4. Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            In no event shall SIA or its suppliers be liable for any damages
            (including, without limitation, damages for loss of data or profit,
            or due to business interruption) arising out of the use or inability
            to use the materials on SIA, even if SIA or an authorized
            representative has been notified orally or in writing of the
            possibility of such damage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface LegalLinksProps {
  /** Separator rendered between the two links. Defaults to " - ". */
  separator?: string;
  className?: string;
}

export function LegalLinks({ separator = " - ", className }: LegalLinksProps) {
  return (
    <div className={className}>
      <Dialog>
        <DialogTrigger asChild>
          <span className={linkClass}>Terms of use</span>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-green-600">
              Terms of Service
            </DialogTitle>
          </DialogHeader>
          <TermsContent />
        </DialogContent>
      </Dialog>

      <span>{separator}</span>

      <Dialog>
        <DialogTrigger asChild>
          <span className={linkClass}>Privacy policy</span>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-green-600">
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <PrivacyContent />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LegalLinks;
