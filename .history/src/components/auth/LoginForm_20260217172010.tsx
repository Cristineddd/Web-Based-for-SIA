'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold text-foreground mb-2">SIA</h1>
        </div>

        {/* Login Box */}
        <div className="bg-white shadow-xl rounded-lg p-12 border">
          {!showPassword ? (
            <>
              <h2 className="text-2xl font-bold mb-2">Sign in</h2>
              <p className="text-sm text-muted-foreground mb-8">
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
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base border-b border-t-0 border-x-0 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={!email} className="w-full h-11 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-semibold transition-colors inline-flex items-center justify-center">
                  Next
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="text-sm text-primary hover:underline"
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
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">{email}</p>
                <h2 className="text-2xl font-bold">Enter password</h2>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-base border-b border-t-0 border-x-0 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading} className="w-full h-11 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-semibold transition-colors inline-flex items-center justify-center">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <a href="#" className="hover:underline">Terms of use</a>
          {' · '}
          <a href="#" className="hover:underline">Privacy policy</a>
        </div>
      </div>
    </div>
  );
}
