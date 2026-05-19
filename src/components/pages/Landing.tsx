'use client';

import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X, ArrowRight } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import Image from 'next/image';
import { AuthPage } from '@/components/auth/AuthPage';
import {
  GC_INSTITUTION_NAME,
  GC_SYSTEM_NAME,
} from '@/lib/gcBranding';

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (showAuthModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAuthModal]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <a
              href="/"
              className="flex items-center gap-2.5"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <Image
                src="/gclogo.png"
                alt={`${GC_INSTITUTION_NAME} logo`}
                width={32}
                height={32}
                className="object-contain"
              />
              <span className="text-[15px] font-semibold text-gray-900 tracking-tight">
                {GC_SYSTEM_NAME}
              </span>
            </a>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="hidden sm:inline-flex px-3.5 py-2 text-[13px] font-medium text-gray-500 rounded-lg hover:text-gray-900 transition-colors"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="px-3.5 py-2 text-[13px] font-medium text-gray-500 rounded-lg hover:text-gray-900 transition-colors"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="ml-1 px-4 py-2 text-[13px] font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 sm:pt-28 lg:pt-36 pb-20 sm:pb-28 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[13px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-6">
            Built for {GC_INSTITUTION_NAME}
          </p>

          <h1 className="text-[2.75rem] sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
            Exam grading,
            <br />
            <span className="text-green-600">simplified.</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl mx-auto mb-10">
            Create answer keys, scan OMR sheets with your phone,
            and export scored results — all in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-green-600 text-white rounded-lg font-semibold text-[15px] hover:bg-green-700 transition-all shadow-sm"
            >
              Get started free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="px-5 py-3.5 text-[15px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="border-t border-gray-100" />
      </div>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-[13px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3 text-center">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center tracking-tight mb-16">
            Three steps to scored results
          </h2>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              {
                step: '01',
                title: 'Set your answer key',
                desc: 'Enter correct answers per item or import from a spreadsheet.',
              },
              {
                step: '02',
                title: 'Scan with your phone',
                desc: 'Point your camera at student answer sheets. OMR reads the marks instantly.',
              },
              {
                step: '03',
                title: 'Export results',
                desc: 'Review scores, flag issues, and export to Excel, CSV, or PDF.',
              },
            ].map((item) => (
              <div key={item.step}>
                <p className="text-[13px] font-mono font-semibold text-green-600 mb-3">{item.step}</p>
                <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="border-t border-gray-100" />
      </div>

      {/* Features */}
      <section id="benefits" className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-[13px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-3 text-center">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center tracking-tight mb-4">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="text-gray-500 text-center max-w-lg mx-auto mb-16">
            Designed for instructors who grade paper-based exams and want accuracy without complexity.
          </p>

          <div className="grid sm:grid-cols-2 gap-x-16 gap-y-10">
            {[
              {
                title: 'Answer key management',
                desc: 'Configure keys per exam, import from Excel, or use templates. Supports up to 200 items with A–E choices.',
              },
              {
                title: 'Mobile OMR scanning',
                desc: 'Scan answer sheets using your phone camera. The system reads bubble marks and matches them to your key.',
              },
              {
                title: 'Automatic scoring',
                desc: 'Scores are computed instantly after scanning. No manual tallying, no transcription errors.',
              },
              {
                title: 'Student ID validation',
                desc: 'Unrecognized IDs are flagged immediately so no result goes to the wrong student.',
              },
              {
                title: 'Multi-format export',
                desc: 'Download results as Excel, CSV, or PDF. Ready for submission to registrar or department.',
              },
              {
                title: 'Class management',
                desc: 'Organize students by section, manage rosters, and track exam performance per class.',
              },
            ].map((feature) => (
              <div key={feature.title} className="group">
                <h3 className="text-[15px] font-bold text-gray-900 mb-1.5 group-hover:text-green-700 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-green-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Ready to simplify your grading?
          </h2>
          <p className="text-gray-500 mb-10 text-lg">
            Start checking exams in minutes. Free for {GC_INSTITUTION_NAME} faculty.
          </p>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg font-semibold text-[15px] hover:bg-green-700 transition-all shadow-sm"
          >
            Create your account
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="p-6 sm:p-8">
              <AuthPage key={authMode} initialMode={authMode} />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
