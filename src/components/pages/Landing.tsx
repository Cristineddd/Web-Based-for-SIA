'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, X } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import Image from 'next/image';
import { 
  CheckCircle,
  Shield,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { AuthPage } from '@/components/auth/AuthPage';

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showAuthModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAuthModal]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  const benefits = [
    {
      icon: Sparkles,
      title: 'Speed',
      description: 'Accelerate the grading process from hours to minutes'
    },
    {
      icon: Shield,
      title: 'Accuracy',
      description: 'Minimize manual checking and reduce human error'
    },
    {
      icon: CheckCircle,
      title: 'Reliability',
      description: 'Unrecognized IDs are automatically flagged to prevent invalid grading'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Image src="/Sia.png" alt="SIA Logo" width={40} height={40} className="w-10 h-10 object-contain aspect-square flex-shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-[#166534]">SIA</h1>
                <p className="text-xs text-gray-600">Smart Exam Checking</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-2.5 rounded-lg font-semibold transition-all bg-[#166534] hover:bg-[#1a7a3e] text-white"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Smart Exam Checking & Auto-Grading System
              </h1>
              
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="px-8 py-4 rounded-lg font-semibold transition-all bg-[#166534] hover:bg-[#1a7a3e] text-white shadow-lg hover:shadow-xl"
                >
                  Start Now - It's Free
                </button>
                
                <button 
                  onClick={() => document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-8 py-4 rounded-lg font-semibold transition-all border-2 border-gray-300 hover:border-[#166534] text-gray-700 hover:text-[#166534]"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Right Content - Feature Highlight */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-6">
                  {benefits.map((benefit, index) => {
                    return (
                      <div key={index} className="flex items-start gap-4">
                        <div className="w-2 h-2 rounded-full bg-[#166534] flex-shrink-0 mt-2"></div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 mb-1">{benefit.title}</h3>
                          <p className="text-gray-600">{benefit.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Why Choose SIA?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="p-8 bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Key Capabilities</h3>
              </div>
              
              <div className="grid gap-3">
                {[
                  'Mobile scanning with instant feedback',
                  'Automatic Student ID validation',
                  'Multi-format export (Excel, CSV, PDF)',
                  'Faculty dashboard with detailed analytics'
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#166534] flex-shrink-0 mt-2"></div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8 bg-white border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Advanced Features</h3>
              </div>
              
              <div className="grid gap-3">
                {[
                  'Paper-based exam workflow support',
                  'Secure data storage and encryption',
                  'Unrecognized ID flagging',
                  'Institutional branding support'
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#166534] flex-shrink-0 mt-2"></div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#166534]">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Streamline Your Grading Process
          </h2>
          <p className="text-lg text-green-100 mb-8">
            Focus on teaching. Let SIA handle the grading.
          </p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="px-8 py-4 rounded-lg font-semibold transition-all bg-white hover:bg-gray-100 text-[#166534] shadow-lg"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <div className="p-6 sm:p-8">
              <AuthPage />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}