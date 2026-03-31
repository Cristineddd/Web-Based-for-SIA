'use client';

import { Card } from '@/components/ui/card';
import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/gclogo.png"
                  alt="GC Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-[#166534] truncate">GC SMART CHECK</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Exam &amp; Quiz Builder</p>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm text-sm"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-green-50 to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                GC SMART<br />
                <span className="text-green-600">CHECK</span>
              </h1>
              
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <button 
                  onClick={() => document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all border-2 border-gray-300 hover:border-green-600 bg-white text-gray-700 hover:text-green-700"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Right Content - Feature Highlight */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Why GC Smart Check?</h3>
                </div>
                <div className="space-y-5">
                  {benefits.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <div key={index} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 mb-0.5">{benefit.title}</h3>
                          <p className="text-sm text-gray-500">{benefit.description}</p>
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
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for Educators
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <Card className="p-8 bg-gray-50 border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Key Capabilities</h3>
              </div>
              
              <div className="grid gap-3">
                {[
                  'Mobile scanning with instant feedback',
                  'Automatic Student ID validation',
                  'Multi-format export (Excel, CSV, PDF)',
                  'Faculty dashboard with detailed analytics'
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    </div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8 bg-gray-50 border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Advanced Features</h3>
              </div>
              
              <div className="grid gap-3">
                {[
                  'Paper-based exam workflow support',
                  'Secure data storage and encryption',
                  'Unrecognized ID flagging',
                  'Institutional branding support'
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    </div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-green-600">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Streamline Your Grading Process
          </h2>
          <p className="text-lg text-green-100 mb-8">
            Focus on teaching. Let GC Smart Check handle the rest.
          </p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all bg-white hover:bg-gray-100 text-green-700 shadow-lg"
          >
            Get Started for Free
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-green-200" style={{ boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.25)' }}>
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-5 h-5 text-gray-500" />
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