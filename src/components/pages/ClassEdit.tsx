'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Users, BookOpen, Hash, Download, Upload, Plus, X, Search, ArrowUpDown } from 'lucide-react';
import { getClassById, updateClass, Class, Student as BaseStudent } from '@/services/classService';
import { toast } from 'sonner';
import { BackButton } from '@/components/ui/BackButton';
import { exportStudentRosterToExcel } from '@/services/excelExportService';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Extended Student interface for editing with additional fields
interface Student extends BaseStudent {
  section?: string;
  grade?: string;
}

interface ClassEditProps {
  classId?: string;
}

export default function ClassEdit({ classId: propClassId }: ClassEditProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use prop classId if provided, otherwise fall back to search params
  const classId = propClassId || searchParams.get('id');
  
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    email: '',
  });
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [sortBy, setSortBy] = useState<'student_id' | 'first_name' | 'last_name' | 'email'>('student_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!classId) {
      router.push('/classes');
      return;
    }

    const fetchClassData = async () => {
      try {
        const data = await getClassById(classId);
        setClassData(data);
      } catch (error) {
        console.error('Error fetching class:', error);
        toast.error('Failed to load class data');
        router.push('/classes');
      } finally {
        setLoading(false);
      }
    };

    fetchClassData();
  }, [classId, router]);

  const handleSave = async () => {
    if (!classData) return;

    // Validation rules (same as class creation)
    // Validate Class Name
    if (!classData.class_name.trim()) {
      toast.error('Program name is required');
      return;
    }
    if (classData.class_name.trim().length < 3) {
      toast.error('Program name must be at least 3 characters long');
      return;
    }
    if (!/^[a-zA-ZñÑ\s]+$/.test(classData.class_name.trim())) {
      toast.error('Program name can only contain letters and spaces');
      return;
    }

    // Validate Course Subject
    if (!classData.course_subject.trim()) {
      toast.error('Course subject is required');
      return;
    }
    if (classData.course_subject.trim().length < 4) {
      toast.error('Course subject must be at least 4 characters long');
      return;
    }
    if (!/^[a-zA-ZñÑ\s]+$/.test(classData.course_subject.trim())) {
      toast.error('Course subject can only contain letters and spaces');
      return;
    }

    // Validate Year (optional)
    if (classData.year && !/^[1-4]$/.test(classData.year.trim())) {
      toast.error('Year must be between 1-4');
      return;
    }

    // Validate Room
    if (!classData.room.trim()) {
      toast.error('Room is required');
      return;
    }
    if (!/^[0-9]{3}$/.test(classData.room.trim())) {
      toast.error('Room must be exactly 3 digits (e.g., 101, 205, 312)');
      return;
    }

    // Validate students
    for (let i = 0; i < classData.students.length; i++) {
      const student = classData.students[i];
      
      // Student ID validation
      if (!student.student_id || !/^\d{9}$/.test(student.student_id) || !student.student_id.startsWith('20')) {
        toast.error(`Student ${i + 1}: Invalid Student ID. Must be 9 digits starting with '20'`);
        return;
      }

      // First name validation
      if (!student.first_name || !/^[a-zA-ZñÑ\s]+$/.test(student.first_name) || student.first_name.length < 4) {
        toast.error(`Student ${i + 1}: First name must be at least 4 characters and contain only letters`);
        return;
      }

      // Last name validation
      if (!student.last_name || !/^[a-zA-ZñÑ\s]+$/.test(student.last_name) || student.last_name.length < 4) {
        toast.error(`Student ${i + 1}: Last name must be at least 4 characters and contain only letters`);
        return;
      }

      // Email validation (optional but must be valid if provided)
      if (student.email && student.email.trim()) {
        const email = student.email.trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
          toast.error(`Student ${i + 1}: Invalid email format`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await updateClass(classData.id, {
        class_name: classData.class_name.trim(),
        course_subject: classData.course_subject.trim(),
        year: classData.year?.trim() || undefined,
        room: classData.room.trim(),
        students: classData.students,
        updatedAt: new Date().toISOString(),
      });
      
      toast.success('Class updated successfully');
      
      // Navigate back to classes page after successful save
      setTimeout(() => {
        router.push('/classes');
      }, 1500); // Small delay to let user see the success message
    } catch (error) {
      console.error('Error updating class:', error);
      toast.error('Failed to update class');
    } finally {
      setSaving(false);
    }
  };

  const handleExportStudents = () => {
    if (!classData || classData.students.length === 0) {
      toast.error('No students to export');
      return;
    }

    try {
      const studentsForExport = classData.students.map(student => ({
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || '',
        grade: student.grade || '',
      }));

      exportStudentRosterToExcel(studentsForExport);
      toast.success(`Exported ${studentsForExport.length} students to Excel`);
    } catch (error) {
      console.error('Error exporting students:', error);
      toast.error('Failed to export students');
    }
  };

  const handleImportStudents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input early so re-selecting the same file triggers onChange
    event.target.value = '';

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    if (!classData) {
      toast.error('Class data not loaded yet. Please wait and try again.');
      return;
    }

    const normalizeHeader = (h: unknown) =>
      String(h ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[()]/g, '')
        .replace(/[^a-z0-9 ]/g, '');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) {
          toast.error('Failed to read file');
          return;
        }

        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Parse as array-of-arrays to avoid header quirks
        const aoa = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        }) as unknown[][];

        if (aoa.length < 2) {
          toast.error('No student rows detected. Please check the template format.');
          return;
        }

        const headerRow = (aoa[0] || []).map(normalizeHeader);

        const aliasesStudentId = new Set(['student id', 'studentid', 'id']);
        const aliasesFirst = new Set(['first name', 'firstname', 'first']);
        const aliasesLast = new Set(['last name', 'lastname', 'last']);
        const aliasesEmail = new Set(['email', 'email optional', 'email optional ', 'e mail', 'e mail optional']);

        const findCol = (aliases: Set<string>) => headerRow.findIndex((h) => aliases.has(h));

        const colStudentId = findCol(aliasesStudentId);
        const colFirst = findCol(aliasesFirst);
        const colLast = findCol(aliasesLast);
        const colEmail = findCol(aliasesEmail);

        let parsed: Student[];
        if (colStudentId === -1 || colFirst === -1 || colLast === -1) {
          // Fallback: assume A-D (Student ID, First Name, Last Name, Email)
          parsed = aoa
            .slice(1)
            .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
            .map((row) => {
              const student_id = String(row[0] ?? '').trim();
              const first_name = String(row[1] ?? '').trim();
              const last_name = String(row[2] ?? '').trim();
              const email = String(row[3] ?? '').trim();
              return {
                student_id,
                first_name,
                last_name,
                ...(email ? { email } : {}),
              } as Student;
            });
        } else {
          parsed = aoa
            .slice(1)
            .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
            .map((row) => {
              const student_id = String(row[colStudentId] ?? '').trim();
              const first_name = String(row[colFirst] ?? '').trim();
              const last_name = String(row[colLast] ?? '').trim();
              const email = colEmail >= 0 ? String(row[colEmail] ?? '').trim() : '';
              return {
                student_id,
                first_name,
                last_name,
                ...(email ? { email } : {}),
              } as Student;
            });
        }

        if (parsed.length === 0) {
          toast.error('No student rows detected. Please check the template format.');
          return;
        }

        // Validation (block blanks)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const invalidRows: string[] = [];
        parsed.forEach((s, i) => {
          if (!s.student_id || !/^\d{9}$/.test(s.student_id) || !s.student_id.startsWith('20')) {
            invalidRows.push(`Row ${i + 2}: Invalid Student ID`);
            return;
          }
          if (!s.first_name || !/^[a-zA-ZñÑ\s]+$/.test(s.first_name) || s.first_name.length < 4) {
            invalidRows.push(`Row ${i + 2}: Invalid First Name`);
            return;
          }
          if (!s.last_name || !/^[a-zA-ZñÑ\s]+$/.test(s.last_name) || s.last_name.length < 4) {
            invalidRows.push(`Row ${i + 2}: Invalid Last Name`);
            return;
          }
          if (s.email && s.email.trim() && !emailRegex.test(s.email.trim())) {
            invalidRows.push(`Row ${i + 2}: Invalid Email`);
          }
        });

        if (invalidRows.length > 0) {
          toast.error(`Import blocked. Fix these issues:\n${invalidRows.slice(0, 5).join('\n')}${invalidRows.length > 5 ? `\n...and ${invalidRows.length - 5} more` : ''}`);
          return;
        }

        // Duplicate checks
        const seen = new Set<string>();
        const dupInFile = new Set<string>();
        parsed.forEach((s) => {
          if (seen.has(s.student_id)) dupInFile.add(s.student_id);
          seen.add(s.student_id);
        });
        if (dupInFile.size > 0) {
          toast.error(`Duplicate Student ID(s) in file: ${Array.from(dupInFile).join(', ')}`);
          return;
        }

        const existingIds = new Set(classData.students.map((s) => s.student_id));
        const conflicts = parsed.filter((s) => existingIds.has(s.student_id));
        if (conflicts.length > 0) {
          toast.error(`These Student ID(s) already exist in this class: ${Array.from(new Set(conflicts.map((c) => c.student_id))).join(', ')}`);
          return;
        }

        setClassData({
          ...classData,
          students: [...classData.students, ...parsed],
        });

        toast.success(`Imported ${parsed.length} student(s). Click “Save Changes” to finalize.`);
      } catch (err) {
        console.error('Error importing students:', err);
        toast.error('Failed to import students. Please check the file and try again.');
      }
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsArrayBuffer(file);
  };

  const updateStudentField = (studentId: string, field: keyof Student, value: string) => {
    if (!classData) return;

    const updatedStudents = classData.students.map(student =>
      student.student_id === studentId ? { ...student, [field]: value } : student
    );

    setClassData({ ...classData, students: updatedStudents });
  };

  const handleAddStudent = () => {
    if (!classData) return;

    // Validate student data
    if (!newStudent.student_id || !/^\d{9}$/.test(newStudent.student_id) || !newStudent.student_id.startsWith('20')) {
      toast.error('Invalid Student ID. Must be 9 digits starting with "20"');
      return;
    }

    if (!newStudent.first_name || newStudent.first_name.length < 4 || !/^[a-zA-ZñÑ\s]+$/.test(newStudent.first_name)) {
      toast.error('First name must be at least 4 characters and contain only letters');
      return;
    }

    if (!newStudent.last_name || newStudent.last_name.length < 4 || !/^[a-zA-ZñÑ\s]+$/.test(newStudent.last_name)) {
      toast.error('Last name must be at least 4 characters and contain only letters');
      return;
    }

    // Check for duplicate student ID
    if (classData.students.some(s => s.student_id === newStudent.student_id)) {
      toast.error('Student ID already exists in this class');
      return;
    }

    // Email validation (optional)
    if (newStudent.email && newStudent.email.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(newStudent.email.trim())) {
        toast.error('Invalid email format');
        return;
      }
    }

    const student = {
      student_id: newStudent.student_id,
      first_name: newStudent.first_name,
      last_name: newStudent.last_name,
      ...(newStudent.email && { email: newStudent.email }),
    };

    setClassData({ ...classData, students: [...classData.students, student] });
    setNewStudent({ student_id: '', first_name: '', last_name: '', email: '' });
    setShowAddStudent(false);
    toast.success(`Student added to class roster (ID: ${newStudent.student_id})`);
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!classData) return;
    const updatedStudents = classData.students.filter(s => s.student_id !== studentId);
    setClassData({ ...classData, students: updatedStudents });
    toast.success('Student removed from roster');
  };

  const handleSort = (field: 'student_id' | 'first_name' | 'last_name' | 'email') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedStudents = classData
    ? classData.students
        .filter((student) => {
          if (!studentSearch.trim()) return true;
          const query = studentSearch.toLowerCase();
          return (
            student.student_id.toLowerCase().includes(query) ||
            student.first_name.toLowerCase().includes(query) ||
            student.last_name.toLowerCase().includes(query) ||
            (student.email || '').toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          const aVal = (sortBy === 'email' ? a[sortBy] || '' : a[sortBy]).toLowerCase();
          const bVal = (sortBy === 'email' ? b[sortBy] || '' : b[sortBy]).toLowerCase();
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        })
    : [];

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-center py-12">
          Loading class data...
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="page-container">
        <div className="text-center py-12">
          Class not found
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 mb-6">
          <BackButton href="/classes" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Edit Class</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportStudents}
            disabled={!classData || classData.students.length === 0}
            className="flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Students
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportStudents}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button 
              variant="outline"
              className="flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Students
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving} className="flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Class Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Class Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="class_name">Program *</Label>
                <Input
                  id="class_name"
                  value={classData.class_name}
                  onChange={(e) => setClassData({ ...classData, class_name: e.target.value })}
                  placeholder="Enter program name"
                  className={
                    !classData.class_name.trim() || 
                    !/^[a-zA-ZñÑ\s]+$/.test(classData.class_name.trim()) || 
                    classData.class_name.trim().length < 3 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-green-300 focus:border-green-500'
                  }
                />
                <p className="text-xs text-gray-600">
                  Letters only, minimum 3 characters
                  {classData.class_name.trim() && ` (${classData.class_name.trim().length}/3)`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_subject">Course *</Label>
                <Input
                  id="course_subject"
                  value={classData.course_subject}
                  onChange={(e) => setClassData({ ...classData, course_subject: e.target.value })}
                  placeholder="Enter course or subject"
                  className={
                    !classData.course_subject.trim() || 
                    !/^[a-zA-ZñÑ\s]+$/.test(classData.course_subject.trim()) || 
                    classData.course_subject.trim().length < 4 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-green-300 focus:border-green-500'
                  }
                />
                <p className="text-xs text-gray-600">
                  Letters only, minimum 4 characters
                  {classData.course_subject.trim() && ` (${classData.course_subject.trim().length}/4)`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="year">Year (Optional)</Label>
                <Select
                  value={classData.year || 'none'}
                  onValueChange={(value) => setClassData({ ...classData, year: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger className="border-gray-300 focus:border-blue-500">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">Optional field - select academic year level</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">Room *</Label>
                <Input
                  id="room"
                  type="number"
                  value={classData.room}
                  onChange={(e) => {
                    const inputValue = e.target.value.replace(/[^0-9]/g, '');
                    const value = inputValue.slice(0, 3);
                    setClassData({ ...classData, room: value });
                  }}
                  placeholder="e.g., 101, 205, 312"
                  className={!classData.room.trim() || !/^[0-9]{3}$/.test(classData.room.trim()) ? 'border-red-300 focus:border-red-500' : 'border-green-300 focus:border-green-500'}
                />
                <p className="text-xs text-gray-600">Exactly 3 digits required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Class Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{classData.students.length}</div>
                <div className="text-sm text-muted-foreground">Total Students</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {new Date(classData.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students List */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Students ({classData.students.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [field, order] = value.split('-') as ['student_id' | 'first_name' | 'last_name' | 'email', 'asc' | 'desc'];
                  setSortBy(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    <SelectValue placeholder="Sort by" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student_id-asc">Student ID (→)</SelectItem>
                  <SelectItem value="student_id-desc">Student ID (←)</SelectItem>
                  <SelectItem value="first_name-asc">First Name (A→Z)</SelectItem>
                  <SelectItem value="first_name-desc">First Name (Z→A)</SelectItem>
                  <SelectItem value="last_name-asc">Last Name (A→Z)</SelectItem>
                  <SelectItem value="last_name-desc">Last Name (Z→A)</SelectItem>
                  <SelectItem value="email-asc">Email (→)</SelectItem>
                  <SelectItem value="email-desc">Email (←)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {studentSearch.trim() && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndSortedStudents.length} of {classData.students.length} students
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('student_id')}>
                    <div className="flex items-center gap-1">
                      Student ID
                      {sortBy === 'student_id' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[150px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('first_name')}>
                    <div className="flex items-center gap-1">
                      First Name
                      {sortBy === 'first_name' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[150px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('last_name')}>
                    <div className="flex items-center gap-1">
                      Last Name
                      {sortBy === 'last_name' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px] cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">
                      Email
                      {sortBy === 'email' && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[80px]">Year</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStudents.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell>
                      <Input
                        value={student.student_id}
                        onChange={(e) => updateStudentField(student.student_id, 'student_id', e.target.value)}
                        className="border-0 p-1 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={student.first_name}
                        onChange={(e) => updateStudentField(student.student_id, 'first_name', e.target.value)}
                        className="border-0 p-1 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={student.last_name}
                        onChange={(e) => updateStudentField(student.student_id, 'last_name', e.target.value)}
                        className="border-0 p-1 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={student.email || ''}
                        onChange={(e) => updateStudentField(student.student_id, 'email', e.target.value)}
                        className="border-0 p-1 h-8"
                        placeholder="Email"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={student.grade || 'none'}
                        onValueChange={(value) => updateStudentField(student.student_id, 'grade', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="border-0 p-1 h-8">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="1">1st Year</SelectItem>
                          <SelectItem value="2">2nd Year</SelectItem>
                          <SelectItem value="3">3rd Year</SelectItem>
                          <SelectItem value="4">4th Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStudent(student.student_id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {showAddStudent && (
                  <TableRow className="border-t-2 border-blue-200 bg-blue-50/50">
                    <TableCell>
                      <Input
                        value={newStudent.student_id}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 9);
                          setNewStudent({ ...newStudent, student_id: value });
                        }}
                        placeholder="Student ID (9 digits)"
                        className="border p-2 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newStudent.first_name}
                        onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                        placeholder="First Name"
                        className="border p-2 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newStudent.last_name}
                        onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                        placeholder="Last Name"
                        className="border p-2 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                        placeholder="Email (optional)"
                        className="border p-2 h-8"
                        type="email"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Year (optional)
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAddStudent}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddStudent(false);
                            setNewStudent({ student_id: '', first_name: '', last_name: '', email: '' });
                          }}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}