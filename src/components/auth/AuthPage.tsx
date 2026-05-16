'use client';

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

export function AuthPage({ initialMode = 'login' }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  const toggleMode = () => setIsLogin(!isLogin);

  if (isLogin) {
    return <LoginForm onToggleMode={toggleMode} />;
  }

  return <SignUpForm onToggleMode={toggleMode} />;
}
