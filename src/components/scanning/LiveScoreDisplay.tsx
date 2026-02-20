"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
} from "lucide-react";
import { ScanningService } from "@/services/scanningService";
import { ScannedResult, ExamStatistics } from "@/types/scanning";
import { formatDistanceToNow } from "date-fns";

interface LiveScoreDisplayProps {
  examId: string;
  totalQuestions: number;
}

export default function LiveScoreDisplay({
  examId,
  totalQuestions,
}: LiveScoreDisplayProps) {
  const [scores, setScores] = useState<ScannedResult[]>([]);
  const [statistics, setStatistics] = useState<ExamStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    setConnectionStatus("connected");

    // Subscribe to real-time score updates
    const unsubscribe = ScanningService.subscribeToScores(
      examId,
      (newScores) => {
        setScores(newScores);
        setLastUpdated(new Date());
        setLoading(false);
      },
    );

    // Load statistics
    loadStatistics();

    // Refresh statistics every 30 seconds
    const statsInterval = setInterval(loadStatistics, 30000);

    return () => {
      unsubscribe();
      clearInterval(statsInterval);
    };
  }, [examId]);

  const loadStatistics = async () => {
    const result = await ScanningService.calculateExamStatistics(examId);
    if (result.success && result.data) {
      setStatistics(result.data);
    }
  };

  const getScoreColor = (score: number) => {
    const percentage = (score / totalQuestions) * 100;
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-blue-600";
    if (percentage >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScorePercentage = (score: number) => {
    return ((score / totalQuestions) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading scores...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Scanned
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.totalScanned}
              </div>
              <p className="text-xs text-muted-foreground">
                Students completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Score
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.averageScore.toFixed(1)} / {totalQuestions}
              </div>
              <p className="text-xs text-muted-foreground">
                {((statistics.averageScore / totalQuestions) * 100).toFixed(1)}%
                average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Highest Score
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics.highestScore} / {totalQuestions}
              </div>
              <p className="text-xs text-muted-foreground">
                {((statistics.highestScore / totalQuestions) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Lowest Score
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics.lowestScore} / {totalQuestions}
              </div>
              <p className="text-xs text-muted-foreground">
                {((statistics.lowestScore / totalQuestions) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Scores Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Score Feed</CardTitle>
              <CardDescription>
                Scores update automatically as papers are scanned
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-muted-foreground">
                  {connectionStatus === "connected" ? "Live" : "Disconnected"}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No scores yet. Waiting for scans...
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scanned At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((result) => (
                    <TableRow
                      key={result.id}
                      className="animate-in fade-in-0 slide-in-from-top-1"
                    >
                      <TableCell className="font-medium">
                        {result.studentId}
                        {result.isNullId && (
                          <Badge variant="destructive" className="ml-2">
                            Unrecognized
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={getScoreColor(result.score)}>
                        <span className="font-bold">{result.score}</span> /{" "}
                        {totalQuestions}
                      </TableCell>
                      <TableCell className={getScoreColor(result.score)}>
                        {getScorePercentage(result.score)}%
                      </TableCell>
                      <TableCell>
                        {result.isNullId ? (
                          <Badge variant="destructive">Needs Review</Badge>
                        ) : (
                          <Badge variant="default">Complete</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(result.scannedAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
