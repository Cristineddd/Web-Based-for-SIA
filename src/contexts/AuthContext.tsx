'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { createInstructorProfile } from '@/services/instructorService';

type AppRole = 'instructor';

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;
  displayName?: string;
  role: AppRole;
  instructorId?: string; // New field for instructor ID
}

interface AppSession {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AppUser;
}

interface AuthContextType {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  userRole: AppRole | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; needsVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
  firebaseUser: FirebaseUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// OPTIMIZATION 1: Cache for user data
const userCache = new Map<string, AppUser>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true); // Start as true to prevent premature access
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  
  // OPTIMIZATION 2: Use ref for timeout management
  const tokenTimeoutRef = useRef<NodeJS.Timeout>();
  const firestoreTimeoutRef = useRef<NodeJS.Timeout>();

  // OPTIMIZATION 3: Cleanup function for timeouts
  const clearTimeouts = useCallback(() => {
    if (tokenTimeoutRef.current) clearTimeout(tokenTimeoutRef.current);
    if (firestoreTimeoutRef.current) clearTimeout(firestoreTimeoutRef.current);
  }, []);

  // OPTIMIZATION 11: Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = () => {
      try {
        const savedSession = localStorage.getItem('auth_session');
        if (savedSession) {
          const session = JSON.parse(savedSession);
          setUser(session.user);
          setSession(session);
          setUserRole(session.user.role);
          // Don't set loading to false yet - wait for Firebase verification
        }
      } catch (error) {
        // Silently fail if session data is corrupted
        console.warn('Could not restore session from localStorage');
      }
    };

    restoreSession();
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      try {
        if (firebaseUser) {
          // User is signed in - set basic user info immediately (non-blocking)
          setFirebaseUser(firebaseUser);
          
          // OPTIMIZATION 4: Check cache first
          const cachedUser = userCache.get(firebaseUser.uid);
          
          if (cachedUser && cachedUser.instructorId) {
            // Use cached user data ONLY if it has instructorId
            setUser(cachedUser);
            setUserRole(cachedUser.role);
            
            const newSession = {
              access_token: 'authenticated',
              expires_in: 3600,
              token_type: 'bearer',
              user: cachedUser,
            };
            setSession(newSession);
            // OPTIMIZATION 11: Persist session to localStorage
            localStorage.setItem('auth_session', JSON.stringify(newSession));
          } else {
            // Create basic app user from Firebase data
            const basicAppUser: AppUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user_metadata: {
                full_name: firebaseUser.displayName || '',
              },
              displayName: firebaseUser.displayName || '',
              role: 'instructor',
            };
            
            setUser(basicAppUser);
            setUserRole('instructor');
            userCache.set(firebaseUser.uid, basicAppUser);
            
            const newSession = {
              access_token: 'authenticated',
              expires_in: 3600,
              token_type: 'bearer',
              user: basicAppUser,
            };
            setSession(newSession);
            // OPTIMIZATION 11: Persist session to localStorage
            localStorage.setItem('auth_session', JSON.stringify(newSession));
            
            // Set loading to false immediately - user can access app now
            setLoading(false);
          }
          
          // OPTIMIZATION 5: Fetch token with timeout (without AbortController)
          Promise.race([
            firebaseUser.getIdToken(),
            new Promise((_, reject) => {
              tokenTimeoutRef.current = setTimeout(() => {
                reject(new Error('Token fetch timeout'));
              }, 2000);
            })
          ]).then((token) => {
            setSession((prev) => prev ? {
              ...prev,
              access_token: token as string,
            } : null);
          }).catch((error) => {
            if (error?.message !== 'Token fetch timeout') {
              console.warn('Could not fetch ID token:', error?.message);
            }
          }).finally(() => {
            clearTimeouts();
          });

          // OPTIMIZATION 6: Lazy load Firestore user data with timeout
          // ALWAYS fetch from Firestore if cache doesn't have instructorId
          if (!cachedUser || !cachedUser.instructorId) {
            const loadUserData = async () => {
              try {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                
                // Fetch user data with 3 second timeout (no retry - fail fast)
                let userDoc;
                try {
                  userDoc = await Promise.race([
                    getDoc(userDocRef),
                    new Promise((_, reject) => {
                      setTimeout(() => reject(new Error('Firestore timeout')), 3000);
                    })
                  ]) as any;
                } catch (timeoutError) {
                  console.warn('Firestore fetch timed out - using cached data');
                  return; // Fail fast, user already has basic data
                }
                
                if (userDoc && userDoc.exists()) {
                  const userData = userDoc.data();
                  
                  const fullUserData: AppUser = {
                    id: firebaseUser.uid,
                    email: userData.email || firebaseUser.email || '',
                    created_at: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    updated_at: userData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    user_metadata: {
                      full_name: userData.fullName || firebaseUser.displayName || '',
                    },
                    displayName: userData.fullName || firebaseUser.displayName || '',
                    role: userData.role || 'instructor',
                    instructorId: userData.instructorId, // Read directly from users collection
                  };
                  
                  setUser(fullUserData);
                  setUserRole(userData.role || 'instructor');
                  userCache.set(firebaseUser.uid, fullUserData);
                  
                  // Update session with full user data
                  const updatedSession = {
                    access_token: 'authenticated',
                    expires_in: 3600,
                    token_type: 'bearer',
                    user: fullUserData,
                  };
                  setSession(updatedSession);
                  // OPTIMIZATION 11: Persist updated session to localStorage
                  localStorage.setItem('auth_session', JSON.stringify(updatedSession));
                }
              } catch (error) {
                // Silently fail - user is already logged in with basic data
                // console.warn('Error loading user data:', error);
              }
            };
            
            // Load immediately in background (non-blocking)
            loadUserData();
          }
        } else {
          // User is signed out
          setFirebaseUser(null);
          setUser(null);
          setSession(null);
          setUserRole(null);
          // OPTIMIZATION 11: Clear session from localStorage
          localStorage.removeItem('auth_session');
          clearTimeouts();
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeouts();
    };
  }, [clearTimeouts]);

  // OPTIMIZATION 7: Memoized sign up function
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      // Validate inputs
      if (!email.trim()) {
        return { error: new Error('Email is required') };
      }

      if (!password || password.length < 6) {
        return { error: new Error('Password must be at least 6 characters') };
      }

      if (!fullName.trim()) {
        return { error: new Error('Full name is required') };
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: new Error('Please enter a valid email address') };
      }

      // OPTIMIZATION 8: Parallel execution for faster signup
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      try {
        // STEP 1: Create instructor profile with auto-generated instructor ID (MUST complete first)
        let instructorId: string | undefined;
        
        console.log('🔵 Starting instructor profile creation...');
        const instructorProfile = await createInstructorProfile(
          firebaseUser.uid,
          email,
          fullName
        );
        instructorId = instructorProfile.instructorId;
        console.log('✅ Instructor profile created with ID:', instructorId);

        // STEP 2: Update display name (parallel with user doc creation)
        const updateDisplayNamePromise = updateProfile(firebaseUser, {
          displayName: fullName,
        }).then(() => {
          console.log('✅ Display name updated');
        }).catch(error => {
          console.warn('⚠️ Could not update display name:', error?.message);
          // Non-critical error, don't fail signup
        });

        // STEP 3: Create user document in Firestore with instructorId (CRITICAL)
        console.log('🔵 Creating user document with instructorId:', instructorId);
        const createUserDocPromise = setDoc(doc(db, 'users', firebaseUser.uid), {
          email: email,
          fullName: fullName,
          role: 'instructor',
          ...(instructorId && { instructorId: instructorId }), // Only include if not undefined
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).then(() => {
          console.log('User document created in Firestore with instructorId:', instructorId);
        });

        // Wait for both to complete - if user doc creation fails, this will throw
        await Promise.all([updateDisplayNamePromise, createUserDocPromise]);

        // STEP 4: Send email verification
        try {
          await sendEmailVerification(firebaseUser, {
            url: window.location.origin + '/auth?verified=true',
            handleCodeInApp: false,
          });
          console.log('Verification email sent to:', email);
        } catch (emailError: any) {
          console.warn('⚠️ Could not send verification email:', emailError?.message);
          // Non-critical - account is created, user can resend later
        }

        // Sign out user immediately - they must verify email first
        await firebaseSignOut(auth);

        return { error: null, needsVerification: true };
        
      } catch (setupError: any) {
        // If user document creation fails, delete the Firebase Auth user
        console.error('✗ Failed to complete user setup, deleting auth user:', setupError);
        
        try {
          await firebaseUser.delete();
          console.log('✓ Auth user deleted successfully');
        } catch (deleteError) {
          console.error('✗ Could not delete auth user:', deleteError);
        }
        
        // Return error message about permissions
        if (setupError.code === 'permission-denied' || setupError.message?.includes('permission')) {
          return { 
            error: new Error('Database permission denied. Please contact the administrator to set up Firestore security rules.') 
          };
        }
        
        return { 
          error: new Error(setupError.message || 'Failed to complete account setup. Please try again.') 
        };
      }
      
    } catch (error: any) {
      console.error('Sign up error:', error);

      // Map Firebase error codes to user-friendly messages
      let userMessage = 'Failed to create account. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        userMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/invalid-email') {
        userMessage = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        userMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/operation-not-allowed') {
        userMessage = 'Account creation is currently disabled';
      } else if (error.message) {
        userMessage = error.message;
      }

      return { error: new Error(userMessage) };
    }
  }, []);

  // OPTIMIZATION 9: Memoized sign in function
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Validate inputs
      if (!email.trim()) {
        const error = new Error('Email is required');
        return { error };
      }

      if (!password) {
        const error = new Error('Password is required');
        return { error };
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const error = new Error('Please enter a valid email address');
        return { error };
      }

      // Clear any cached user data for this email
      // (Will be re-fetched on auth state change)
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Check if email is verified (skip check for existing users created before verification was added)
      // Only enforce verification for new accounts (created after this feature was deployed)
      if (!firebaseUser.emailVerified) {
        // Use Firebase user metadata.creationTime instead of Firestore read (instant!)
        const createdAt = new Date(firebaseUser.metadata.creationTime!);
        const verificationFeatureDate = new Date('2026-02-24T16:00:00'); // Date we added verification (afternoon)
        
        // Only require verification for accounts created AFTER we added this feature
        if (createdAt > verificationFeatureDate) {
          // Sign out immediately
          await firebaseSignOut(auth);
          return { 
            error: new Error('Please verify your email before signing in. Check your inbox (and spam folder) for the verification link.') 
          };
        }
        // Old accounts can sign in without verification (backwards compatibility)
      }

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);

      // Map Firebase error codes to user-friendly messages
      let userMessage = 'Failed to sign in. Please check your credentials.';

      if (error.code === 'auth/user-not-found') {
        userMessage = 'No account found with this email address. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        userMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        userMessage = 'Invalid email address';
      } else if (error.code === 'auth/invalid-credential') {
        userMessage = 'Invalid email or password. Please check and try again.';
      } else if (error.code === 'auth/user-disabled') {
        userMessage = 'This account has been disabled';
      } else if (error.code === 'auth/too-many-requests') {
        userMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        userMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/internal-error') {
        userMessage = 'Firebase authentication error. Please check your Firebase configuration.';
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        userMessage = 'Firebase authentication is not properly configured. Contact administrator.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return { error: new Error(userMessage) };
    }
  }, []);

  // Google Sign-In function
  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if user document already exists (optimized with single read)
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // New user - create profile in parallel
        const displayName = firebaseUser.displayName || 'Google User';
        const email = firebaseUser.email || '';

        try {
          // Create instructor profile and user document in parallel for speed
          const instructorProfilePromise = createInstructorProfile(
            firebaseUser.uid,
            email,
            displayName
          );

          // Wait for instructor profile to get ID
          const instructorProfile = await instructorProfilePromise;
          const instructorId = instructorProfile.instructorId;

          // Create user document with instructorId
          await setDoc(userDocRef, {
            email: email,
            fullName: displayName,
            role: 'instructor',
            instructorId: instructorId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            authProvider: 'google',
          });

          console.log('✅ Google user profile created:', instructorId);
        } catch (setupError: any) {
          console.error('❌ Failed to setup Google user:', setupError);
          // Clean up - delete auth user if setup fails
          await firebaseUser.delete();
          throw new Error('Failed to create user profile. Please try again.');
        }
      }

      return { error: null };
    } catch (error: any) {
      console.error('Google sign in error:', error);

      let userMessage = 'Failed to sign in with Google. Please try again.';

      if (error.code === 'auth/popup-closed-by-user') {
        userMessage = 'Sign-in cancelled. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        userMessage = 'Pop-up blocked by browser. Please allow pop-ups and try again.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        userMessage = 'Sign-in cancelled.';
      } else if (error.code === 'auth/network-request-failed') {
        userMessage = 'Network error. Please check your internet connection.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return { error: new Error(userMessage) };
    }
  }, []);

  // OPTIMIZATION 10: Memoized sign out
  const signOut = useCallback(async () => {
    try {
      // Clear local state immediately for responsive UI
      setUser(null);
      setSession(null);
      setUserRole(null);
      setFirebaseUser(null);
      
      // OPTIMIZATION 11: Clear session from localStorage
      localStorage.removeItem('auth_session');
      
      // Clear cache on sign out
      if (firebaseUser?.uid) {
        userCache.delete(firebaseUser.uid);
      }
      
      // Sign out from Firebase in background (non-blocking)
      firebaseSignOut(auth).catch((error) => {
        console.error('Sign out error:', error);
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [firebaseUser?.uid]);

  // Resend verification email
  const resendVerificationEmail = useCallback(async () => {
    try {
      if (!firebaseUser) {
        return { error: new Error('No user logged in') };
      }

      if (firebaseUser.emailVerified) {
        return { error: new Error('Email already verified') };
      }

      await sendEmailVerification(firebaseUser, {
        url: window.location.origin + '/auth?verified=true',
        handleCodeInApp: false,
      });

      return { error: null };
    } catch (error: any) {
      console.error('Resend verification error:', error);
      
      let userMessage = 'Failed to resend verification email';
      
      if (error.code === 'auth/too-many-requests') {
        userMessage = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (error.message) {
        userMessage = error.message;
      }

      return { error: new Error(userMessage) };
    }
  }, [firebaseUser]);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        loading, 
        userRole, 
        signUp, 
        signIn,
        signInWithGoogle,
        signOut,
        resendVerificationEmail,
        firebaseUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}