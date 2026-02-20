/**
 * useFileUpload Hook
 * Handles file uploads with automatic audit logging
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UploadOptions {
  onSuccess?: (filePath: string) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export function useFileUpload() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, options?: UploadOptions): Promise<string | null> => {
      if (!user) {
        const err = new Error('You must be logged in to upload files');
        options?.onError?.(err);
        setError(err.message);
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'x-admin-id': user.id,
            'x-admin-email': user.email,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          const err = new Error(errorData.error || 'Upload failed');
          options?.onError?.(err);
          setError(err.message);
          return null;
        }

        const data = await response.json();
        
        if (data.success && data.filePath) {
          options?.onSuccess?.(data.filePath);
          return data.filePath;
        } else {
          const err = new Error(data.error || 'Upload failed');
          options?.onError?.(err);
          setError(err.message);
          return null;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        options?.onError?.(error);
        setError(error.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  return {
    uploadFile,
    isLoading,
    error,
  };
}
