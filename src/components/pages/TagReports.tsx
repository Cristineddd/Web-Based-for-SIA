'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Tag, FileText, AlertCircle } from 'lucide-react';
import { getExamById, Exam } from '@/services/examService';
import { toast } from 'sonner';

interface TagReportsProps {
  params: { id: string };
}

interface TagItem {
  id: string;
  name: string;
  color: string;
  questions: number[];
  createdAt: string;
}

export default function TagReportsPage({ params }: TagReportsProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState('bg-blue-500');
  const examId = params.id;

  const colors = [
    'bg-blue-500',
    'bg-red-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  useEffect(() => {
    const fetchTagData = async () => {
      try {
        const examData = await getExamById(params.id);
        if (!examData) {
          toast.error('Exam not found');
          return;
        }
        setExam(examData);

        // Load tags from localStorage (since we don't have a backend service yet)
        const savedTags = localStorage.getItem(`exam_tags_${examId}`);
        if (savedTags) {
          setTags(JSON.parse(savedTags));
        }
      } catch (error) {
        console.error('Error fetching exam data:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    };

    fetchTagData();
  }, [examId, params]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    const newTag: TagItem = {
      id: `tag_${Date.now()}`,
      name: newTagName,
      color: selectedColor,
      questions: [],
      createdAt: new Date().toISOString()
    };

    const updatedTags = [...tags, newTag];
    setTags(updatedTags);
    localStorage.setItem(`exam_tags_${examId}`, JSON.stringify(updatedTags));
    setNewTagName('');
    setSelectedColor('bg-blue-500');
    setShowNewTagForm(false);
    toast.success('Tag created successfully');
  };

  const handleDeleteTag = (tagId: string) => {
    const updatedTags = tags.filter(t => t.id !== tagId);
    setTags(updatedTags);
    localStorage.setItem(`exam_tags_${examId}`, JSON.stringify(updatedTags));
    toast.success('Tag deleted');
  };

  const getTagReport = (tag: TagItem) => {
    if (tag.questions.length === 0) {
      return 'No questions tagged yet';
    }
    return `${tag.questions.length} question${tag.questions.length !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading tag reports...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="p-2 hover:bg-muted rounded-md transition-colors inline-block">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href={`/exams/${params.id}`}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Tag className="w-6 h-6 flex-shrink-0" />
              Tag Reports
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Exam: {exam.title}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewTagForm(!showNewTagForm)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Tag
        </button>
      </div>

      {/* New Tag Form */}
      {showNewTagForm && (
        <Card className="p-4 sm:p-6 border">
          <h2 className="font-bold text-foreground mb-4">Create New Tag</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">Tag Name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., Chapter 1, Difficult Questions, Review"
                className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">Color</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-lg ${color} transition-all ${
                      selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateTag}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              >
                Create Tag
              </button>
              <button
                onClick={() => setShowNewTagForm(false)}
                className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Tags Grid */}
      {tags.length === 0 ? (
        <Card className="p-8 border text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No tags created yet.</p>
          <button
            onClick={() => setShowNewTagForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Tag
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map(tag => (
            <Card key={tag.id} className="p-4 sm:p-6 border hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-6 h-6 rounded-lg ${tag.color} flex-shrink-0`} />
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this tag?')) {
                      handleDeleteTag(tag.id);
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 hover:bg-muted rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-foreground mb-1">{tag.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{getTagReport(tag)}</p>
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm font-semibold hover:bg-muted transition-colors">
                <FileText className="w-4 h-4" />
                View Report
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Information Card */}
      <Card className="p-4 sm:p-6 border bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          How to Use Tags
        </h3>
        <ul className="text-sm text-foreground space-y-2 ml-7">
          <li>• Create tags to organize questions by topic, difficulty, or type</li>
          <li>• Each tag can contain multiple questions from this exam</li>
          <li>• Use different colors to visually distinguish between tags</li>
          <li>• View detailed reports for each tag to analyze question patterns</li>
          <li>• Tags help identify areas where students struggle</li>
        </ul>
      </Card>
    </div>
  );
}
