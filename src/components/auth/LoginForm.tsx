'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Mail, Lock, Eye, EyeOff, X } from 'lucide-react';

interface LoginFormProps {
  onToggleMode: () => void;
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const router = useRouter();
  const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    // Redirect when user is logged in and auth is not loading
    if (user && !authLoading) {
      console.log('[REDIRECT] Redirecting to dashboard...', { user: user.email, authLoading });
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
      setFormLoading(false);
    }
    // Success - onAuthStateChanged will update user state and trigger redirect
    // FormLoading will stay true until redirect happens
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError(null);
    
    // Simulate password reset email send
    setTimeout(() => {
      setResetSuccess(true);
      setResetLoading(false);
    }, 1500);
  };

  const closeModal = () => {
    setShowForgotModal(false);
    setResetEmail('');
    setResetSuccess(false);
    setError(null);
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  return (
    <>
      <div className="w-full">
        <div>
          {!showPasswordField ? (
            <>
              <h2 className="text-2xl font-bold mb-2 text-gray-900">Sign in</h2>
              <p className="text-sm mb-8 text-gray-600">
                to continue to GC Scan
              </p>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                if (email) setShowPasswordField(true);
              }} className="space-y-6">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 sm:h-14 text-base rounded-lg pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0 border-gray-200 focus:border-green-400 focus-visible:ring-green-100"
                    required
                    autoFocus
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!email} 
                  className="w-full h-12 sm:h-14 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50"
                >
                  Next
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm font-medium text-gray-600">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                onClick={async () => {
                  setFormLoading(true);
                  setError(null);
                  const { error } = await signInWithGoogle();
                  if (error) {
                    setError(error.message);
                    setFormLoading(false);
                  }
                }}
                disabled={formLoading}
                className="w-full h-14 px-4 py-2 bg-white border-2 border-gray-200 hover:bg-gray-50 text-green-600 rounded-xl font-semibold transition-all duration-200 inline-flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {formLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={onToggleMode}
                  className="text-sm font-medium hover:underline transition-all text-gray-600"
                >
                  Create an account
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPasswordField(false)}
                className="flex items-center gap-2 text-sm font-medium hover:underline mb-6 transition-all text-gray-600"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="mb-6">
                <p className="text-sm mb-1 text-gray-600">{email}</p>
                <h2 className="text-2xl font-bold text-gray-900">Enter password</h2>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 sm:h-14 text-base rounded-lg pl-12 pr-12 border-2 focus-visible:ring-2 focus-visible:ring-offset-0 border-gray-200 focus:border-green-400 focus-visible:ring-green-100"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  >
                    {passwordVisible ? (
                      <Eye className="w-5 h-5 text-gray-400" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-2 accent-green-600"
                    />
                    <span className="text-sm font-medium text-green-600">Remember me</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(true)}
                    className="text-sm font-medium hover:underline transition-all text-gray-600"
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={formLoading} 
                  className="w-full h-14 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          <a href="#" className="hover:underline transition-all">Terms of use</a>
          <span> - </span>
          <a href="#" className="hover:underline transition-all">Privacy policy</a>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/10 backdrop-blur-sm" 
          onClick={closeModal}
        />
        <div 
          className="relative w-full max-w-md rounded-2xl p-8 bg-white border border-green-200 shadow-lg"
          style={{ boxShadow: '0 20px 40px -12px rgba(22, 163, 74, 0.15)' }}
        >
          <button
            onClick={closeModal}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-green-600" />
          </button>

          <h2 className="text-2xl font-bold mb-2 text-green-600">Reset password</h2>
          <p className="text-sm mb-6 text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {resetSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-600/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-green-600">Check your email</h3>
              <p className="text-sm mb-6 text-gray-600">
                We've sent a password reset link to <strong className="text-green-600">{resetEmail}</strong>
              </p>
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg font-medium border-2 border-green-600 text-green-600 bg-transparent hover:bg-green-600 hover:text-white transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-14 text-base rounded-xl pl-12 pr-4 border-2 border-gray-200 focus:border-green-400 focus-visible:ring-green-100 focus-visible:ring-2 focus-visible:ring-offset-0"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 h-12 px-4 py-2 rounded-xl font-medium border-2 border-gray-200 text-gray-600 bg-transparent hover:bg-gray-100 hover:border-green-600 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-95"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resetLoading || !resetEmail}
                  className="flex-1 h-12 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
}