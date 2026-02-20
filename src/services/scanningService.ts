// Scanning Service - Real-time score tracking and null ID alerts

import {
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  Timestamp,
  updateDoc,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ScannedResult,
  NullIdAlert,
  ExamStatistics,
  AnswerChoice,
} from '@/types/scanning';

const SCANNED_RESULTS_COLLECTION = 'scannedResults';
const NULL_ID_ALERTS_COLLECTION = 'nullIdAlerts';

export class ScanningService {
  /**
   * Save scanned result
   */
  static async saveScannedResult(
    examId: string,
    studentId: string,
    answers: AnswerChoice[],
    answerKey: AnswerChoice[],
    userId: string,
    isNullId: boolean = false,
    choicePoints?: { [choice: string]: number }
  ): Promise<{ success: boolean; data?: ScannedResult; error?: string }> {
    try {
      const score = this.calculateScore(answers, answerKey, choicePoints);
      const resultId = `result_${examId}_${studentId}_${Date.now()}`;
      const now = new Date().toISOString();

      const resultData: ScannedResult = {
        id: resultId,
        examId,
        studentId,
        answers,
        score,
        totalQuestions: answerKey.length,
        scannedAt: now,
        scannedBy: userId,
        isNullId,
        resolved: false,
      };

      await setDoc(doc(db, SCANNED_RESULTS_COLLECTION, resultId), {
        ...resultData,
        scannedAt: serverTimestamp(),
      });

      // Create null ID alert if needed
      if (isNullId) {
        await this.createNullIdAlert(examId, resultId, studentId);
      }

      return { success: true, data: resultData };
    } catch (error) {
      console.error('Error saving scanned result:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Calculate score based on answer key and points per choice
   */
  static calculateScore(
    studentAnswers: AnswerChoice[],
    answerKey: AnswerChoice[],
    choicePoints?: { [choice: string]: number }
  ): number {
    let totalScore = 0;
    const length = Math.min(studentAnswers.length, answerKey.length);

    for (let i = 0; i < length; i++) {
      if (studentAnswers[i] === answerKey[i]) {
        // If choicePoints is provided, use it; otherwise default to 1 point per correct answer
        if (choicePoints && answerKey[i]) {
          totalScore += choicePoints[answerKey[i]] || 1;
        } else {
          totalScore += 1;
        }
      }
    }

    return totalScore;
  }

  /**
   * Subscribe to real-time score updates for an exam
   */
  static subscribeToScores(
    examId: string,
    callback: (scores: ScannedResult[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, SCANNED_RESULTS_COLLECTION),
      where('examId', '==', examId),
      orderBy('scannedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const scores: ScannedResult[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          scannedAt:
            (data.scannedAt as Timestamp)?.toDate().toISOString() || '',
        } as ScannedResult;
      });

      callback(scores);
    });
  }

  /**
   * Create null ID alert
   */
  static async createNullIdAlert(
    examId: string,
    scannedResultId: string,
    detectedId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const alertId = `alert_${scannedResultId}_${Date.now()}`;
      const now = new Date().toISOString();

      const alertData: NullIdAlert = {
        id: alertId,
        examId,
        scannedResultId,
        detectedId,
        timestamp: now,
        status: 'new',
      };

      await setDoc(doc(db, NULL_ID_ALERTS_COLLECTION, alertId), {
        ...alertData,
        timestamp: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error creating null ID alert:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Subscribe to null ID alerts
   */
  static subscribeToNullIdAlerts(
    examId: string,
    callback: (alerts: NullIdAlert[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, NULL_ID_ALERTS_COLLECTION),
      where('examId', '==', examId),
      where('status', '==', 'new'),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const alerts: NullIdAlert[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          timestamp:
            (data.timestamp as Timestamp)?.toDate().toISOString() || '',
          resolvedAt: data.resolvedAt
            ? (data.resolvedAt as Timestamp)?.toDate().toISOString()
            : undefined,
        } as NullIdAlert;
      });

      callback(alerts);
    });
  }

  /**
   * Resolve null ID alert
   */
  static async resolveNullIdAlert(
    alertId: string,
    resolvedBy: string,
    resolutionReason: string,
    assignedStudentId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const alertRef = doc(db, NULL_ID_ALERTS_COLLECTION, alertId);

      await updateDoc(alertRef, {
        status: 'resolved',
        resolvedBy,
        resolvedAt: serverTimestamp(),
        resolutionReason,
        assignedStudentId: assignedStudentId || null,
      });

      return { success: true };
    } catch (error) {
      console.error('Error resolving null ID alert:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Calculate exam statistics
   */
  static async calculateExamStatistics(
    examId: string
  ): Promise<{ success: boolean; data?: ExamStatistics; error?: string }> {
    try {
      const q = query(
        collection(db, SCANNED_RESULTS_COLLECTION),
        where('examId', '==', examId),
        where('isNullId', '==', false)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          success: true,
          data: {
            totalScanned: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
          },
        };
      }

      const scores = querySnapshot.docs.map((doc) => doc.data().score as number);
      const totalScanned = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const averageScore = sum / totalScanned;
      const highestScore = Math.max(...scores);
      const lowestScore = Math.min(...scores);

      return {
        success: true,
        data: {
          totalScanned,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore,
          lowestScore,
        },
      };
    } catch (error) {
      console.error('Error calculating statistics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all alerts for an exam
   */
  static async getAllAlerts(
    examId: string,
    status?: 'new' | 'resolved' | 'ignored'
  ): Promise<{ success: boolean; data?: NullIdAlert[]; error?: string }> {
    try {
      let q = query(
        collection(db, NULL_ID_ALERTS_COLLECTION),
        where('examId', '==', examId)
      );

      if (status) {
        q = query(q, where('status', '==', status));
      }

      q = query(q, orderBy('timestamp', 'desc'));

      const querySnapshot = await getDocs(q);
      const alerts: NullIdAlert[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          timestamp:
            (data.timestamp as Timestamp)?.toDate().toISOString() || '',
          resolvedAt: data.resolvedAt
            ? (data.resolvedAt as Timestamp)?.toDate().toISOString()
            : undefined,
        } as NullIdAlert;
      });

      return { success: true, data: alerts };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Bulk resolve alerts
   */
  static async bulkResolveAlerts(
    alertIds: string[],
    resolvedBy: string,
    resolutionReason: string
  ): Promise<{ success: boolean; resolved: number; errors: string[] }> {
    const errors: string[] = [];
    let resolved = 0;

    await Promise.all(
      alertIds.map(async (alertId) => {
        const result = await this.resolveNullIdAlert(
          alertId,
          resolvedBy,
          resolutionReason
        );
        if (result.success) {
          resolved++;
        } else {
          errors.push(`${alertId}: ${result.error}`);
        }
      })
    );

    return {
      success: errors.length === 0,
      resolved,
      errors,
    };
  }
}
