'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type AppRole = 'instructor';

interface AppUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  user_metadata?: Record<string, unknown>;
  displayName?: string;
  role: AppRole;
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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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
          
          if (cachedUser) {
            // Use cached user data
            console.log('Using cached user data');
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
          if (!cachedUser) {
            const loadUserData = async () => {
              try {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                
                // Add timeout to prevent blocking on slow Firestore
                let userDoc;
                try {
                  userDoc = await Promise.race([
                    getDoc(userDocRef),
                    new Promise((_, reject) => {
                      setTimeout(() => reject(new Error('Firestore timeout')), 500);
                    })
                  ]) as any;
                } catch (timeoutError) {
                  // Timeout or error - user is already logged in with basic data, skip Firestore fetch
                  return;
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
        }
      } finally {
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

      // Run these in parallel
      await Promise.allSettled([
        // Update display name
        updateProfile(firebaseUser, {
          displayName: fullName,
        }).catch(error => {
          console.warn('Could not update display name:', error?.message);
        }),

        // Create user document in Firestore
        setDoc(doc(db, 'users', firebaseUser.uid), {
          email: email,
          fullName: fullName,
          role: 'instructor',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(error => {
          console.warn('Could not save user to Firestore:', error?.message);
        })
      ]);

      return { error: null };
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
      
      await signInWithEmailAndPassword(auth, email, password);
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

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        session, 
        loading, 
        userRole, 
        signUp, 
        signIn, 
        signOut,
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