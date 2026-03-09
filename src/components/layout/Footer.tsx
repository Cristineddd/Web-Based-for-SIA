/**
 * Footer Component
 * Displays footer with links, contact info, legal notices, and branding
 * Appears on all pages below main content
 */

'use client';

import Link from 'next/link';
import { Github, Linkedin, Twitter } from 'lucide-react';

const socialLinks = [
  {
    name: 'GitHub',
    icon: Github,
    href: 'https://github.com/Cristineddd/Web-Based-for-SIA',
    label: 'Visit our GitHub repository',
  },
  {
    name: 'LinkedIn',
    icon: Linkedin,
    href: 'https://linkedin.com',
    label: 'Connect with us on LinkedIn',
  },
  {
    name: 'Twitter',
    icon: Twitter,
    href: 'https://twitter.com',
    label: 'Follow us on Twitter',
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-sidebar border-t border-sidebar-border mt-12">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Brand Section */}
        <div className="grid grid-cols-1 gap-8 mb-12">
          {/* Brand Info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-sidebar-foreground">GC SMART CHECK</h3>
              <p className="text-sm text-sidebar-foreground/60 mt-1">
                Smart Exam Checking & Auto-Grading System
              </p>
            </div>
            <p className="text-sm text-sidebar-foreground/70 max-w-sm">
              A streamlined, paper-based exam checking solution designed for efficient exam management, 
              automatic grading, and comprehensive student performance analysis.
            </p>

            {/* Social Links */}
            <div className="flex gap-4 pt-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.label}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 transition-colors"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="my-8 border-t border-sidebar-border" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-sidebar-foreground/60">
            <p>
              &copy; {currentYear} GC SMART CHECK. All rights reserved.
            </p>
          </div>

          {/* Bottom Links */}
          <div className="flex gap-6 text-xs">
            <Link
              href="/privacy"
              className="text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-sidebar-foreground/30">•</span>
            <Link
              href="/terms"
              className="text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors"
            >
              Terms of Service
            </Link>
          </div>

          {/* Version Info */}
          <div className="text-xs text-sidebar-foreground/50">
            v1.0.0
          </div>
        </div>
      </div>

      {/* Background Pattern (optional) */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sidebar-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sidebar-accent/5 rounded-full blur-3xl" />
      </div>
    </footer>
  );
}

// Default export for easier importing
export default Footer;

/**
 * Minimal Footer Component (for landing pages)
 */
export function MinimalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-sidebar border-t border-sidebar-border">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-sidebar-foreground/60">
            <p>
              &copy; {currentYear} GC SMART CHECK
            </p>
          </div>

          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-sidebar-foreground/60 hover:text-sidebar-primary">
              Privacy
            </Link>
            <span className="text-sidebar-foreground/30">•</span>
            <Link href="/terms" className="text-sidebar-foreground/60 hover:text-sidebar-primary">
              Terms
            </Link>
            <span className="text-sidebar-foreground/30">•</span>
            <Link href="/contact" className="text-sidebar-foreground/60 hover:text-sidebar-primary">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * Dashboard Footer (compact version for authenticated pages)
 */
export function DashboardFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card py-4 mt-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-4">
          {/* About */}
          <div>
            <h5 className="font-semibold text-foreground mb-2 text-sm">About SIA</h5>
            <p className="text-xs text-muted-foreground">
              Streamline your exam management with automated checking and grading.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h5 className="font-semibold text-foreground mb-2 text-sm">Quick Links</h5>
            <div className="flex flex-col gap-1">
              <Link href="/help" className="text-xs text-muted-foreground hover:text-primary">
                Help Center
              </Link>
              <Link href="/feedback" className="text-xs text-muted-foreground hover:text-primary">
                Send Feedback
              </Link>
              <Link href="/report-issue" className="text-xs text-muted-foreground hover:text-primary">
                Report Issue
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h5 className="font-semibold text-foreground mb-2 text-sm">Legal</h5>
            <div className="flex flex-col gap-1">
              <Link href="/privacy" className="text-xs text-muted-foreground hover:text-primary">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-xs text-muted-foreground hover:text-primary">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        <div className="my-4 border-t border-sidebar-border" />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} GC SMART CHECK. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            v1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}
