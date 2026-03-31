/**
 * Footer Component
 * Displays footer with links, contact info, legal notices, and branding
 * Appears on all pages below main content
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
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
		<footer className="bg-white border-t border-gray-200 mt-12">
			<div className="max-w-7xl mx-auto px-6 py-12">
				{/* Top Row */}
				<div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
					{/* Brand */}
					<div className="space-y-4 max-w-sm">
						<div className="flex items-center gap-3">
							<div className="w-9 h-9 flex items-center justify-center bg-green-50 rounded-lg flex-shrink-0">
								<Image
									src="/gclogo.png"
									alt="GC Logo"
									width={24}
									height={24}
									className="object-contain"
								/>
							</div>
							<div>
								<h3 className="text-base font-bold text-[#166534]">
									GC SMART CHECK
								</h3>
								<p className="text-xs text-gray-400">
									Exam &amp; Quiz Builder
								</p>
							</div>
						</div>
						<p className="text-sm text-gray-500 leading-relaxed">
							A streamlined, paper-based exam checking solution for efficient
							exam management and automatic grading.
						</p>
						{/* Social Links */}
						<div className="flex gap-3 pt-1">
							{socialLinks.map((social) => {
								const Icon = social.icon;
								return (
									<a
										key={social.name}
										href={social.href}
										target="_blank"
										rel="noopener noreferrer"
										title={social.label}
										className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-[#166534] transition-colors"
										aria-label={social.label}
									>
										<Icon className="w-4 h-4" />
									</a>
								);
							})}
						</div>
					</div>

					{/* Links */}
					<div className="flex flex-wrap gap-10">
						<div className="space-y-3">
							<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
								Navigation
							</h4>
							<div className="flex flex-col gap-2">
								{[
									{ href: '/dashboard', label: 'Dashboard' },
									{ href: '/classes', label: 'Classes' },
									{ href: '/exams', label: 'Exams' },
									{ href: '/results', label: 'Results' },
								].map((link) => (
									<Link
										key={link.href}
										href={link.href}
										className="text-sm text-gray-500 hover:text-[#166534] transition-colors"
									>
										{link.label}
									</Link>
								))}
							</div>
						</div>

						<div className="space-y-3">
							<h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
								Legal
							</h4>
							<div className="flex flex-col gap-2">
								<Link
									href="/privacy"
									className="text-sm text-gray-500 hover:text-[#166534] transition-colors"
								>
									Privacy Policy
								</Link>
								<Link
									href="/terms"
									className="text-sm text-gray-500 hover:text-[#166534] transition-colors"
								>
									Terms of Service
								</Link>
								<Link
									href="/contact"
									className="text-sm text-gray-500 hover:text-[#166534] transition-colors"
								>
									Contact Us
								</Link>
							</div>
						</div>
					</div>
				</div>

				{/* Divider */}
				<div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
					<p className="text-xs text-gray-400">
						&copy; {currentYear} GC SMART CHECK. All rights reserved.
					</p>
					<p className="text-xs text-gray-300">v1.0.0 · Gordon College</p>
				</div>
			</div>
		</footer>
	);
}

export default Footer;

/**
 * Minimal Footer Component (for landing pages)
 */
export function MinimalFooter() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="bg-white border-t border-gray-200">
			<div className="max-w-7xl mx-auto px-4 py-8">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<div className="text-sm text-gray-400">
						<p>&copy; {currentYear} GC SMART CHECK</p>
					</div>

					<div className="flex gap-6 text-sm">
						<Link
							href="/privacy"
							className="text-gray-400 hover:text-[#166534] transition-colors"
						>
							Privacy
						</Link>
						<span className="text-gray-200">•</span>
						<Link
							href="/terms"
							className="text-gray-400 hover:text-[#166534] transition-colors"
						>
							Terms
						</Link>
						<span className="text-gray-200">•</span>
						<Link
							href="/contact"
							className="text-gray-400 hover:text-[#166534] transition-colors"
						>
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
		<footer className="border-t border-gray-200 bg-white py-4 mt-8">
			<div className="max-w-7xl mx-auto px-4">
				<div className="flex items-center justify-between">
					<p className="text-xs text-gray-400">
						&copy; {currentYear} GC SMART CHECK. All rights reserved.
					</p>
					<p className="text-xs text-gray-300">v1.0.0</p>
				</div>
			</div>
		</footer>
	);
}
