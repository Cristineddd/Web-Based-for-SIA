'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect to dashboard when user is authenticated
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
    // Don't redirect here - let useEffect handle it when user state updates
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8FAF5' }}>
      <div className="w-full max-w-md">
        {/* Logo with design department styling and S box */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-lg" style={{ backgroundColor: '#3E5F44' }}>
              <span className="text-2xl font-bold text-white">S</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#3E5F44' }}>SIA</h1>
          </div>
        </div>

        {/* Login Box with enhanced border and shadow */}
        <div className="rounded-2xl p-8" style={{ 
          backgroundColor: '#FFFFFF', 
          borderColor: '#E8EDE6', 
          borderWidth: '1px',
          boxShadow: '0 20px 40px -12px rgba(62, 95, 68, 0.15)'
        }}>
          {!showPassword ? (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#2C3E2F' }}>Sign in</h2>
              <p className="text-sm mb-8" style={{ color: '#6B7F70' }}>
                to continue to SIA
              </p>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                if (email) setShowPassword(true);
              }} className="space-y-6">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#9AAEA3' }} />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 text-base rounded-xl pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                    style={{ 
                      borderColor: '#E0E8E2',
                      color: '#2C3E2F',
                      backgroundColor: '#F8FAF5'
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
                    backgroundColor: '#3E5F44',
                    boxShadow: '0 8px 16px -4px rgba(62, 95, 68, 0.3)'
                  }}
                >
                  Next
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="text-sm font-medium hover:underline transition-all"
                    style={{ color: '#3E5F44' }}
                  >
                    Create an account
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPassword(false)}
                className="flex items-center gap-2 text-sm font-medium hover:underline mb-6 transition-all"
                style={{ color: '#6B7F70' }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="mb-6">
                <p className="text-sm mb-1" style={{ color: '#6B7F70' }}>{email}</p>
                <h2 className="text-2xl font-bold" style={{ color: '#2C3E2F' }}>Enter password</h2>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#9AAEA3' }} />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 text-base rounded-xl pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                    style={{ 
                      borderColor: '#E0E8E2',
                      color: '#2C3E2F',
                      backgroundColor: '#F8FAF5'
                    }}
                    required
                    autoFocus
                  />
                </div>

                {/* Remember Me and Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-2"
                      style={{ 
                        accentColor: '#3E5F44',
                        borderColor: '#D0D9D2'
                      }}
                    />
                    <span className="text-sm font-medium" style={{ color: '#2C3E2F' }}>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium hover:underline transition-all"
                    style={{ color: '#3E5F44' }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-14 px-4 py-2 text-white hover:opacity-90 rounded-xl font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ 
                    backgroundColor: '#3E5F44',
                    boxShadow: '0 8px 16px -4px rgba(62, 95, 68, 0.3)'
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
          <a href="#" className="hover:underline transition-all" style={{ color: '#6B7F70' }}>Terms of use</a>
          <span style={{ color: '#6B7F70' }}> · </span>
          <a href="#" className="hover:underline transition-all" style={{ color: '#6B7F70' }}>Privacy policy</a>
        </div>
      </div>
    </div>
  );
}