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
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    }
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FEF9E7' }}>
      <div className="w-full max-w-md">
        {/* Logo with design department styling and S box */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg" style={{ backgroundColor: '#166534' }}>
              <span className="text-2xl font-bold text-white">S</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#166534' }}>SIA</h1>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ 
          backgroundColor: '#FFFFFF', 
          borderColor: '#F0E6D2', 
          borderWidth: '1px',
          boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.15)'
        }}>
          {!showPasswordField ? (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Sign in</h2>
              <p className="text-sm mb-8" style={{ color: '#B38B00' }}>
                to continue to SIA
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
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#B38B00' }} />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 text-base rounded-xl pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                    style={{ 
                      borderColor: '#F0E6D2',
                      color: '#166534',
                      backgroundColor: '#FEF9E7'
                    }}
                    required
                    autoFocus
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!email} 
                  className="w-full h-14 px-4 py-2 text-white hover:opacity-90 rounded-xl font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ 
                    backgroundColor: '#166534',
                    boxShadow: '0 8px 16px -4px rgba(22, 101, 52, 0.3)'
                  }}
                >
                  Next
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="text-sm font-medium hover:underline transition-all"
                    style={{ color: '#B38B00' }}
                  >
                    Create an account
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPasswordField(false)}
                className="flex items-center gap-2 text-sm font-medium hover:underline mb-6 transition-all"
                style={{ color: '#B38B00' }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="mb-6">
                <p className="text-sm mb-1" style={{ color: '#B38B00' }}>{email}</p>
                <h2 className="text-2xl font-bold" style={{ color: '#166534' }}>Enter password</h2>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#B38B00' }} />
                  <Input
                    type={passwordVisible ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 text-base rounded-xl pl-12 pr-12 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                    style={{ 
                      borderColor: '#F0E6D2',
                      color: '#166534',
                      backgroundColor: '#FEF9E7'
                    }}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  >
                    {passwordVisible ? (
                      <Eye className="w-5 h-5" style={{ color: '#B38B00' }} />
                    ) : (
                      <EyeOff className="w-5 h-5" style={{ color: '#B38B00' }} />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-2"
                      style={{ 
                        accentColor: '#166534',
                        borderColor: '#F0E6D2'
                      }}
                    />
                    <span className="text-sm font-medium" style={{ color: '#166534' }}>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-sm font-medium hover:underline transition-all"
                    style={{ color: '#B38B00' }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-14 px-4 py-2 text-white hover:opacity-90 rounded-xl font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ 
                    backgroundColor: '#166534',
                    boxShadow: '0 8px 16px -4px rgba(22, 101, 52, 0.3)'
                  }}
                >
                  {loading ? (
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

        <div className="mt-8 text-center text-sm">
          <a href="#" className="hover:underline transition-all" style={{ color: '#B38B00' }}>Terms of use</a>
          <span style={{ color: '#B38B00' }}> · </span>
          <a href="#" className="hover:underline transition-all" style={{ color: '#B38B00' }}>Privacy policy</a>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={closeModal}
          />
          <div 
            className="relative w-full max-w-md rounded-2xl p-8"
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#F0E6D2', 
              borderWidth: '1px',
              boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.3)'
            }}
          >
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-[#F0E6D2] transition-colors"
            >
              <X className="w-5 h-5" style={{ color: '#166534' }} />
            </button>

            <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Reset password</h2>
            <p className="text-sm mb-6" style={{ color: '#B38B00' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-[#166534]/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8" style={{ color: '#166534' }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#166534' }}>Check your email</h3>
                <p className="text-sm mb-6" style={{ color: '#B38B00' }}>
                  We've sent a password reset link to <strong style={{ color: '#166534' }}>{resetEmail}</strong>
                </p>
<button
  onClick={closeModal}
  className="
    px-6 py-2 rounded-lg font-medium 
    border-2 transition-all duration-200
    hover:bg-[#E6F4EA] hover:text-[#166534]
  "
  style={{
    borderColor: "#166534",
    color: "#166534",
    backgroundColor: "transparent",
  }}
>
  Close
</button>


              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#B38B00' }} />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="h-14 text-base rounded-xl pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                    style={{ 
                      borderColor: '#F0E6D2',
                      color: '#166534',
                      backgroundColor: '#FEF9E7'
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 h-12 px-4 py-2 rounded-xl font-medium transition-all duration-200 border-2"
                    style={{ 
                      borderColor: '#F0E6D2',
                      color: '#166534',
                      backgroundColor: 'transparent'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail}
                    className="flex-1 h-12 px-4 py-2 text-white hover:opacity-90 rounded-xl font-medium transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50"
                    style={{ 
                      backgroundColor: '#166534',
                      boxShadow: '0 4px 8px -2px rgba(22, 101, 52, 0.2)'
                    }}
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
    </div>
  );
}