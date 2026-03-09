'use client';

import { Card } from '@/components/ui/card';
import { CheckCircle2, Users, Zap, Shield, BarChart3, FileText } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'OMR Scanning',
    description: 'Automated optical mark recognition for quick and accurate exam checking',
  },
  {
    icon: Zap,
    title: 'Fast Grading',
    description: 'Process hundreds of answer sheets in minutes with our efficient grading system',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Comprehensive performance analytics and detailed student insights',
  },
  {
    icon: Shield,
    title: 'Secure',
    description: 'Enterprise-grade security to protect your data and student information',
  },
  {
    icon: Users,
    title: 'Class Management',
    description: 'Easy management of multiple classes and student rosters',
  },
  {
    icon: CheckCircle2,
    title: 'Reliable',
    description: '99.9% accuracy in automated grading and result generation',
  },
];

const team = [
  {
    name: 'Development Team',
    role: 'Full Stack Development',
    description: 'Building robust and scalable exam management solutions',
  },
  {
    name: 'QA Team',
    role: 'Quality Assurance',
    description: 'Ensuring the highest standards of accuracy and reliability',
  },
  {
    name: 'Design Team',
    role: 'UX/UI Design',
    description: 'Creating intuitive and user-friendly interfaces',
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-12 sm:py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 sm:mb-6">
            About GC SMART CHECK
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8">
            Smart Exam Checking & Auto-Grading System
          </p>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SIA is a comprehensive web-based solution designed to revolutionize the way educators 
            manage, grade, and analyze exams. Built with modern technology and user experience in mind, 
            we help educational institutions save time and improve accuracy in assessment processes.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
                Our Mission
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                To empower educators with cutting-edge technology that simplifies exam management, 
                reduces manual workload, and provides actionable insights into student performance.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                We believe that technology should enhance, not complicate, the educational experience. 
                That's why we've built SIA to be intuitive, reliable, and accessible to institutions 
                of all sizes.
              </p>
            </div>
            <Card className="p-6 sm:p-8 bg-primary/5 border-primary/20">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Key Benefits</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted-foreground">Save up to 90% of grading time</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted-foreground">99.9% grading accuracy</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted-foreground">Real-time performance analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted-foreground">Secure cloud-based storage</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Features That Make a Difference
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed to streamline your exam management workflow
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Our Team
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Dedicated professionals working together to deliver excellence
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {team.map((member) => (
              <Card key={member.name} className="p-6 sm:p-8 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 sm:mb-2">
                  {member.name}
                </h3>
                <p className="text-xs sm:text-sm text-primary font-medium mb-2 sm:mb-3">
                  {member.role}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {member.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
            Built with Modern Technology
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
            SIA is built using the latest web technologies including Next.js, React, TypeScript, 
            and Firebase, ensuring a fast, reliable, and scalable platform that grows with your needs.
          </p>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {['Next.js', 'React', 'TypeScript', 'Firebase', 'Tailwind CSS', 'Vercel'].map((tech) => (
              <span
                key={tech}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 text-primary rounded-full text-xs sm:text-sm font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6">
            Get in Touch
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
            Have questions or want to learn more about SIA? We'd love to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/contact"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Contact Us
            </a>
            <a
              href="/dashboard"
              className="px-6 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary/5 transition-colors"
            >
              Try SIA Now
            </a>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-8 sm:py-12 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-2">
            <strong className="text-foreground">Location:</strong> Olongapo City, Philippines
          </p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Email:</strong> support@sia-system.com
          </p>
        </div>
      </section>
    </div>
  );
}
