"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, User } from "lucide-react";

interface WelcomeNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  currentName?: string;
}

export function WelcomeNameModal({
  isOpen,
  onClose,
  onSubmit,
  currentName = "",
}: WelcomeNameModalProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (!/^[a-zA-Z\s\-'.]+$/.test(trimmedName)) {
      setError("Name can only contain letters, spaces, hyphens, and apostrophes");
      return;
    }

    onSubmit(trimmedName);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 px-6 py-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <button
              onClick={handleSkip}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to GC Smart Check!</h2>
          <p className="text-green-50 text-sm">
            What would you like us to call you?
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Your Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g., Prof. Juan Dela Cruz"
              className="h-12 text-base border-2 focus:border-green-500 focus:ring-green-500"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              This will be displayed on your dashboard and profile
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              className="flex-1 h-11 border-2 hover:bg-gray-50"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
            >
              Continue
            </Button>
          </div>
        </form>

        {/* Footer tip */}
        <div className="px-6 pb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> You can include your title (Prof., Dr., etc.) for a more professional greeting
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
