"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useWelcomeModal() {
  const { user } = useAuth();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    // Check if user needs name setup
    if (user && (user as any).needsNameSetup) {
      setShowWelcomeModal(true);
    }
  }, [user]);

  const handleNameSubmit = async (name: string) => {
    if (!user) return;

    try {
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name,
        });
      }

      // Update Firestore user document
      const userDocRef = doc(db, "users", user.id);
      await updateDoc(userDocRef, {
        fullName: name,
        displayName: name,
        needsNameSetup: false,
      });

      // Also update instructor profile if exists
      if (user.instructorId) {
        const instructorDocRef = doc(db, "instructors", user.instructorId);
        await updateDoc(instructorDocRef, {
          fullName: name,
        });
      }

      setShowWelcomeModal(false);
      
      // Reload to update the UI with new name
      window.location.reload();
    } catch (error) {
      console.error("Error updating name:", error);
    }
  };

  const handleClose = () => {
    setShowWelcomeModal(false);
    
    // Mark as setup complete even if skipped
    if (user) {
      const userDocRef = doc(db, "users", user.id);
      updateDoc(userDocRef, {
        needsNameSetup: false,
      }).catch(console.error);
    }
  };

  return {
    showWelcomeModal,
    handleNameSubmit,
    handleClose,
  };
}
