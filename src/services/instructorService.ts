import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface InstructorProfile {
  instructorId: string;
  userId: string; // Firebase Auth UID
  email: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

const INSTRUCTORS_COLLECTION = 'instructors';
const INSTRUCTOR_COUNTER_DOC = 'instructor_counter';
const METADATA_COLLECTION = 'metadata';

/**
 * Generate the next available instructor ID
 * Format: INSTRUCTOR-001, INSTRUCTOR-002, etc.
 */
async function generateInstructorId(): Promise<string> {
  try {
    console.log('🔄 Generating instructor ID...');
    
    // Get the current counter from metadata collection
    const counterRef = doc(db, METADATA_COLLECTION, INSTRUCTOR_COUNTER_DOC);
    const counterDoc = await getDoc(counterRef);
    
    let nextNumber = 1;
    
    if (counterDoc.exists()) {
      nextNumber = (counterDoc.data().lastNumber || 0) + 1;
      console.log('Last instructor number:', counterDoc.data().lastNumber);
    } else {
      console.log('No counter found, starting with 1');
    }
    
    // Update the counter
    await setDoc(counterRef, { lastNumber: nextNumber }, { merge: true });
    console.log(' Updated counter to:', nextNumber);
    
    // Format as INSTRUCTOR-001, INSTRUCTOR-002, etc.
    const instructorId = `INSTRUCTOR-${String(nextNumber).padStart(3, '0')}`;
    console.log(' Generated instructor ID:', instructorId);
    
    return instructorId;
  } catch (error) {
    console.error('❌ Error generating instructor ID:', error);
    // Fallback: Try to find the highest existing instructor ID
    return await generateInstructorIdFallback();
  }
}

/**
 * Fallback method to generate instructor ID by querying existing instructors
 */
async function generateInstructorIdFallback(): Promise<string> {
  try {
    const q = query(
      collection(db, INSTRUCTORS_COLLECTION),
      orderBy('instructorId', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const lastInstructor = querySnapshot.docs[0].data();
      const lastId = lastInstructor.instructorId;
      // Extract number from format: INSTRUCTOR-001
      const match = lastId.match(/INSTRUCTOR-(\d+)/);
      if (match) {
        const nextNumber = parseInt(match[1], 10) + 1;
        return `INSTRUCTOR-${String(nextNumber).padStart(3, '0')}`;
      }
    }
    
    // If no existing instructors, start with 001
    return 'INSTRUCTOR-001';
  } catch (error) {
    console.error('Error in fallback instructor ID generation:', error);
    // Last resort: use timestamp-based ID
    const timestamp = Date.now();
    return `INSTRUCTOR-${timestamp}`;
  }
}

/**
 * Create an instructor profile
 */
export async function createInstructorProfile(
  userId: string,
  email: string,
  fullName: string
): Promise<InstructorProfile> {
  try {
    console.log('🔄 Creating instructor profile for userId:', userId);
    
    // Check if instructor profile already exists
    const existingProfile = await getInstructorProfileByUserId(userId);
    if (existingProfile) {
      console.log('✅ Instructor profile already exists:', existingProfile.instructorId);
      return existingProfile;
    }
    
    // Generate new instructor ID
    const instructorId = await generateInstructorId();
    console.log('📝 Creating profile with ID:', instructorId);
    
    const instructorProfile: InstructorProfile = {
      instructorId,
      userId,
      email,
      fullName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save to Firestore using instructorId as document ID for easy lookup
    await setDoc(doc(db, INSTRUCTORS_COLLECTION, instructorId), instructorProfile);
    
    console.log('✅ Instructor profile created successfully:', instructorId);
    return instructorProfile;
  } catch (error) {
    console.error('❌ Error creating instructor profile:', error);
    throw error;
  }
}

/**
 * Get instructor profile by user ID
 */
export async function getInstructorProfileByUserId(
  userId: string
): Promise<InstructorProfile | null> {
  try {
    const q = query(
      collection(db, INSTRUCTORS_COLLECTION),
      where('userId', '==', userId),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      return data as InstructorProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching instructor profile by userId:', error);
    return null;
  }
}

/**
 * Get instructor profile by instructor ID
 */
export async function getInstructorProfile(
  instructorId: string
): Promise<InstructorProfile | null> {
  try {
    const docRef = doc(db, INSTRUCTORS_COLLECTION, instructorId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as InstructorProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching instructor profile:', error);
    return null;
  }
}
