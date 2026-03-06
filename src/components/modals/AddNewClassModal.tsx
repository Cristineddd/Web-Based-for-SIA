'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
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
  const [courseSubjectWarning, setCourseSubjectWarning] = useState(false);
  const [formData, setFormData] = useState({
    class_name: '',
    course_subject: '',
    section_block: '',
    room: '',
    semester: '',
    school_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.class_name.trim()) {
      toast({
        title: 'Error',
        description: 'Class Name is required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.class_name.trim().length < 5) {
      toast({
        title: 'Error',
        description: 'Class Name must be at least 5 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.course_subject.trim()) {
      toast({
        title: 'Error',
        description: 'Course Subject is required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.course_subject.trim().length < 5) {
      toast({
        title: 'Error',
        description: 'Course Subject must be at least 5 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.section_block.trim()) {
      toast({
        title: 'Error',
        description: 'Section/Block is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const newClass = await createClass(
        {
          class_name: formData.class_name.trim(),
          course_subject: formData.course_subject.trim(),
          section_block: formData.section_block.trim(),
          room: formData.room.trim(),
          semester: formData.semester.trim(),
          school_year: formData.school_year.trim(),
          students: [],
          created_at: new Date().toISOString(),
        },
        user?.id || '',
        user?.instructorId // Pass instructorId
      );

      toast({
        title: 'Success',
        description: `Class "${newClass.class_name}" created successfully`,
      });

      // Reset form and call callback
      setFormData({
        class_name: '',
        course_subject: '',
        section_block: '',
        room: '',
        semester: '',
        school_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      });

      onClassCreated(newClass);
      onClose();
    } catch (error) {
      console.error('Error creating class:', error);
      toast({
        title: 'Error',
        description: 'Failed to create class. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto border border-green-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-900">Add New Class</h2>
              <p className="text-sm text-green-700">Create a new class for your students</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-800 hover:bg-green-100 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          {/* Class Name */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              Program 
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter class name"
                value={formData.class_name}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange('class_name', value);
                  
                  // Show warning if length exceeds 0 but is less than 5
                  if (value.trim().length > 0 && value.trim().length < 5) {
                    setClassNameWarning(true);
                    setTimeout(() => setClassNameWarning(false), 2000);
                  } else {
                    setClassNameWarning(false);
                  }
                }}
                disabled={loading}
                className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                  formData.class_name.trim() && formData.class_name.trim().length >= 5
                    ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                    : formData.class_name.trim() && formData.class_name.trim().length < 5
                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 bg-red-50/30'
                    : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                }`}
              />
              {formData.class_name.trim() && formData.class_name.trim().length >= 5 && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.class_name.trim() && formData.class_name.trim().length >= 5 && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Valid class name</span>
              </div>
            )}
            {classNameWarning && (
              <div className="flex items-center gap-2 text-xs text-red-600 animate-fade-in">
                <span className="text-red-500">⚠</span>
                <span>Class Name must be at least 5 characters long</span>
              </div>
            )}
          </div>

          {/* Course Subject */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              Course 
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter course subject"
                value={formData.course_subject}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange('course_subject', value);
                  
                  // Show warning if length exceeds 0 but is less than 5
                  if (value.trim().length > 0 && value.trim().length < 5) {
                    setCourseSubjectWarning(true);
                    setTimeout(() => setCourseSubjectWarning(false), 2000);
                  } else {
                    setCourseSubjectWarning(false);
                  }
                }}
                disabled={loading}
                className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                  formData.course_subject.trim() && formData.course_subject.trim().length >= 5
                    ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                    : formData.course_subject.trim() && formData.course_subject.trim().length < 5
                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 bg-red-50/30'
                    : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                }`}
              />
              {formData.course_subject.trim() && formData.course_subject.trim().length >= 5 && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.course_subject.trim() && formData.course_subject.trim().length >= 5 && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Valid course subject</span>
              </div>
            )}
            {courseSubjectWarning && (
              <div className="flex items-center gap-2 text-xs text-red-600 animate-fade-in">
                <span className="text-red-500">⚠</span>
                <span>Course Subject must be at least 5 characters long</span>
              </div>
            )}
          </div>

          {/* Section/Block */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              Section / Block 
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter section or block"
                value={formData.section_block}
                onChange={(e) => handleInputChange('section_block', e.target.value)}
                disabled={loading}
                className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                  formData.section_block.trim() 
                    ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                    : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                }`}
              />
              {formData.section_block.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.section_block.trim() && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Valid section/block</span>
              </div>
            )}
          </div>

          {/* Room */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Room 
              <span className="text-gray-400 text-xs font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="Enter room number (exactly 3 digits)"
                value={formData.room}
                onChange={(e) => {
                  // Only allow exactly 3 numbers
                  const inputValue = e.target.value.replace(/[^0-9]/g, '');
                  if (inputValue.length > 3) {
                    setRoomWarning(true);
                    setTimeout(() => setRoomWarning(false), 3000);
                    return;
                  }
                  const value = inputValue.slice(0, 3);
                  handleInputChange('room', value);
                }}
                disabled={loading}
                className="w-full transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
              />
              {formData.room.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">&#x2713;</span>
                  </div>
                </div>
              )}
            </div>
            {formData.room.trim() && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Room specified</span>
              </div>
            )}
            {roomWarning && (
              <div className="flex items-center gap-2 text-xs text-red-600 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Room number must be exactly 3 digits only</span>
              </div>
            )}
          </div>

          {/* Semester */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Semester
              <span className="text-gray-400 text-xs font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter semester (e.g., 1st Semester, 2nd Semester)"
                value={formData.semester}
                onChange={(e) => handleInputChange('semester', e.target.value)}
                disabled={loading}
                className="w-full transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
              />
            </div>
          </div>

          {/* School Year */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              School Year
              <span className="text-gray-400 text-xs font-normal">(Auto-populated)</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="School year (e.g., 2023-2024)"
                value={formData.school_year}
                onChange={(e) => handleInputChange('school_year', e.target.value)}
                disabled={loading}
                className="w-full transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Auto-generated for current academic year</span>
            </div>
          </div>

          {/* Form Progress */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-lg font-bold">✓</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 mb-2">Form Progress</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Required fields completed:</span>
                    <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full transition-all ${
                      formData.class_name.trim().length >= 5 && formData.course_subject.trim().length >= 5 && formData.section_block.trim()
                        ? 'bg-green-500 scale-110'
                        : 'bg-gray-300'
                    }`} />
                    <span className={`text-sm font-medium ${
                      formData.class_name.trim().length >= 5 && formData.course_subject.trim().length >= 5 && formData.section_block.trim()
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}>
                      {formData.class_name.trim().length >= 5 && formData.course_subject.trim().length >= 5 && formData.section_block.trim()
                        ? 'Complete'
                        : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${[
                          formData.class_name.trim().length >= 5,
                          formData.course_subject.trim().length >= 5, 
                          formData.section_block.trim()
                        ].filter(Boolean).length * 33.33}%` 
                      }}
                    />
                  </div>
                  <p className="text-xs text-green-600">
                    Fields marked with <span className="text-red-500 font-semibold">*</span> are required
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="min-w-[100px] border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.class_name.trim() || !formData.course_subject.trim() || !formData.section_block.trim()}
              className={`min-w-[140px] transition-all duration-200 ${
                loading || !formData.class_name.trim() || !formData.course_subject.trim() || !formData.section_block.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105'
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Class
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
