'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3, AlertCircle, ArrowLeft, FileText, Activity, Hash } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIcon = React.ComponentType<any>;
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { AnswerChoice } from '@/types/scanning';
import { toast } from 'sonner';

interface ItemAnalysisProps {
  params: { id: string };
}

interface QuestionAnalysis {
  questionNumber: number;
  correctAnswer: string;
  correctRate: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  discrimination: number;
  choiceDistribution: { [choice: string]: number };
  totalResponses: number;
}

export default function ItemAnalysisPage({ params }: ItemAnalysisProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionAnalysis[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const examId = params.id;

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        const examData = await getExamById(examId);
        if (!examData) {
          toast.error('Exam not found');
          setLoading(false);
          return;
        }
        setExam(examData);

        // Fetch answer key
        const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
        let answerKey: AnswerChoice[] = [];
        if (akResult.success && akResult.data) {
          answerKey = akResult.data.answers;
        }

        // Fetch real scanned results
        const scannedResult = await ScanningService.getScannedResultsByExamId(examId);
        const validResults = (scannedResult.success && scannedResult.data)
          ? scannedResult.data.filter(r => !r.isNullId)
          : [];
        setTotalPapers(validResults.length);

        if (validResults.length === 0 || answerKey.length === 0) {
          // No data to analyze
          setQuestions([]);
          setLoading(false);
          return;
        }

        // Sort students by total score for discrimination calculation
        const studentScores = validResults.map(r => {
          let score = 0;
          r.answers.forEach((ans, idx) => {
            if (answerKey[idx] && ans && ans.toUpperCase() === answerKey[idx].toUpperCase()) {
              score++;
            }
          });
          return { ...r, calculatedScore: score };
        }).sort((a, b) => b.calculatedScore - a.calculatedScore);

        // Upper 27% and lower 27% groups for discrimination
        const groupSize = Math.max(1, Math.ceil(studentScores.length * 0.27));
        const upperGroup = studentScores.slice(0, groupSize);
        const lowerGroup = studentScores.slice(-groupSize);

        const numQuestions = examData.num_items;
        const choicesCount = examData.choices_per_item;
        const analysisData: QuestionAnalysis[] = [];

        for (let i = 0; i < numQuestions; i++) {
          const correctAnswer = answerKey[i] || '';
          let correctCount = 0;
          const distribution: { [choice: string]: number } = {};

          // Initialize distribution for all choices
          for (let j = 0; j < choicesCount; j++) {
            distribution[String.fromCharCode(65 + j)] = 0;
          }

          // Count responses for this question
          let totalResponded = 0;
          validResults.forEach(result => {
            const ans = result.answers[i];
            if (ans) {
              const upperAns = ans.toUpperCase();
              if (distribution.hasOwnProperty(upperAns)) {
                distribution[upperAns]++;
              }
              totalResponded++;
              if (correctAnswer && upperAns === correctAnswer.toUpperCase()) {
                correctCount++;
              }
            }
          });

          const correctRate = totalResponded > 0
            ? Math.round((correctCount / totalResponded) * 100)
            : 0;

          let difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium';
          if (correctRate > 75) difficulty = 'Easy';
          else if (correctRate < 40) difficulty = 'Hard';

          // Discrimination index (upper group correct% - lower group correct%)
          let upperCorrect = 0;
          upperGroup.forEach(r => {
            const ans = r.answers[i];
            if (ans && correctAnswer && ans.toUpperCase() === correctAnswer.toUpperCase()) {
              upperCorrect++;
            }
          });
          let lowerCorrect = 0;
          lowerGroup.forEach(r => {
            const ans = r.answers[i];
            if (ans && correctAnswer && ans.toUpperCase() === correctAnswer.toUpperCase()) {
              lowerCorrect++;
            }
          });
          const discrimination = groupSize > 0
            ? parseFloat(((upperCorrect / groupSize) - (lowerCorrect / groupSize)).toFixed(2))
            : 0;

          analysisData.push({
            questionNumber: i + 1,
            correctAnswer: correctAnswer.toUpperCase(),
            correctRate,
            difficulty,
            discrimination,
            choiceDistribution: distribution,
            totalResponses: totalResponded,
          });
        }

        setQuestions(analysisData);
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        toast.error('Failed to load item analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [examId]);  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading item analysis...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-4 p-6">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-green-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  const avgDiscrimination = questions.length > 0
    ? parseFloat((questions.reduce((sum, q) => sum + q.discrimination, 0) / questions.length).toFixed(2))
    : 0;

  return (
    <div className="space-y-5 pt-4 px-1">

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Papers Analyzed', value: totalPapers, sub: 'Scanned answer sheets', icon: FileText as LucideIcon, color: 'text-green-700', bg: 'bg-green-100', grad: 'from-green-600 to-green-400' },
          { label: 'Avg Discrimination', value: avgDiscrimination, sub: 'Item quality (0–1)', icon: Activity as LucideIcon, color: 'text-green-700', bg: 'bg-green-100', grad: 'from-green-600 to-green-400' },
          { label: 'Questions Analyzed', value: questions.length, sub: 'Total exam items', icon: Hash as LucideIcon, color: 'text-green-700', bg: 'bg-green-100', grad: 'from-green-600 to-green-400' },
        ].map(({ label, value, sub, icon: Icon, color, bg, grad }) => (
          <Card key={label} className="bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className={`h-1 w-full bg-gradient-to-r ${grad}`} />
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Questions Detail */}
      <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-green-500 to-emerald-400" />
        <div className="p-4 sm:p-5">
          <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" />
            Question Statistics
          </h2>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {questions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium text-sm">No analysis data available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Scan answer sheets to generate item analysis.</p>
              </div>
            ) : (
              questions.map(q => (
                <div key={q.questionNumber} className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-white hover:shadow-sm transition-all">
                  {/* Q number + key */}
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {q.questionNumber}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">Q{q.questionNumber}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">
                      Key: {q.correctAnswer}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      q.correctRate >= 75 ? 'bg-green-50 text-green-700 border-green-200' :
                      q.correctRate >= 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>{q.correctRate}% correct</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      q.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border-green-200' :
                      q.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>{q.difficulty}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      q.discrimination >= 0.4 ? 'bg-green-50 text-green-700 border-green-200' :
                      q.discrimination >= 0.2 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>D: {q.discrimination}</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] border border-gray-200">
                      {q.totalResponses} resp.
                    </span>
                  </div>

                  {/* Mini bar chart inline */}
                  <div className="flex items-end gap-1 ml-auto">
                    {Object.entries(q.choiceDistribution).map(([choice, count]) => {
                      const percentage = q.totalResponses > 0 ? (count / q.totalResponses) * 100 : 0;
                      const isCorrect = choice === q.correctAnswer;
                      return (
                        <div key={choice} className="flex flex-col items-center gap-0.5">
                          <div className="relative w-5 bg-gray-100 rounded-sm overflow-hidden" style={{ height: 28 }}>
                            <div
                              className={`absolute bottom-0 w-full rounded-sm ${isCorrect ? 'bg-green-400' : 'bg-blue-200'}`}
                              style={{ height: `${Math.max(5, percentage)}%` }}
                            />
                            {isCorrect && <div className="absolute inset-0 ring-1 ring-green-500 rounded-sm" />}
                          </div>
                          <span className={`text-[9px] font-bold ${isCorrect ? 'text-green-700' : 'text-gray-400'}`}>{choice}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Analysis Tips */}
      <Card className="bg-white border border-green-200 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-green-600 to-green-400" />
        <div className="p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-green-600" />
            How to Read This Report
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li className="flex gap-2"><span className="text-green-500 font-bold mt-0.5">•</span><span><strong className="text-foreground">Correct Rate:</strong> % of students who answered the question correctly.</span></li>
            <li className="flex gap-2"><span className="text-green-500 font-bold mt-0.5">•</span><span><strong className="text-foreground">Discrimination:</strong> How well the question separates high from low scorers. Higher is better (0–1 scale).</span></li>
            <li className="flex gap-2"><span className="text-green-500 font-bold mt-0.5">•</span><span><strong className="text-foreground">Distribution:</strong> Bar chart showing how many students picked each answer choice.</span></li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
