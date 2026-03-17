import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** Where to navigate back to. If not provided, uses router.back() */
  href?: string;
  /** Text to display alongside the arrow. If not provided, shows icon only */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to use Link component instead of Button (for better SEO/navigation) */
  asLink?: boolean;
  /** Button variant when using Button component */
  variant?: 'ghost' | 'outline' | 'default';
  /** Button size when using Button component */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BackButton({ 
  href, 
  children, 
  className = '', 
  asLink = false,
  variant = 'ghost',
  size = children ? 'default' : 'icon'
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  const content = (
    <>
      <ArrowLeft className="w-4 h-4" />
      {children}
    </>
  );

  if (asLink && href) {
    return (
      <Link 
        href={href} 
        className={`inline-flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`gap-2 ${className}`}
    >
      {content}
    </Button>
  );
}