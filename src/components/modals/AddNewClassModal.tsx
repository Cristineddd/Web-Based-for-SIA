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
  const [formData, setFormData] = useState({
    class_name: '',
    course_subject: '',
    section_block: '',
    room: '',
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

    if (!formData.course_subject.trim()) {
      toast({
        title: 'Error',
        description: 'Course Subject is required',
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
              Class Name 
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter class name"
                value={formData.class_name}
                onChange={(e) => handleInputChange('class_name', e.target.value)}
                disabled={loading}
                className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                  formData.class_name.trim() 
                    ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                    : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                }`}
              />
              {formData.class_name.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.class_name.trim() && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Valid class name</span>
              </div>
            )}
          </div>

          {/* Course Subject */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              Course Subject 
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter course subject"
                value={formData.course_subject}
                onChange={(e) => handleInputChange('course_subject', e.target.value)}
                disabled={loading}
                className={`w-full transition-all duration-200 border-2 rounded-lg px-4 py-3 ${
                  formData.course_subject.trim() 
                    ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100 bg-green-50/30' 
                    : 'border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100'
                }`}
              />
              {formData.course_subject.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.course_subject.trim() && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Valid course subject</span>
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
                type="text"
                placeholder="Enter room number or location"
                value={formData.room}
                onChange={(e) => handleInputChange('room', e.target.value)}
                disabled={loading}
                className="w-full transition-all duration-200 border-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 rounded-lg px-4 py-3"
              />
              {formData.room.trim() && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </div>
              )}
            </div>
            {formData.room.trim() && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span>Room specified</span>
              </div>
            )}
          </div>

          {/* Form Progress */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-lg font-bold">📋</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-green-900 mb-2">Form Progress</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Required fields completed:</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full transition-all ${
                        formData.class_name.trim() && formData.course_subject.trim() && formData.section_block.trim()
                          ? 'bg-green-500 scale-110'
                          : 'bg-gray-300'
                      }`} />
                      <span className={`text-sm font-medium ${
                        formData.class_name.trim() && formData.course_subject.trim() && formData.section_block.trim()
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                        {formData.class_name.trim() && formData.course_subject.trim() && formData.section_block.trim()
                          ? 'Complete ✓'
                          : 'Incomplete'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${[
                          formData.class_name.trim(),
                          formData.course_subject.trim(), 
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
