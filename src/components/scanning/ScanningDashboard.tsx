"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FileKey, Users, Activity, AlertCircle } from "lucide-react";
import AnswerKeyEditor from "@/components/pages/AnswerKeyEditor";
import StudentRosterManager from "@/components/scanning/StudentRosterManager";
import LiveScoreDisplay from "@/components/scanning/LiveScoreDisplay";
import NullIdAlertManager from "@/components/scanning/NullIdAlertManager";
import { useAuth } from "@/contexts/AuthContext";

interface ScanningDashboardProps {
  examId: string;
  examTitle: string;
  questionCount: number;
}

export default function ScanningDashboard({
  examId,
  examTitle,
  questionCount,
}: ScanningDashboardProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("answer-key");

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Please sign in to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{examTitle}</h1>
        <p className="text-muted-foreground">
          Scanning & Auto-Grading Management
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="answer-key" className="gap-2">
            <FileKey className="h-4 w-4" />
            Answer Key
          </TabsTrigger>
          <TabsTrigger value="roster" className="gap-2">
            <Users className="h-4 w-4" />
            Student Roster
          </TabsTrigger>
          <TabsTrigger value="live-scores" className="gap-2">
            <Activity className="h-4 w-4" />
            Live Scores
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        {/* Answer Key Tab */}
        <TabsContent value="answer-key" className="space-y-4">
          <AnswerKeyEditor params={{ id: examId }} />
        </TabsContent>

        {/* Student Roster Tab */}
        <TabsContent value="roster" className="space-y-4">
          <StudentRosterManager examId={examId} userId={user.id} />
        </TabsContent>

        {/* Live Scores Tab */}
        <TabsContent value="live-scores" className="space-y-4">
          <LiveScoreDisplay examId={examId} totalQuestions={questionCount} />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <NullIdAlertManager examId={examId} userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
