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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Archive</h1>
        <p className="text-muted-foreground mt-1">
          View and manage archived exams, classes, and report history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="exams">Archived Exams</TabsTrigger>
          <TabsTrigger value="classes">Archived Classes</TabsTrigger>
          <TabsTrigger value="reports">Report History</TabsTrigger>
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
