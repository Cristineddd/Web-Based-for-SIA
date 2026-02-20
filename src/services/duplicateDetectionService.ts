
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DuplicateMatch {
  matchType: 'student_id' | 'email' | 'name_combination';
  existingStudent: {
    student_id: string;
    first_name: string;
    last_name: string;
    email?: string;
    created_at: string;
  };
  uploadRecord: {
    student_id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
  severity: 'high' | 'medium' | 'low'; // high=student_id, medium=email, low=name
  confidence: number; // 0-1 confidence score
}

export interface DuplicateDetectionResult {
  hasDuplicates: boolean;
  totalRecords: number;
  duplicateCount: number;
  potentialDuplicates: DuplicateMatch[];
  cleanRecords: Array<{
    student_id: string;
    first_name: string;
    last_name: string;
    email?: string;
  }>;
}

export class DuplicateDetectionService {
  private static readonly STUDENTS_COLLECTION = 'students';

  /**
   * Check if a student ID already exists
   */
  static async checkStudentIdExists(studentId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.STUDENTS_COLLECTION, studentId);
      const docSnap = await getDoc(docRef);
      const exists = docSnap.exists();
      if (exists) {
        console.log(`[DuplicateDetection] Student ID "${studentId}" exists in database`);
      }
      return exists;
    } catch (error) {
      console.error(`[DuplicateDetection] Error checking student ID "${studentId}":`, error);
      // If query fails, return false to avoid blocking import
      return false;
    }
  }

  /**
   * Find students by email
   */
  static async findStudentsByEmail(email: string): Promise<any[]> {
    if (!email || email.trim() === '') return [];

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const q = query(
        collection(db, this.STUDENTS_COLLECTION),
        where('email', '==', normalizedEmail)
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(doc => ({
        student_id: doc.id,
        ...doc.data()
      }));
      
      if (results.length > 0) {
        console.log(`Found ${results.length} student(s) with email: ${email}`);
      }
      return results;
    } catch (error) {
      console.warn(`Error finding students by email "${email}":`, error);
      // Don't return empty array - log the issue but continue
      return [];
    }
  }

  /**
   * Find students by name combination (first_name + last_name)
   */
  static async findStudentsByName(firstName: string, lastName: string): Promise<any[]> {
    const normalizedFirst = firstName.toLowerCase().trim();
    const normalizedLast = lastName.toLowerCase().trim();

    try {
      // Query for first_name match
      const q = query(
        collection(db, this.STUDENTS_COLLECTION),
        where('first_name', '==', normalizedFirst)
      );
      const querySnapshot = await getDocs(q);
      
      // Filter for last_name match and return
      return querySnapshot.docs
        .filter(doc => 
          doc.data().last_name.toLowerCase().trim() === normalizedLast
        )
        .map(doc => ({
          student_id: doc.id,
          ...doc.data()
        }));
    } catch (error) {
      console.error('Error finding students by name:', error);
      return [];
    }
  }

  /**
   * Calculate name similarity using Levenshtein distance
   * Returns a score between 0-1 where 1 is exact match
   */
  private static calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1;
    if (n1 === '' || n2 === '') return 0;

    const maxLen = Math.max(n1.length, n2.length);
    const distance = this.levenshteinDistance(n1, n2);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Detect duplicates in upload records
   */
  static async detectDuplicates(
    uploadRecords: Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      email?: string;
    }>
  ): Promise<DuplicateDetectionResult> {
    const duplicateMatches: DuplicateMatch[] = [];
    const cleanRecords = [];
    const processedIds = new Set<string>();

    for (const record of uploadRecords) {
      const recordKey = `${record.student_id}`;

      // Skip if already processed in this batch
      if (processedIds.has(recordKey)) {
        continue;
      }
      processedIds.add(recordKey);

      let isDuplicate = false;

      // 1. Check if student_id already exists (PRIMARY KEY - highest severity)
      const idExists = await this.checkStudentIdExists(record.student_id);
      if (idExists) {
        console.log(`DUPLICATE FOUND: Student ID "${record.student_id}" already exists in database`);
        const existingDoc = await getDoc(
          doc(db, this.STUDENTS_COLLECTION, record.student_id)
        );
        if (existingDoc.exists()) {
          const existingData = existingDoc.data();
          console.log(`Existing student data:`, existingData);
          duplicateMatches.push({
            matchType: 'student_id',
            existingStudent: {
              student_id: record.student_id,
              first_name: existingData.first_name,
              last_name: existingData.last_name,
              email: existingData.email,
              created_at: existingData.created_at,
            },
            uploadRecord: record,
            severity: 'high',
            confidence: 1.0,
          });
          isDuplicate = true;
        }
      }

      // 2. Check email duplicates (medium severity)
      if (record.email && !isDuplicate) {
        const emailMatches = await this.findStudentsByEmail(record.email);
        if (emailMatches.length > 0) {
          for (const existing of emailMatches) {
            // Don't flag if the email belongs to the same student ID
            if (existing.student_id !== record.student_id) {
              duplicateMatches.push({
                matchType: 'email',
                existingStudent: {
                  student_id: existing.student_id,
                  first_name: existing.first_name,
                  last_name: existing.last_name,
                  email: existing.email,
                  created_at: existing.created_at,
                },
                uploadRecord: record,
                severity: 'medium',
                confidence: 1.0,
              });
              isDuplicate = true;
            }
          }
        }
      }

      // 3. Check name combination duplicates (low severity - fuzzy match)
      if (!isDuplicate) {
        const nameMatches = await this.findStudentsByName(
          record.first_name,
          record.last_name
        );
        if (nameMatches.length > 0) {
          for (const existing of nameMatches) {
            const similarity = this.calculateNameSimilarity(
              `${record.first_name} ${record.last_name}`,
              `${existing.first_name} ${existing.last_name}`
            );

            // Only flag if similarity is high enough (>0.85)
            if (similarity > 0.85) {
              duplicateMatches.push({
                matchType: 'name_combination',
                existingStudent: {
                  student_id: existing.student_id,
                  first_name: existing.first_name,
                  last_name: existing.last_name,
                  email: existing.email,
                  created_at: existing.created_at,
                },
                uploadRecord: record,
                severity: 'low',
                confidence: similarity,
              });
              isDuplicate = true;
            }
          }
        }
      }

      // Add to clean records if no duplicates found
      if (!isDuplicate) {
        cleanRecords.push(record);
      }
    }

    return {
      hasDuplicates: duplicateMatches.length > 0,
      totalRecords: uploadRecords.length,
      duplicateCount: uploadRecords.length - cleanRecords.length,
      potentialDuplicates: duplicateMatches,
      cleanRecords,
    };
  }

  /**
   * Check for duplicates within the upload batch itself
   */
  static findInternalDuplicates(
    records: Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      email?: string;
    }>
  ): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];
    const seen = new Map<string, any>();

    for (const record of records) {
      // Check student_id
      if (seen.has(record.student_id)) {
        duplicates.push({
          matchType: 'student_id',
          existingStudent: {
            student_id: seen.get(record.student_id).student_id,
            first_name: seen.get(record.student_id).first_name,
            last_name: seen.get(record.student_id).last_name,
            email: seen.get(record.student_id).email,
            created_at: new Date().toISOString(),
          },
          uploadRecord: record,
          severity: 'high',
          confidence: 1.0,
        });
      } else {
        seen.set(record.student_id, record);
      }

      // Check email
      if (record.email) {
        for (const [, seenRecord] of seen) {
          if (
            seenRecord.student_id !== record.student_id &&
            seenRecord.email === record.email &&
            record.email !== ''
          ) {
            duplicates.push({
              matchType: 'email',
              existingStudent: {
                student_id: seenRecord.student_id,
                first_name: seenRecord.first_name,
                last_name: seenRecord.last_name,
                email: seenRecord.email,
                created_at: new Date().toISOString(),
              },
              uploadRecord: record,
              severity: 'medium',
              confidence: 1.0,
            });
          }
        }
      }
    }

    return duplicates;
  }
}
