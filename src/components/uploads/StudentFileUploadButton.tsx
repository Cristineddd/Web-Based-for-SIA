/**
 * Student File Upload Button Component
 * Reusable button for importing student files (CSV/Excel)
 * Provides file validation, parsing, and preview
 */

'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, AlertTriangle, CheckCircle2, FileX, Download } from 'lucide-react';
import { toast } from 'sonner';
import { StudentFileUploadService, ParsedStudent } from '@/services/studentFileUploadService';

export interface StudentFileUploadButtonProps {
  onFileParsed?: (students: ParsedStudent[]) => void;
  onFileError?: (error: string) => void;
  onProgress?: (current: number, total: number) => void;
  showTemplate?: boolean;
  templateFormat?: 'csv' | 'xlsx';
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  disabled?: boolean;
  maxFiles?: number;
}

interface UploadState {
  isLoading: boolean;
  error: string | null;
  progress: number;
}

/**
 * Upload requirements info component
 */
export const UploadRequirements: React.FC = () => {
  return (
    <Alert className="bg-blue-50 border-blue-200">
      <AlertTriangle className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800 text-sm">
        <div className="font-semibold mb-2">File Requirements:</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Supported formats: .xlsx, .xls, .csv</li>
          <li>Maximum file size: 10 MB</li>
          <li>Required columns: first_name, last_name, year, section</li>
          <li>Optional columns: student_id, email</li>
          <li>Auto-generate student IDs if not provided</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
};

/**
 * File preview component showing parsed data
 */
export const FilePreview: React.FC<{
  students: ParsedStudent[];
  maxPreviewRows?: number;
}> = ({ students, maxPreviewRows = 5 }) => {
  const previewRows = students.slice(0, maxPreviewRows);
  const hiddenRows = Math.max(0, students.length - maxPreviewRows);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Preview ({students.length} records)</h4>
        <CheckCircle2 className="w-4 h-4 text-green-600" />
      </div>

      <div className="overflow-x-auto bg-gray-50 rounded-md border border-gray-200 p-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-2 font-semibold">#</th>
              <th className="text-left py-2 px-2 font-semibold">First Name</th>
              <th className="text-left py-2 px-2 font-semibold">Last Name</th>
              <th className="text-left py-2 px-2 font-semibold">Year</th>
              <th className="text-left py-2 px-2 font-semibold">Section</th>
              <th className="text-left py-2 px-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((student, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100">
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2">{student.first_name || '-'}</td>
                <td className="py-2 px-2">{student.last_name || '-'}</td>
                <td className="py-2 px-2">{student.year || '-'}</td>
                <td className="py-2 px-2">{student.section || '-'}</td>
                <td className="py-2 px-2 text-gray-500">{student.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenRows > 0 && (
        <p className="text-xs text-gray-500">
          ...and {hiddenRows} more record(s). Preview limited to {maxPreviewRows} rows.
        </p>
      )}
    </div>
  );
};

/**
 * Main upload button component
 */
export const StudentFileUploadButton: React.FC<StudentFileUploadButtonProps> = ({
  onFileParsed,
  onFileError,
  onProgress,
  showTemplate = true,
  templateFormat = 'xlsx',
  variant = 'outline',
  size = 'default',
  className,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isLoading: false,
    error: null,
    progress: 0,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const handleFileClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    event.target.value = '';

    // Reset error state
    setUploadState({ isLoading: true, error: null, progress: 0 });

    try {
      // Parse file
      const result = await StudentFileUploadService.parseFile(file);

      if (!result.success) {
        const errorMsg = result.error || 'Failed to parse file';
        setUploadState({ isLoading: false, error: errorMsg, progress: 0 });
        onFileError?.(errorMsg);
        toast.error(errorMsg);
        return;
      }

      if (result.rowCount === 0) {
        const errorMsg = 'No student records found in file';
        setUploadState({ isLoading: false, error: errorMsg, progress: 0 });
        onFileError?.(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Success
      setParsedStudents(result.students);
      setSelectedFileName(file.name);
      setShowPreview(true);
      setUploadState({ isLoading: false, error: null, progress: 100 });
      onProgress?.(result.rowCount, result.rowCount);
      onFileParsed?.(result.students);
      toast.success(`Successfully parsed ${result.rowCount} student records from ${file.name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setUploadState({ isLoading: false, error: errorMsg, progress: 0 });
      onFileError?.(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDownloadTemplate = (): void => {
    try {
      StudentFileUploadService.downloadTemplate(templateFormat);
      toast.success(`Downloaded student template (${templateFormat.toUpperCase()})`);
    } catch (error) {
      console.error('Failed to download template:', error);
      toast.error('Failed to download template');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleFileClick}
          variant={variant}
          size={size}
          disabled={disabled || uploadState.isLoading}
          className={className}
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploadState.isLoading ? 'Processing...' : 'Import Student File'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploadState.isLoading}
          aria-label="Upload student file"
        />

        {uploadState.isLoading && <Progress value={uploadState.progress} className="h-2" />}

        {uploadState.error && (
          <Alert className="border-red-300 bg-red-50">
            <FileX className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              <strong>Upload Error:</strong> {uploadState.error}
            </AlertDescription>
          </Alert>
        )}

        {showTemplate && (
          <div className="pt-2 border-t border-gray-200">
            <Button
              onClick={handleDownloadTemplate}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download {templateFormat.toUpperCase()} Template
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
            <DialogDescription>
              Imported from: {selectedFileName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <UploadRequirements />
            <FilePreview students={parsedStudents} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentFileUploadButton;
