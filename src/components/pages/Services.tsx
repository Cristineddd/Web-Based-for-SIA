'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Archive,
  Settings,
  Clipboard,
  TrendingUp,
  Eye,
  Sparkles,
  BookOpen,
  Shield,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  path: string;
  status: 'active' | 'beta' | 'coming-soon';
}

const services: Service[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Central hub for monitoring system statistics, recent activity, and quick access to key metrics.',
    icon: <LayoutDashboard className="w-8 h-8" />,
    features: ['Real-time statistics', 'Recent activity', 'Quick actions', 'System overview'],
    path: '/dashboard',
    status: 'active',
  },
  {
    id: 'exams',
    title: 'Exam Management',
    description: 'Create, manage, and organize exams with comprehensive exam details and question management.',
    icon: <FileText className="w-8 h-8" />,
    features: ['Create exams', 'Manage questions', 'Set answer keys', 'Exam templates'],
    path: '/exams',
    status: 'active',
  },
  {
    id: 'classes',
    title: 'Class Management',
    description: 'Organize classes, manage student rosters, and track class enrollment and performance.',
    icon: <Users className="w-8 h-8" />,
    features: ['Create classes', 'Manage students', 'Track enrollment', 'Batch operations'],
    path: '/classes',
    status: 'active',
  },
  {
    id: 'results',
    title: 'Results & Scoring',
    description: 'View and manage exam results, automatically calculate scores, and track student performance.',
    icon: <BarChart3 className="w-8 h-8" />,
    features: ['Auto-scoring', 'Performance tracking', 'Grade analysis', 'Result export'],
    path: '/results',
    status: 'active',
  },
  {
    id: 'scanning',
    title: 'OMR Scanning',
    description: 'Advanced optical mark recognition for scanning and processing exam papers with instant feedback.',
    icon: <Sparkles className="w-8 h-8" />,
    features: ['Live scanning', 'Mark detection', 'Null ID alerts', 'Real-time scoring'],
    path: '/dashboard',
    status: 'active',
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    description: 'Generate comprehensive reports with detailed analytics, charts, and exportable data.',
    icon: <TrendingUp className="w-8 h-8" />,
    features: ['Statistical reports', 'Charts & graphs', 'Data export', 'Trend analysis'],
    path: '/reports',
    status: 'active',
  },
  {
    id: 'item-analysis',
    title: 'Item Analysis',
    description: 'Analyze individual exam questions for difficulty, discrimination, and effectiveness.',
    icon: <Eye className="w-8 h-8" />,
    features: ['Question difficulty', 'Discrimination index', 'Performance metrics', 'Recommendations'],
    path: '/exams',
    status: 'active',
  },
  {
    id: 'audit-logs',
    title: 'Audit Logs',
    description: 'Track all system activities, user actions, and file uploads with comprehensive logging.',
    icon: <Shield className="w-8 h-8" />,
    features: ['Activity tracking', 'Upload logs', 'User actions', '90-day retention'],
    path: '/audit-logs',
    status: 'active',
  },
  {
    id: 'answer-key',
    title: 'Answer Key Editor',
    description: 'Create and manage answer keys with support for various question types and formats.',
    icon: <Clipboard className="w-8 h-8" />,
    features: ['Visual editor', 'Multiple formats', 'Import/export', 'Validation'],
    path: '/exams',
    status: 'active',
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'Use pre-built templates for exams, answer sheets, and documents to speed up setup.',
    icon: <BookOpen className="w-8 h-8" />,
    features: ['Pre-built templates', 'Customizable', 'Reusable', 'Quick setup'],
    path: '/templates',
    status: 'active',
  },
  {
    id: 'archive',
    title: 'Archive',
    description: 'Archive and retrieve historical data, past exams, and completed assessments.',
    icon: <Archive className="w-8 h-8" />,
    features: ['Data archival', 'Historical access', 'Bulk operations', 'Restore data'],
    path: '/archive',
    status: 'active',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure system preferences, user accounts, and advanced options.',
    icon: <Settings className="w-8 h-8" />,
    features: ['User management', 'System preferences', 'Account settings', 'Security'],
    path: '/settings',
    status: 'active',
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'beta':
      return 'bg-blue-100 text-blue-800';
    case 'coming-soon':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'beta':
      return 'Beta';
    case 'coming-soon':
      return 'Coming Soon';
    default:
      return 'Unknown';
  }
};

export function Services() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredServices = selectedCategory
    ? services.filter(s => s.status === selectedCategory)
    : services;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">System Services</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            Explore all the powerful features and tools available in the SIA system. From exam management
            to comprehensive analytics, we provide everything you need for efficient exam administration.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap gap-3">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
              size="sm"
            >
              All Services ({services.length})
            </Button>
            <Button
              variant={selectedCategory === 'active' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('active')}
              size="sm"
            >
              Active ({services.filter(s => s.status === 'active').length})
            </Button>
            <Button
              variant={selectedCategory === 'beta' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('beta')}
              size="sm"
            >
              Beta ({services.filter(s => s.status === 'beta').length})
            </Button>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => (
            <Link key={service.id} href={service.path}>
              <Card className="h-full hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer group">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                      {service.icon}
                    </div>
                    <Badge className={getStatusColor(service.status)}>
                      {getStatusLabel(service.status)}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Key Features:</h4>
                      <ul className="space-y-1">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex items-center">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 group-hover:text-blue-600 transition-colors">
                        Click to access service →
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No services found</h3>
            <p className="text-slate-600">Try adjusting your filters to see available services.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Need Help?</h3>
              <p className="text-sm text-slate-600">
                Each service includes built-in help and documentation. Hover over the info icons for quick tips.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Getting Started</h3>
              <p className="text-sm text-slate-600">
                Start with the Dashboard to get an overview of the system, then explore individual services.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Advanced Features</h3>
              <p className="text-sm text-slate-600">
                Check the Settings page to configure advanced options and user preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
