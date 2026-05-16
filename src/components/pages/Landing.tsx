'use client';

import { Card } from '@/components/ui/card';
import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  X,
  Zap,
  Target,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  ScanLine,
  Lock,
  Smartphone,
  IdCard,
  FileSpreadsheet,
  BarChart3,
  FileText,
  AlertTriangle,
  Palette,
  ClipboardList,
  Users,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import Image from 'next/image';
import { AuthPage } from '@/components/auth/AuthPage';
import {
  GC_INSTITUTION_NAME,
  GC_PRIMARY_HEX,
  GC_SECONDARY_HEX,
  GC_SYSTEM_NAME,
} from '@/lib/gcBranding';

const ICON_STROKE = 2;

/** WCAG AA: #14532d on white ~7.5:1 for large text; body uses gray-700 */
const BRAND_ACCENT = GC_PRIMARY_HEX;

const benefits: {
  icon: LucideIcon;
  title: string;
  description: string;
  stat: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    icon: Zap,
    title: 'Speed',
    stat: '100 papers in under 5 minutes',
    description: 'Batch-scan answer sheets instead of grading by hand for hours.',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
  },
  {
    icon: Target,
    title: 'Accuracy',
    stat: 'Aligned to your answer key',
    description: 'OMR reads marks against the key you set - fewer transcription mistakes.',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-800',
  },
  {
    icon: ShieldCheck,
    title: 'Reliability',
    stat: 'Invalid IDs flagged instantly',
    description: 'Unrecognized student IDs are caught before scores are recorded.',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-800',
  },
];

const workflowSteps: { icon: LucideIcon; label: string }[] = [
  { icon: ClipboardList, label: 'Set answer key' },
  { icon: ScanLine, label: 'Scan sheets' },
  { icon: BarChart3, label: 'Export results' },
];

const productPillars: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ClipboardList,
    title: 'Answer Keys',
    description: 'Configure and manage exam answer keys with ease',
  },
  {
    icon: ScanLine,
    title: 'OMR Scanning',
    description: 'Scan answer sheets from mobile with instant feedback',
  },
  {
    icon: BarChart3,
    title: 'Results & Analytics',
    description: 'Auto-score papers and view detailed performance data',
  },
  {
    icon: Users,
    title: 'Class Management',
    description: 'Organize rosters and validate student identities',
  },
];

const keyCapabilities: { icon: LucideIcon; text: string }[] = [
  { icon: Smartphone, text: 'Mobile scanning with instant feedback' },
  { icon: IdCard, text: 'Automatic Student ID validation' },
  { icon: FileSpreadsheet, text: 'Multi-format export (Excel, CSV, PDF)' },
  { icon: BarChart3, text: 'Faculty dashboard with detailed analytics' },
];

const advancedFeatures: { icon: LucideIcon; text: string }[] = [
  { icon: FileText, text: 'Paper-based exam workflow support' },
  { icon: Lock, text: 'Secure data storage and encryption' },
  { icon: AlertTriangle, text: 'Unrecognized ID flagging' },
  { icon: Palette, text: 'Institutional branding support' },
];

function IconBox({
  icon: Icon,
  className = '',
  size = 'md',
}: {
  icon: LucideIcon;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-lg',
    md: 'w-11 h-11 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };
  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center shrink-0 ${className}`}
    >
      <Icon className={iconSizes[size]} strokeWidth={ICON_STROKE} />
    </div>
  );
}

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

  const navLinks = [
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Features', id: 'benefits' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-green-100/60 bg-white/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(22,101,52,0.04)]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[4.25rem] gap-4">
            <a
              href="/"
              className="flex items-center gap-3 min-w-0 group"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <Image
                src="/gclogo.png"
                alt={`${GC_INSTITUTION_NAME} logo`}
                width={36}
                height={36}
                className="object-contain shrink-0"
              />
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold truncate leading-tight tracking-tight" style={{ color: BRAND_ACCENT }}>
                  {GC_SYSTEM_NAME}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-600 hidden sm:block truncate">
                  for {GC_INSTITUTION_NAME}
                </p>
              </div>
            </a>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
              {navLinks.map(({ label, id }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:text-[#14532d] hover:bg-green-50 transition-colors"
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="lg:hidden px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-green-50 transition-colors"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="hidden sm:inline-flex px-4 py-2.5 text-sm font-semibold text-gray-700 rounded-xl hover:text-[#14532d] hover:bg-green-50 transition-colors"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="inline-flex px-4 py-2.5 text-sm font-semibold text-gray-700 rounded-xl hover:text-[#14532d] hover:bg-green-50 transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-green-50/80 via-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-gray-900 mb-4 leading-[1.1] tracking-tight">
                {GC_SYSTEM_NAME.split(' ').slice(0, 2).join(' ')}
                <br />
                <span style={{ color: BRAND_ACCENT }}>CHECK</span>
              </h1>

              <p className="text-lg text-gray-700 mb-6 leading-relaxed max-w-xl">
                Paper-based exam grading for {GC_INSTITUTION_NAME} instructors - create
                answer keys, scan OMR sheets on mobile, and export scored results in minutes.
              </p>

              {/* Workflow visual */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6" aria-hidden>
                {workflowSteps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
                        <Icon className="w-4 h-4" style={{ color: GC_SECONDARY_HEX }} strokeWidth={ICON_STROKE} />
                        <span className="text-xs sm:text-sm font-medium text-gray-800">{step.label}</span>
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-400 hidden sm:block shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: '#166534' }}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" strokeWidth={ICON_STROKE} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-sm font-semibold text-gray-700 hover:text-[#14532d] underline-offset-4 hover:underline transition-colors sm:px-2"
                >
                  Learn how it works
                </button>
              </div>

              {/* Trust */}
              <div className="flex items-center gap-3 pt-6 border-t border-gray-200/80">
                <Image
                  src="/gclogo.png"
                  alt={`${GC_INSTITUTION_NAME} logo`}
                  width={32}
                  height={32}
                  className="object-contain shrink-0"
                />
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Built for {GC_INSTITUTION_NAME}</p>
                  <p className="text-xs text-gray-600">
                    Trusted by faculty for answer-key setup, OMR scanning, and grade exports
                  </p>
                </div>
              </div>
            </div>

            {/* Feature card - tighter */}
            <div className="relative lg:pl-2">
              <div className="absolute -inset-4 bg-gradient-to-br from-green-100/40 to-emerald-50/30 rounded-3xl blur-2xl -z-10" />
              <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 border border-gray-200/90">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" style={{ color: BRAND_ACCENT }} strokeWidth={ICON_STROKE} />
                  </div>
                  <h2 className="font-bold text-gray-900 text-base">Why instructors choose us</h2>
                </div>
                <ul className="space-y-3.5">
                  {benefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <li key={benefit.title} className="flex items-start gap-3 group">
                        <div
                          className={`w-10 h-10 rounded-lg ${benefit.iconBg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                        >
                          <Icon className={`w-4 h-4 ${benefit.iconColor}`} strokeWidth={ICON_STROKE} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-0.5">
                            <h3 className="font-bold text-gray-900 text-sm">{benefit.title}</h3>
                            <span className="text-xs font-semibold" style={{ color: GC_SECONDARY_HEX }}>
                              {benefit.stat}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">{benefit.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-y border-gray-100"
        aria-labelledby="how-it-works-heading"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              How it works
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base">
              Three steps from blank answer sheet to scored class roster
            </p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="relative text-center">
                  <span
                    className="inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-bold text-white mb-3"
                    style={{ backgroundColor: BRAND_ACCENT }}
                  >
                    {index + 1}
                  </span>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon className="w-6 h-6" style={{ color: BRAND_ACCENT }} strokeWidth={ICON_STROKE} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{step.label}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed px-2">
                    {index === 0 && 'Upload or enter your exam answer key per item.'}
                    {index === 1 && 'Use your phone camera to scan student answer sheets.'}
                    {index === 2 && 'Review scores and export to Excel, CSV, or PDF.'}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for Educators
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {productPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="group p-5 rounded-xl border border-gray-200 bg-gray-50 hover:border-green-300 hover:shadow-md transition-all text-center"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center transition-transform group-hover:scale-105">
                    <Icon className="w-6 h-6" style={{ color: BRAND_ACCENT }} strokeWidth={ICON_STROKE} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{pillar.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{pillar.description}</p>
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="group p-8 bg-gray-50 border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <IconBox
                  icon={ScanLine}
                  size="lg"
                  className="bg-gradient-to-br from-green-50 to-emerald-100 text-[#1a472a] transition-transform group-hover:scale-105"
                />
                <h3 className="text-xl font-bold text-gray-900">Key Capabilities</h3>
              </div>
              <div className="grid gap-3">
                {keyCapabilities.map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <IconBox icon={icon} size="sm" className="bg-green-50 text-green-800" />
                    <span className="text-gray-700 text-sm">{text}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="group p-8 bg-gray-50 border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <IconBox
                  icon={Lock}
                  size="lg"
                  className="bg-gradient-to-br from-slate-50 to-gray-100 text-slate-700 transition-transform group-hover:scale-105"
                />
                <h3 className="text-xl font-bold text-gray-900">Advanced Features</h3>
              </div>
              <div className="grid gap-3">
                {advancedFeatures.map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <IconBox icon={icon} size="sm" className="bg-slate-50 text-slate-700" />
                    <span className="text-gray-700 text-sm">{text}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section id="cta" className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-700 to-emerald-800" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative w-full max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight tracking-tight">
            Streamline Your Grading Process
          </h2>
          <p className="text-lg sm:text-xl text-green-50 mb-10 max-w-2xl mx-auto leading-relaxed">
            Focus on teaching. Let {GC_SYSTEM_NAME} handle answer keys, scanning, and scoring.
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-10">
            {[
              { icon: ClipboardList, label: 'Answer keys' },
              { icon: ScanLine, label: 'OMR scan' },
              { icon: BarChart3, label: 'Auto scoring' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium"
              >
                <Icon className="w-4 h-4 text-green-200" strokeWidth={ICON_STROKE} />
                {label}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="inline-flex items-center gap-2.5 px-10 py-4 rounded-xl font-semibold text-base transition-all bg-white shadow-xl hover:bg-green-50 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            style={{ color: BRAND_ACCENT }}
          >
            Get Started for Free
          </button>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-green-100">
            {['Paper-based workflow', 'Instant results'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-300" strokeWidth={ICON_STROKE} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-sm">
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-green-200"
            style={{ boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.25)' }}
          >
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" strokeWidth={ICON_STROKE} />
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
