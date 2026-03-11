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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="exams" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Archived </span>Exams
          </TabsTrigger>
          <TabsTrigger value="classes" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Archived </span>Classes
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">
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
