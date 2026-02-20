'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton';
import { 
  BookOpen,
  Users, 
  Smartphone,
  BarChart3,
  CheckCircle,
  Upload,
  QrCode,
  Download,
  Shield,
  Zap,
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

  const subsystems = [
    {
      icon: BookOpen,
      title: 'Exam & Template Management',
      description: 'Easily create exams, define answer keys, and generate standardized, printable answer sheets with Student ID bubbles. Track the number of generated exam papers for better exam control and accountability.',
      features: ['Create exams quickly', 'Define answer keys', 'Generate printable sheets', 'Track exam papers']
    },
    {
      icon: Users,
      title: 'Student & Identification Management',
      description: 'Maintain accurate student records by importing data through Excel or CSV files. Each student is identified using a unique Student ID, ensuring reliable identity matching during the scanning process.',
      features: ['Import Excel/CSV', 'Manage student records', 'Unique Student IDs', 'ID validation']
    },
    {
      icon: Smartphone,
      title: 'Scanning & Auto-Grading',
      description: 'Using a mobile application, instructors can scan completed answer sheets. The system reads both Student ID bubbles and answers, compares responses with the official answer key, and instantly computes scores.',
      features: ['Mobile scanning', 'ID bubble reading', 'Answer comparison', 'Instant scoring']
    },
    {
      icon: BarChart3,
      title: 'Results, Reporting & Export',
      description: 'All grades are securely stored in the database and displayed through a faculty dashboard. Export official grade reports in Excel, CSV, or PDF formats, complete with institutional branding.',
      features: ['Secure storage', 'Faculty dashboard', 'Multi-format export', 'Custom branding']
    }
  ];

  const benefits = [
    {
      icon: Zap,
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex justify-between items-center h-12 sm:h-14">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: '#166534' }}>SIA</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Smart Exam Checking</p>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="gap-1 h-8 sm:h-9 text-xs sm:text-sm flex-shrink-0 ml-2 px-3 py-2 rounded-md font-semibold transition-colors"
              style={{ backgroundColor: '#166534', color: '#FEF9E7' }}
            >
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-10 sm:py-16 px-3 sm:px-4" style={{ background: 'linear-gradient(to bottom right, rgba(22, 101, 52, 0.1), rgba(179, 139, 0, 0.05), rgba(22, 101, 52, 0.1))' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight tracking-tight" 
              style={{ background: 'linear-gradient(to right, #166534, #B38B00, #166534)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Smart Exam Checking<br />& Auto-Grading System
          </h1>
          
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-3xl mx-auto mb-2 leading-relaxed">
            A streamlined, paper-based exam checking solution designed to help instructors efficiently prepare exams, validate student identities, and automatically compute accurate results using mobile scanning and web-based management tools.
          </p>

          <p className="text-xs sm:text-sm text-muted-foreground/70 max-w-3xl mx-auto mb-6 sm:mb-8 font-medium">
            Built for Accuracy, Speed, and Academic Reliability
          </p>

          <button 
            onClick={() => router.push('/auth')}
            className="px-4 sm:px-6 py-2 sm:py-3 rounded-md font-semibold transition-colors inline-flex items-center gap-2"
            style={{ backgroundColor: '#166534', color: '#FEF9E7' }}
          >
            <span className="hidden sm:inline">Start Now</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Four Subsystems Section */}
      <section className="py-10 sm:py-16 px-3 sm:px-4" style={{ backgroundColor: '#FEF9E7' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3" style={{ color: '#166534' }}>
              One System. Four Integrated Subsystems.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Everything you need for complete exam management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {subsystems.map((subsystem, index) => {
              const Icon = subsystem.icon;
              return (
                <Card 
                  key={index}
                  className="p-4 sm:p-6 hover:shadow-lg transition-all bg-card"
                  style={{ borderColor: '#F0E6D2', boxShadow: '0 4px 6px -1px rgba(22, 101, 52, 0.1), 0 2px 4px -1px rgba(22, 101, 52, 0.06)' }}
                >
                  <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ backgroundColor: 'rgba(22, 101, 52, 0.1)' }}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#166534' }} />
                    </div>
                    <h3 className="font-bold text-sm sm:text-base pt-1" style={{ color: '#166534' }}>{subsystem.title}</h3>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
                    {subsystem.description}
                  </p>

                  <ul className="space-y-1.5 sm:space-y-2">
                    {subsystem.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#166534' }} />
                        <span className="text-xs sm:text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-10 sm:py-16 px-3 sm:px-4" style={{ backgroundColor: '#FEF9E7' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3" style={{ color: '#166534' }}>
              Why Choose SIA?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Minimize manual work. Maximize accuracy. Save precious time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card 
                  key={index}
                  className="p-4 sm:p-6 text-center bg-card hover:bg-accent/5 transition-all"
                  style={{ borderColor: '#F0E6D2', boxShadow: '0 4px 6px -1px rgba(22, 101, 52, 0.1), 0 2px 4px -1px rgba(22, 101, 52, 0.06)' }}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4"
                       style={{ backgroundColor: 'rgba(22, 101, 52, 0.1)' }}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#B38B00' }} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2" style={{ color: '#166534' }}>{benefit.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Key Features List */}
          <Card className="p-4 sm:p-6 bg-card" style={{ borderColor: '#F0E6D2', boxShadow: '0 4px 6px -1px rgba(22, 101, 52, 0.1), 0 2px 4px -1px rgba(22, 101, 52, 0.06)' }}>
            <h3 className="font-bold text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2" style={{ color: '#166534' }}>
              <Shield className="w-5 h-5" style={{ color: '#B38B00' }} />
              Key Capabilities
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#166534' }} />
                  <span className="text-xs sm:text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 sm:py-12 px-3 sm:px-4" style={{ backgroundColor: '#166534' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 sm:gap-6">
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 leading-tight" style={{ color: '#FEF9E7' }}>
                Streamline Your Grading Process
              </h2>
              <p className="text-xs sm:text-sm" style={{ color: 'rgba(254, 249, 231, 0.9)' }}>
                Focus on teaching. Let SIA handle the grading.
              </p>
            </div>
            <button 
              onClick={() => router.push('/auth')}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded-md font-semibold transition-colors flex-shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: '#B38B00', color: '#FEF9E7' }}
            >
              <span className="hidden sm:inline">Get Started Free</span>
              <span className="sm:hidden">Get Started</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}