"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function SupportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams.get("tab") || "contact";

  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["contact", "privacy", "terms"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Use replace to avoid filling up browser history with tab clicks
    router.replace(`/support?tab=${value}`, { scroll: false });
  };

  // Contact Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(
        "Thank you for your message! We will get back to you soon.",
      );
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen  bg-white p-4 md:p-8 ">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-green-600 hover:bg-gray-100 text-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-1 sm:grid-cols-3 text-green-600 h-auto gap-1 sm:gap-0 sm:h-10">
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
            <TabsTrigger value="terms">Terms of Service</TabsTrigger>
            <TabsTrigger value="contact">Contact Us</TabsTrigger>
          </TabsList>

          <TabsContent value="privacy" className="mt-6 space-y-6">
            <div>
              <h1 className="text-3xl  font-bold text-green-600">
                Privacy Policy
              </h1>
              <p className="text-muted-foreground mt-2">
                Last updated: {new Date().getFullYear()}
              </p>
            </div>

            <div className="prose prose-sm max-w-none space-y-4 ">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    1. Introduction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    GC Scan (Smart Exam Checking System) is committed to
                    protecting your privacy. This Privacy Policy explains how we
                    collect, use, disclose, and safeguard your information when
                    you visit our website and use our services.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    2. Information We Collect
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    We collect information you provide directly, such as when
                    you create an account, including name, email address, and
                    educational institution information.
                  </p>
                  <p>
                    We automatically collect certain information about your
                    device and how you interact with our services, including IP
                    address, browser type, and pages visited.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    3. How We Use Your Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    We use the information we collect to provide, maintain, and
                    improve our services, process transactions, and send
                    transactional and promotional communications.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    4. Contact Us
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    If you have questions about this Privacy Policy, please
                    contact us at support@sia-system.com
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="terms" className="mt-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-green-600">
                Terms of Service
              </h1>
              <p className="text-muted-foreground mt-2">
                Last updated: {new Date().getFullYear()}
              </p>
            </div>

            <div className="prose prose-sm max-w-none space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    1. Agreement to Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    By accessing and using SIA, you accept and agree to be bound
                    by the terms and provision of this agreement. If you do not
                    agree to abide by the above, please do not use this service.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    2. Use License
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    Permission is granted to temporarily download one copy of
                    the materials (information or software) on SIA for personal,
                    non-commercial transitory viewing only. This is the grant of
                    a license, not a transfer of title, and under this license
                    you may not:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Modifying or copying the materials</li>
                    <li>Using the materials for any commercial purpose</li>
                    <li>
                      Attempting to decompile or reverse engineer any software
                    </li>
                    <li>
                      Removing any copyright or other proprietary notations
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    3. Disclaimer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    The materials on SIA are provided on an 'as is' basis. SIA
                    makes no warranties, expressed or implied, and hereby
                    disclaims and negates all other warranties including,
                    without limitation, implied warranties or conditions of
                    merchantability, fitness for a particular purpose, or
                    non-infringement of intellectual property or other violation
                    of rights.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-black">
                    4. Limitations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-md text-gray-600">
                  <p>
                    In no event shall SIA or its suppliers be liable for any
                    damages (including, without limitation, damages for loss of
                    data or profit, or due to business interruption) arising out
                    of the use or inability to use the materials on SIA, even if
                    SIA or an authorized representative has been notified orally
                    or in writing of the possibility of such damage.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="mt-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-green-600">Contact Us</h1>
              <p className="text-muted-foreground mt-2 text-md">
                Have questions? We'd love to hear from you. Send us a message
                and we'll respond as soon as possible.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                    <Mail className="w-5 h-5 " />
                    Email
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href="mailto:support@sia-system.com"
                    className="text-gray-600 hover:underline"
                  >
                    support@sia-system.com
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Live Chat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Available Monday-Friday 9AM-5PM
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-600">
                    Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    We typically respond within 24 hours
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-md text-green-600 font-medium mb-2">
                        Name
                      </label>
                      <Input
                        type="text"
                        placeholder="Your name"
                        className="bg-white text-md"
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-md text-green-600 font-medium mb-2">
                        Email
                      </label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        className="bg-white text-md"
                        value={formData.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-green-600 font-medium mb-2">
                      Subject
                    </label>
                    <Input
                      type="text"
                      placeholder="What is this about?"
                      className="bg-white text-md"
                      value={formData.subject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-green-600 font-medium mb-2">
                      Message
                    </label>
                    <textarea
                      placeholder="Tell us more..."
                      value={formData.message}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      required
                      rows={6}
                      className="w-full px-3 py-2 border border-input bg-white text-md text-black rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={sending}
                    size="lg"
                    className="bg-green-600 text-md sm:text-sm h-12"
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <SupportContent />
    </Suspense>
  );
}
