'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClass, type Class } from '@/services/classService';
import { useAuth } from '@/contexts/AuthContext';

interface AddNewClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClassCreated: (newClass: Class) => void;
}

export function AddNewClassModal({ isOpen, onClose, onClassCreated }: AddNewClassModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [roomWarning, setRoomWarning] = useState(false);
  const [classNameWarning, setClassNameWarning] = useState(false);
  const [formData, setFormData] = useState({
    class_name: '',
    course_subject: '',
    year: '',
    room: '',
    semester: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.class_name.trim()) {
      toast({ title: 'Error', description: 'Class Name is required', variant: 'destructive' });
      return;
    }
    if (formData.class_name.trim().length < 4) {
      toast({ title: 'Error', description: 'Class Name must be at least 4 characters long', variant: 'destructive' });
      return;
    }
    if (!formData.course_subject.trim()) {
      toast({ title: 'Error', description: 'Course Subject is required', variant: 'destructive' });
      return;
    }
    if (formData.course_subject.trim().length < 5) {
      toast({ title: 'Error', description: 'Course Subject must be at least 5 characters long', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const newClass = await createClass(
        {
          class_name: formData.class_name.trim(),
          course_subject: formData.course_subject.trim(),
          year: formData.year.trim() || undefined,
          room: formData.room.trim(),
          semester: formData.semester.trim(),
          students: [],
          created_at: new Date().toISOString(),
        },
        user?.id || '',
        user?.instructorId
      );

      toast({ title: 'Success', description: `Class "${newClass.class_name}" created successfully` });

      setFormData({
        class_name: '',
        course_subject: '',
        year: '',
        room: '',
        semester: '',
      });

      onClassCreated(newClass);
      onClose();
    } catch (error) {
      console.error('Error creating class:', error);
      toast({ title: 'Error', description: 'Failed to create class. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isFormValid = formData.class_name.trim().length >= 4 && formData.course_subject.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add New Class</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details to create a new class</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Program / Class Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
              Program <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. BSIT, BSCS"
              value={formData.class_name}
              onChange={(e) => {
                const value = e.target.value;
                handleInputChange('class_name', value);
                if (value.trim().length > 0 && value.trim().length < 4) {
                  setClassNameWarning(true);
                  setTimeout(() => setClassNameWarning(false), 2000);
                } else {
                  setClassNameWarning(false);
                }
              }}
              disabled={loading}
              className={`text-sm bg-white border-gray-200 rounded-xl h-10 transition-all ${
                formData.class_name.trim().length >= 4
                  ? 'border-green-500 focus-visible:ring-green-500/20'
                  : formData.class_name.trim().length > 0
                  ? 'border-red-400 focus-visible:ring-red-400/20'
                  : ''
              }`}
            />
            {classNameWarning && (
              <p className="text-xs text-red-500">Class Name must be at least 4 characters</p>
            )}
          </div>

          {/* Course Subject */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
              Course Code <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. ITPKINEME123"
              value={formData.course_subject}
              onChange={(e) => handleInputChange('course_subject', e.target.value)}
              disabled={loading}
              className={`text-sm bg-white border-gray-200 rounded-xl h-10 transition-all ${
                formData.course_subject.trim().length >= 5
                  ? 'border-green-500 focus-visible:ring-green-500/20'
                  : formData.course_subject.trim().length > 0
                  ? 'border-red-400 focus-visible:ring-red-400/20'
                  : ''
              }`}
            />
          </div>

          {/* Year + Room side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Year Level
              </label>
              <Select
                value={formData.year}
                onValueChange={(value) => handleInputChange('year', value)}
                disabled={loading}
              >
                <SelectTrigger className={`w-full text-sm bg-white rounded-xl h-10 transition-all ${formData.year ? 'border-green-500 focus:ring-green-500/20' : 'border-gray-200'}`}>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1st Year</SelectItem>
                  <SelectItem value="2">2nd Year</SelectItem>
                  <SelectItem value="3">3rd Year</SelectItem>
                  <SelectItem value="4">4th Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Room <span className="text-gray-300 font-normal normal-case">(optional)</span>
              </label>
              <Input
                type="number"
                placeholder="e.g. 101"
                value={formData.room}
                onChange={(e) => {
                  const inputValue = e.target.value.replace(/[^0-9]/g, '');
                  if (inputValue.length > 3) {
                    setRoomWarning(true);
                    setTimeout(() => setRoomWarning(false), 3000);
                    return;
                  }
                  handleInputChange('room', inputValue.slice(0, 3));
                }}
                disabled={loading}
                className="text-sm bg-white border-gray-200 rounded-xl h-10"
              />
              {roomWarning && (
                <p className="text-xs text-red-500">Max 3 digits</p>
              )}
            </div>
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
              Semester <span className="text-gray-300 font-normal normal-case">(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. 1st Semester, 2nd Semester"
              value={formData.semester}
              onChange={(e) => handleInputChange('semester', e.target.value)}
              disabled={loading}
              className="text-sm bg-white border-gray-200 rounded-xl h-10"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Creating...</>
            ) : (
              <>Add Class</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
