'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Footer } from '@/components/layout/Footer';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import { 
  CheckCircle,
  Shield,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

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
    <div className="min-h-screen bg-[#FEF9E7]">
      {/* Navigation */}
      <nav className="border-b bg-[#FEF9E7]/80 backdrop-blur-sm sticky top-0 z-50" style={{ borderColor: '#F0E6D2' }}>
        <div className="w-full max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-12 xs:h-13 sm:h-14 md:h-16">
            <div className="min-w-0 flex-1">
              <h1 className="text-sm xs:text-base sm:text-lg font-bold truncate" style={{ color: '#166534' }}>SIA</h1>
              <p className="text-xs text-muted-foreground -mt-0.5 truncate">Smart Exam Checking</p>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="gap-1 h-8 xs:h-9 sm:h-10 text-xs sm:text-sm flex-shrink-0 ml-2 px-3 xs:px-4 sm:px-5 py-1.5 sm:py-2 rounded-md font-semibold transition-colors hover:shadow-md"
              style={{ backgroundColor: '#166534', color: '#FEF9E7' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f4a2e'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#166534'}
            >
              <span className="hidden xs:inline">Get Started</span>
              <span className="xs:hidden">Start</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-8 xs:py-12 sm:py-16 md:py-20 px-2 xs:px-3 sm:px-4 lg:px-6" style={{ background: 'linear-gradient(to bottom right, rgba(22, 101, 52, 0.1), rgba(179, 139, 0, 0.05), rgba(22, 101, 52, 0.1))' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-3 xs:mb-4 sm:mb-6 leading-tight tracking-tight" 
              style={{ background: 'linear-gradient(to right, #166534, #B38B00, #166534)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Smart Exam Checking<br />& Auto-Grading System
          </h1>
          
          <p className="text-xs xs:text-sm sm:text-base md:text-lg text-muted-foreground max-w-3xl mx-auto mb-2 leading-relaxed px-1">
            A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results using mobile scanning and web-based management tools.
          </p>

          <p className="text-xs text-muted-foreground/70 max-w-3xl mx-auto mb-6 sm:mb-8 font-medium px-1">
            Built for Accuracy, Speed, and Academic Reliability
          </p>

          <button 
            onClick={() => router.push('/auth')}
            className="px-3 xs:px-4 sm:px-6 py-2 sm:py-3 rounded-md font-semibold transition-colors inline-flex items-center gap-2 text-xs xs:text-sm sm:text-base hover:shadow-lg"
            style={{ backgroundColor: '#166534', color: '#FEF9E7' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f4a2e'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#166534'}
          >
            <span className="hidden xs:inline">Start Now</span>
            <span className="xs:hidden">Start</span>
            <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
          </button>
        </div>
      </section>



      {/* Benefits Section */}
      <section className="py-8 xs:py-12 sm:py-16 md:py-20 px-2 xs:px-3 sm:px-4 lg:px-6" style={{ backgroundColor: '#FEF9E7' }}>
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-6 xs:mb-8 sm:mb-12">
            <h2 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3" style={{ color: '#166534' }}>
              Why Choose SIA?
            </h2>
            <p className="text-xs xs:text-sm sm:text-base text-muted-foreground px-1">
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 xs:gap-4 sm:gap-6 mb-6 xs:mb-8 sm:mb-12">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card 
                  key={index}
                  className="p-3 xs:p-4 sm:p-6 text-center bg-card hover:shadow-lg hover:scale-105 transition-all duration-200"
                  style={{ borderColor: '#F0E6D2', boxShadow: '0 4px 6px -1px rgba(22, 101, 52, 0.1), 0 2px 4px -1px rgba(22, 101, 52, 0.06)' }}
                >
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mx-auto mb-2 xs:mb-3 sm:mb-4"
                       style={{ backgroundColor: 'rgba(22, 101, 52, 0.1)' }}>
                    <Icon className="w-5 h-5 xs:w-6 xs:h-6 sm:w-7 sm:h-7" style={{ color: '#B38B00' }} />
                  </div>
                  <h3 className="font-bold text-xs xs:text-sm sm:text-base mb-1 xs:mb-1.5 sm:mb-2" style={{ color: '#166534' }}>{benefit.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">
                    {benefit.description}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Key Features List */}
          <Card className="p-3 xs:p-4 sm:p-6 bg-card" style={{ borderColor: '#F0E6D2', boxShadow: '0 4px 6px -1px rgba(22, 101, 52, 0.1), 0 2px 4px -1px rgba(22, 101, 52, 0.06)' }}>
            <h3 className="font-bold text-sm xs:text-base sm:text-lg mb-3 xs:mb-4 sm:mb-5 flex items-center gap-2" style={{ color: '#166534' }}>
              <Shield className="w-4 h-4 xs:w-5 xs:h-5" style={{ color: '#B38B00' }} />
              Key Capabilities
            </h3>
            
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 xs:gap-2.5 sm:gap-3">
              {[
                'Mobile scanning with instant feedback',
                'Automatic Student ID validation',
                'Multi-format export (Excel, CSV, PDF)',
                'Faculty dashboard with detailed analytics',
                'Paper-based exam workflow support',
                'Secure data storage and encryption',
                'Unrecognized ID flagging',
                'Institutional branding support'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 xs:w-4 xs:h-4 flex-shrink-0 mt-0.5" style={{ color: '#166534' }} />
                  <span className="text-xs xs:text-xs sm:text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 xs:py-10 sm:py-12 px-2 xs:px-3 sm:px-4 lg:px-6" style={{ backgroundColor: '#166534' }}>
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 xs:gap-4 sm:gap-6">
            <div className="text-center sm:text-left px-1">
              <h2 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 leading-tight" style={{ color: '#FEF9E7' }}>
                Streamline Your Grading Process
              </h2>
              <p className="text-xs xs:text-xs sm:text-sm" style={{ color: 'rgba(254, 249, 231, 0.9)' }}>
                Focus on teaching. Let SIA handle the grading.
              </p>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="px-3 xs:px-4 sm:px-6 py-2 sm:py-3 rounded-md font-semibold transition-all flex-shrink-0 w-full xs:w-auto sm:w-auto inline-flex items-center justify-center gap-2 text-xs xs:text-sm sm:text-base hover:shadow-lg hover:scale-105"
              style={{ backgroundColor: '#B38B00', color: '#FEF9E7' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8f6f00'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#B38B00'}
            >
              <span className="hidden xs:inline">Get Started Free</span>
              <span className="xs:hidden">Get Started</span>
              <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}