'use client';

import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X, ArrowRight, Upload, ScanLine, FileSpreadsheet, Check, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { AuthPage } from '@/components/auth/AuthPage';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { ParticleBackground } from '@/components/ParticleBackground';
import {
  GC_INSTITUTION_NAME,
  GC_SYSTEM_NAME,
} from '@/lib/gcBranding';

export default function Landing() {
  const router = useRouter();
  const { user } = useAuth();
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
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);


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


  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50/30 to-white relative">
      <ParticleBackground />
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
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
                className="object-contain w-7 h-7 sm:w-8 sm:h-8"
              />
              <span className="text-sm sm:text-base font-bold text-gray-900 tracking-tight whitespace-nowrap">
                {GC_SYSTEM_NAME}
              </span>
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="ml-1 sm:ml-2 px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm whitespace-nowrap"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-transparent to-transparent z-10">
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(34 197 94) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />

        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left column */}
            <div>
              <div className="inline-block px-3 py-1.5 bg-green-50 border border-green-200 rounded-full mb-6">
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Built for {GC_INSTITUTION_NAME}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-[1.1] sm:leading-[1.05] tracking-tight mb-6">
                Grade 200 papers.
                <br />
                <span className="text-green-600">In 10 minutes.</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-8 sm:mb-10 max-w-xl">
                Mobile OMR scanning and instant scoring — built for Gordon College faculty. Sign up with your <span className="font-semibold text-green-700">@gordon.edu.ph</span> email.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-base transition-all shadow-lg shadow-green-600/25"
                >
                  Start grading now
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-lg font-semibold text-base transition-colors"
                >
                  See how it works
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Trust bar */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-green-600" />
                  <span>Mobile scanning</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Auto-scoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span>Export to Excel</span>
                </div>
              </div>
            </div>

            {/* Right column - UI Mockup */}
            <div className="relative lg:block hidden">
              <div className="relative">
                {/* Floating card mockup */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                  {/* Header with avatar and status */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">
                        GC
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">Student</div>
                        <div className="text-sm text-gray-500">2026*****</div>
                      </div>
                    </div>
                    <div className="px-4 py-1.5 bg-green-50 rounded-lg">
                      <span className="text-sm font-semibold text-green-600">Passed</span>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Score</div>
                      <div className="text-3xl font-bold text-gray-900">42/50</div>
                    </div>
                    <div className="bg-green-50 rounded-2xl p-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Percentage</div>
                      <div className="text-3xl font-bold text-green-600">84%</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Rank</div>
                      <div className="text-3xl font-bold text-gray-900">3/45</div>
                    </div>
                  </div>

                  {/* Item analysis */}
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Item Analysis</div>
                    <div className="space-y-3">
                      {[
                        { label: 'Correct answers', value: 42, color: 'bg-green-500' },
                        { label: 'Wrong answers', value: 8, color: 'bg-red-500' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                            <span className="text-base text-gray-600">{item.label}</span>
                          </div>
                          <span className="text-xl font-bold text-gray-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-green-100 rounded-full blur-3xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-green-50 rounded-full blur-3xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-transparent relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block px-3 py-1.5 bg-green-50 border border-green-200 rounded-full mb-4">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">How it works</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Three simple steps
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              From paper exams to digital results in minutes
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                step: '01',
                icon: Upload,
                title: 'Create answer key',
                desc: 'Enter correct answers manually or import from Excel. Supports up to 200 items with A-E choices.',
              },
              {
                step: '02',
                icon: ScanLine,
                title: 'Scan answer sheets',
                desc: 'Use your phone camera to scan OMR sheets. Advanced optical recognition reads bubble marks instantly.',
              },
              {
                step: '03',
                icon: FileSpreadsheet,
                title: 'Export & analyze',
                desc: 'Review scores with item analysis. Export results to Excel, CSV, or PDF with Gordon College branding.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-green-500 hover:shadow-lg transition-all group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center group-hover:bg-green-600 transition-colors">
                      <Icon className="w-6 h-6 text-green-600 group-hover:text-white" />
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-400">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white/40 backdrop-blur-sm relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block px-3 py-1.5 bg-green-50 border border-green-200 rounded-full mb-4">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Features</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Everything you need
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Built specifically for paper-based exam grading at Gordon College
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                title: 'Answer key management',
                desc: 'Create exam keys with correct answers. Import from Excel or enter manually. Supports up to 200 items with A-E choices.',
              },
              {
                title: 'Mobile OMR scanning',
                desc: 'No expensive scanners required. Use your phone camera to scan answer sheets with professional optical mark recognition.',
              },
              {
                title: 'Automatic scoring',
                desc: 'Scores computed instantly after scanning. Zero manual tallying, zero transcription errors.',
              },
              {
                title: 'Student ID validation',
                desc: 'Unrecognized student IDs are flagged immediately to prevent results from going to the wrong student.',
              },
              {
                title: 'Multi-format export',
                desc: 'Download results as Excel, CSV, or PDF with Gordon College branding. Ready for registrar submission.',
              },
              {
                title: 'Class management',
                desc: 'Organize students by section, manage rosters, and track exam performance across multiple classes.',
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-green-500 transition-all">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-green-50/50 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-3 py-1.5 bg-green-50 border border-green-200 rounded-full mb-6">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Free for Gordon College Faculty
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-6">
            Start grading smarter today
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Join Gordon College instructors who are saving hours on exam grading. Set up your first exam in under 5 minutes.
          </p>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 sm:px-10 sm:py-5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-base sm:text-lg transition-all shadow-xl shadow-green-600/25 w-full sm:w-auto"
          >
            Create free account
            <ArrowRight className="w-5 h-5" />
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

      <div className="relative z-10">
        <Footer />
      </div>
      <PWAInstallPrompt />
    </div>
  );
}
