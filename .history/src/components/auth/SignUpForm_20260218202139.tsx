'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, User, Mail, Lock } from 'lucide-react';

interface SignUpFormProps {
  onToggleMode: () => void;
}

export function SignUpForm({ onToggleMode }: SignUpFormProps) {
  const router = useRouter();
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
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

    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FEF9E7' }}>
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-12 text-center" style={{ 
            backgroundColor: '#FFFFFF', 
            borderColor: '#F0E6D2', 
            borderWidth: '1px',
            boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.15)'
          }}>
            <div className="w-16 h-16 rounded-full bg-[#166534]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" style={{ color: '#166534' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Account Created</h2>
            <p className="mb-6" style={{ color: '#B38B00' }}>
              Welcome to SIA, <strong style={{ color: '#166534' }}>{fullName}</strong>!
            </p>
            <p className="text-sm flex items-center justify-center gap-2" style={{ color: '#B38B00' }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#166534' }} />
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FEF9E7' }}>
      <div className="w-full max-w-md">
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Create account</h2>
          <p className="text-sm mb-8" style={{ color: '#B38B00' }}>
            to get started with SIA
          </p>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#B38B00' }} />
              <Input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#B38B00' }} />
              <Input
                type="password"
                placeholder="Password (at least 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 text-base rounded-xl pl-12 pr-4 border-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                style={{ 
                  borderColor: '#F0E6D2',
                  color: '#166534',
                  backgroundColor: '#FEF9E7'
                }}
                required
                minLength={6}
              />
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
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={onToggleMode}
                className="text-sm font-medium hover:underline transition-all"
                style={{ color: '#B38B00' }}
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-sm">
          <a href="#" className="hover:underline transition-all" style={{ color: '#B38B00' }}>Terms of use</a>
          <span style={{ color: '#B38B00' }}> · </span>
          <a href="#" className="hover:underline transition-all" style={{ color: '#B38B00' }}>Privacy policy</a>
        </div>
      </div>
    </div>
  );
}