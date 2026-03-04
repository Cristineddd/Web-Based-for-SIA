'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, User, Mail, Lock, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface SignUpFormProps {
  onToggleMode: () => void;
}

export function SignUpForm({ onToggleMode }: SignUpFormProps) {
  const router = useRouter();
  const { signUp, signInWithGoogle, user, resendVerificationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Only redirect if signup was successful (not just if user exists)
    if (user && success) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setNeedsVerification(false);

    const result = await signUp(email, password, fullName);
    
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      setSuccess(false);
    } else if (result.needsVerification) {
      setNeedsVerification(true);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setError(null);
    
    const { error } = await resendVerificationEmail();
    
    if (error) {
      setError(error.message);
    } else {
      setError('Verification email sent! Check your inbox and spam folder.');
    }
    
    setResendLoading(false);
  };

  if (needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#ffffff' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8" style={{ 
            backgroundColor: '#FFFFFF', 
            borderColor: '#e5e7eb', 
            borderWidth: '1px',
            boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.15)'
          }}>
            <div className="w-16 h-16 rounded-full bg-[gray-600]/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8" className="text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: '#166534' }}>Verify Your Email</h2>
            <p className="text-center mb-6" className="text-gray-600">
              We've sent a verification link to <strong style={{ color: '#166534' }}>{email}</strong>
            </p>

            <div className="bg-[gray-600]/5 border-2 border-[gray-600]/20 rounded-lg p-4 mb-6">
              <p className="text-sm mb-2" style={{ color: '#166534' }}>
                <strong>📧 Check these places:</strong>
              </p>
              <ul className="text-sm space-y-1 ml-4" className="text-gray-600">
                <li>• Your <strong>Inbox</strong></li>
                <li>• Your <strong>Spam</strong> or <strong>Junk</strong> folder</li>
                <li>• Your <strong>Promotions</strong> tab (Gmail)</li>
                <li>• Your <strong>Updates</strong> tab (Gmail)</li>
              </ul>
            </div>

            {error && (
              <Alert className="mb-4" style={{ backgroundColor: 'gray-600}/10', borderColor: '#166534' }}>
                <AlertDescription style={{ color: '#166534' }}>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <p className="text-sm text-center" className="text-gray-600">
                Didn't receive the email?
              </p>
              <button
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="w-full h-12 px-4 py-2 rounded-xl font-medium border-2 transition-all duration-200 disabled:opacity-50"
                style={{ 
                  borderColor: '#166534',
                  color: '#166534',
                  backgroundColor: 'transparent'
                }}
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </button>
              
              <button
                onClick={onToggleMode}
                className="w-full h-12 px-4 py-2 text-white hover:opacity-90 rounded-xl font-medium transition-all duration-200"
                style={{ 
                  backgroundColor: '#166534',
                  boxShadow: '0 4px 8px -2px rgba(22, 101, 52, 0.2)'
                }}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#ffffff' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-12 text-center" style={{ 
            backgroundColor: '#FFFFFF', 
            borderColor: '#e5e7eb', 
            borderWidth: '1px',
            boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.15)'
          }}>
            <div className="w-16 h-16 rounded-full bg-[#166534]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" style={{ color: '#166534' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Account Created</h2>
            <p className="mb-6" className="text-gray-600">
              Welcome to SIA, <strong style={{ color: '#166534' }}>{fullName}</strong>!
            </p>
            <p className="text-sm flex items-center justify-center gap-2" className="text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#166534' }} />
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center">
          <Image src="/Sia.png" alt="SIA Logo" width={60} height={60} className="w-15 h-15 object-contain" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Create account</h2>
        <p className="text-sm mb-8 text-gray-600">
          to get started with SIA
        </p>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 sm:h-14 text-base rounded-lg pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0 border-gray-200 focus:border-[#166534]"
                required
                autoFocus
              />
            </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 sm:h-14 text-base rounded-lg pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0 border-gray-200 focus:border-[#166534]"
                required
              />
            </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="password"
              placeholder="Password (at least 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 sm:h-14 text-base rounded-lg pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0 border-gray-200 focus:border-[#166534]"
                required
                minLength={6}
              />
            </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full h-12 sm:h-14 px-4 py-2 bg-[#166534] hover:bg-[#1a7a3e] text-white rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center disabled:opacity-50"
          >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
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
            setLoading(true);
            setError(null);
            const { error } = await signInWithGoogle();
            if (error) {
              setError(error.message);
              setLoading(false);
            } else {
              setSuccess(true);
            }
          }}
          disabled={loading}
          className="w-full h-12 sm:h-14 px-4 py-2 bg-white border-2 border-gray-200 hover:bg-gray-50 rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center gap-3 disabled:opacity-50"
        >
            {loading ? (
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
            Already have an account? Sign in
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-600">
        <a href="#" className="hover:underline transition-all">Terms of use</a>
        <span> · </span>
        <a href="#" className="hover:underline transition-all">Privacy policy</a>
      </div>
    </div>
  );
}