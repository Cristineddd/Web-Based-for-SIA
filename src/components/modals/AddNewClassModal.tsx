'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
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
        user?.id || ''
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Add New Class</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Class Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Class Name *
            </label>
            <Input
              type="text"
              placeholder="Enter class name"
              value={formData.class_name}
              onChange={(e) => handleInputChange('class_name', e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Course Subject */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Course Subject *
            </label>
            <Input
              type="text"
              placeholder="Enter course subject"
              value={formData.course_subject}
              onChange={(e) => handleInputChange('course_subject', e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Section/Block */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Section / Block *
            </label>
            <Input
              type="text"
              placeholder="Enter section or block"
              value={formData.section_block}
              onChange={(e) => handleInputChange('section_block', e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Room */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Room (Optional)
            </label>
            <Input
              type="text"
              placeholder="Enter room number or location"
              value={formData.room}
              onChange={(e) => handleInputChange('room', e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* Note */}
          <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
            Fields marked with * are required
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Class'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
