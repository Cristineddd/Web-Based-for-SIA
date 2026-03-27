'use client';

import { useState } from 'react';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import ArchivedExams from '@/components/pages/ArchivedExams';
import ArchivedClasses from '@/components/pages/ArchivedClasses';
import ReportHistory from '@/components/pages/ReportHistory';

export default function Archive() {
  const [activeTab, setActiveTab] = useState('exams');

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Archive</h1>
        <p className="text-sm text-gray-500 mt-1">View archived exams, classes, and report history</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100">
          <TabsTrigger value="exams" className="text-xs sm:text-sm data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <span className="hidden sm:inline">Archived </span>Exams
          </TabsTrigger>
          <TabsTrigger value="classes" className="text-xs sm:text-sm data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <span className="hidden sm:inline">Archived </span>Classes
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <span className="hidden sm:inline">Report </span>History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exams" className="mt-6">
          <ArchivedExams />
        </TabsContent>

        <TabsContent value="classes" className="mt-6">
          <ArchivedClasses />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
