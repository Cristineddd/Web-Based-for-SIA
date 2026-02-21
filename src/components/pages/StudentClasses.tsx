'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { StudentIDService } from '@/services/studentIDService';
import { useAuth } from '@/contexts/AuthContext';
import { createClass, deleteClass } from '@/services/classService';
import { OfficialRecordService } from '@/services/officialRecordService';
import { IDChangeLogger } from '@/services/idChangeLogger';
import { StudentFieldValidationService } from '@/services/studentFieldValidationService';
import { DataQualityService } from '@/services/dataQualityService';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Search, 
  Plus, 
  Trash2, 
  Loader2,
  GraduationCap,
  Upload,
  Download,
  AlertCircle,
  X
} from 'lucide-react';

interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface Class {
  id: string;
  class_name: string;
  course_subject: string;
  section_block: string;
  room: string;
  students: Student[];
  created_at: string;
  schedule_day?: string;
  schedule_time?: string;
  semester?: string;
  school_year?: string;
}

export default function StudentClasses() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState('basic');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Student[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [dataQualityResult, setDataQualityResult] = useState<any>(null);
  const [showDataQualityDialog, setShowDataQualityDialog] = useState(false);
  
  const [newClass, setNewClass] = useState({
    class_name: '',
    course_subject: '',
    section_block: '',
    room: '',
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [newStudent, setNewStudent] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    email: '',
  });

  useEffect(() => {
    fetchClasses();
  }, [user?.id]);

  const fetchClasses = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'classes'));
      const fetchedClasses: Class[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const createdAtValue = data.created_at ?? data.createdAt;

        return {
          id: docSnap.id,
          class_name: data.class_name ?? '',
          course_subject: data.course_subject ?? '',
          section_block: data.section_block ?? '',
          room: data.room ?? '',
          students: Array.isArray(data.students) ? data.students : [],
          created_at:
            typeof createdAtValue?.toDate === 'function'
              ? createdAtValue.toDate().toISOString()
              : typeof createdAtValue === 'string'
                ? createdAtValue
                : new Date().toISOString(),
          schedule_day: data.schedule_day,
          schedule_time: data.schedule_time,
          semester: data.semester,
          school_year: data.school_year,
        };
      });

      setClasses(fetchedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    // Validation for Class Name - letters only
    if (!newClass.class_name.trim()) {
      toast.error('Class Name is required');
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(newClass.class_name.trim())) {
      toast.warning('Class Name must contain letters only');
      return;
    }

    // Validation for Course/Subject - required
    if (!newClass.course_subject.trim()) {
      toast.error('Course/Subject is required');
      return;
    }

    // Validation for Block - required
    if (!newClass.section_block) {
      toast.error('Block/Section is required');
      return;
    }

    // Validation for Room - numbers only
    if (!newClass.room.trim()) {
      toast.warning('Room number is required');
      return;
    }
    if (!/^\d+$/.test(newClass.room.trim())) {
      toast.warning('Room must contain numbers only');
      return;
    }

    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    try {
      if (editingClassId) {
        // UPDATE existing class
        const { updateClass } = await import('@/services/classService');
        
        await updateClass(editingClassId, {
          ...newClass,
          students: students,
        });

        // Update individual student records in the students collection
        if (students.length > 0) {
          try {
            for (const student of students) {
              const studentDocRef = doc(db, 'students', student.student_id);
              await setDoc(studentDocRef, {
                student_id: student.student_id,
                first_name: student.first_name,
                last_name: student.last_name,
                email: student.email || null,
                created_by: user.id,
                class_id: editingClassId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { merge: true });
            }
          } catch (error) {
            console.error('Error updating students in Firestore:', error);
            toast.error('Failed to save student records: ' + (error instanceof Error ? error.message : String(error)));
          }
        }

        // Update the classes list in state
        setClasses(classes.map(c => 
          c.id === editingClassId 
            ? { ...c, ...newClass, students }
            : c
        ));

        setEditingClassId(null);
        toast.success('Class updated successfully');
      } else {
        // CREATE new class
        const classToAdd: Omit<Class, 'id'> = {
          ...newClass,
          students: students,
          created_at: new Date().toISOString(),
        };

        // Save to Firestore
        const savedClass = await createClass(classToAdd, user.id);
        
        // CRITICAL: Also save individual student records to the students collection
        if (students.length > 0) {
          try {
            for (const student of students) {
              const studentDocRef = doc(db, 'students', student.student_id);
              await setDoc(studentDocRef, {
                student_id: student.student_id,
                first_name: student.first_name,
                last_name: student.last_name,
                email: student.email || null,
                created_by: user.id,
                class_id: savedClass.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { merge: true });
            }
          } catch (error) {
            console.error('Error saving students to Firestore:', error);
            toast.error('Failed to save student records: ' + (error instanceof Error ? error.message : String(error)));
          }
        }
        
        setClasses([...classes, savedClass]);
        toast.success('Class added and saved successfully');
      }
      
      setShowAddDialog(false);
      setNewClass({
        class_name: '',
        course_subject: '',
        section_block: '',
        room: '',
      });
      setStudents([]);
      setCurrentTab('basic');
      
      toast.success('Class added and saved successfully');
    } catch (error) {
      console.error('Error adding class:', error);
      toast.error('Failed to add class');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Delete from Firestore
      await deleteClass(deleteId);
      setClasses(classes.filter(c => c.id !== deleteId));
      setDeleteId(null);
      toast.success('Class deleted successfully');
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    }
  };

  const handleAddStudent = async () => {
    // Validation for First Name - letters only, more than 3 letters
    if (!newStudent.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(newStudent.first_name.trim())) {
      toast.warning('First name must contain letters only');
      return;
    }
    if (newStudent.first_name.trim().length < 4) {
      toast.warning('First name must be at least 4 characters');
      return;
    }

    // Validation for Last Name - letters only, more than 3 letters
    if (!newStudent.last_name.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(newStudent.last_name.trim())) {
      toast.warning('Last name must contain letters only');
      return;
    }
    if (newStudent.last_name.trim().length < 4) {
      toast.warning('Last name must be at least 4 characters');
      return;
    }

    // Validation for Email - optional but if provided must be valid gmail
    if (newStudent.email.trim()) {
      if (!newStudent.email.trim().includes('@gmail.com')) {
        toast.warning('Email must be a valid Gmail address (@gmail.com)');
        return;
      }
    }

    let studentId = newStudent.student_id.trim();
    const wasAutoGenerated = !studentId;

    // Validation for Student ID - 9 digits and must start with 20
    if (studentId) {
      if (!/^\d{9}$/.test(studentId)) {
        toast.warning('Student ID must be exactly 9 digits');
        return;
      }
      if (!studentId.startsWith('20')) {
        toast.warning('Student ID must start with 20');
        return;
      }
    }

    // Auto-generate when Student ID is not provided
    if (!studentId) {
      const generated = await StudentIDService.autoAssignIDs([
        {
          student_id: '',
          first_name: newStudent.first_name.trim(),
          last_name: newStudent.last_name.trim(),
          email: newStudent.email.trim() || undefined,
        },
      ]);

      if (!generated.success || !generated.ids || generated.ids.length === 0) {
        toast.error(generated.error || 'Failed to auto-generate student ID');
        return;
      }

      studentId = generated.ids[0];
    }

    // Check for duplicate student ID
    if (students.some(s => s.student_id === studentId)) {
      toast.error(`Student ID "${studentId}" already exists in this class`);
      return;
    }

    // Check for duplicate student ID in database
    const dbConflicts = await StudentIDService.checkForConflicts([studentId]);
    if (dbConflicts.length > 0) {
      toast.error(`Student ID "${studentId}" already exists in the database`);
      return;
    }

    // Check for duplicate student name (first name + last name combination)
    if (
      students.some(
        (s) =>
          s.first_name.toLowerCase() === newStudent.first_name.trim().toLowerCase() &&
          s.last_name.toLowerCase() === newStudent.last_name.trim().toLowerCase()
      )
    ) {
      toast.error(`Student "${newStudent.first_name.trim()} ${newStudent.last_name.trim()}" already exists in this class`);
      return;
    }

    const student: Student = {
      student_id: studentId,
      first_name: newStudent.first_name.trim(),
      last_name: newStudent.last_name.trim(),
      email: newStudent.email.trim() || undefined,
    };

    setStudents([...students, student]);
    
    // CRITICAL: Save individual student record to the students collection if we have a selected class
    if (user && selectedClass) {
      try {
        const studentDocRef = doc(db, 'students', student.student_id);
        await setDoc(studentDocRef, {
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email || null,
          created_by: user.id,
          class_id: selectedClass.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error('Error saving student to Firestore:', error);
        toast.error('Failed to save student to database: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    
    // Mark as official when manually added
    if (user) {
      const isOfficial = await OfficialRecordService.markAsOfficial(
        student.student_id,
        user.id,
        user.email,
        `${student.first_name} ${student.last_name}`
      );
      if (!isOfficial) {
        console.warn(`Failed to mark student ${student.student_id} as official`);
      }
    }
    
    // Log ID creation
    if (user && selectedClass) {
      await IDChangeLogger.logIDCreation(
        user.id,
        user.email,
        `${student.first_name} ${student.last_name}`,
        studentId,
        selectedClass.id,
        selectedClass.class_name
      );
    }

    setNewStudent({
      student_id: '',
      first_name: '',
      last_name: '',
      email: '',
    });
    toast.success(`Student added to roster${!wasAutoGenerated ? '' : ` (ID: ${studentId})`}`);
  };

  const handleRemoveStudent = async (studentId: string) => {
    const updatedStudents = students.filter(s => s.student_id !== studentId);
    setStudents(updatedStudents);
    
    // CRITICAL: Update the class in Firestore with the removed student
    if (user && selectedClass) {
      try {
        const { updateClass } = await import('@/services/classService');
        await updateClass(selectedClass.id, {
          students: updatedStudents,
        });
      } catch (error) {
        console.error('Error updating class after removing student:', error);
        toast.warning('Student removed from roster but failed to save changes');
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

          const parsedStudents = rows
            .map((row, idx) => ({
              rowIndex: idx,
              student_id: String(row['student_id'] || row['Student ID'] || row['ID'] || row['id'] || '').trim(),
              first_name: String(row['first_name'] || row['First Name'] || row['First'] || '').trim(),
              last_name: String(row['last_name'] || row['Last Name'] || row['Last'] || '').trim(),
              email: String(row['email'] || row['Email'] || '').trim(),
              year: String(row['year'] || row['Year'] || row['Grade'] || '').trim(),
              section: String(row['section'] || row['Section'] || row['Block'] || row['block'] || '').trim(),
            }));

          // Validate all records for required fields
          const validationResult = StudentFieldValidationService.validateBulkRecords(parsedStudents);

          if (validationResult.summary.invalid > 0) {
            toast.error(`${validationResult.summary.invalid} of ${validationResult.summary.total} records have validation errors`);
            setImporting(false);
            return;
          }

          const validStudents = validationResult.validRecords.filter((row) => row.first_name && row.last_name);

          if (validStudents.length === 0) {
            toast.error('No valid student records found after validation.');
            setImporting(false);
            return;
          }

          // Check for duplicates and inconsistencies
          const qualityResult = DataQualityService.checkDataQuality(validStudents);
          
          if (!qualityResult.isClean) {
            setDataQualityResult(qualityResult);
            setShowDataQualityDialog(true);
            setImporting(false);
            return;
          }

          // Auto-assign IDs for students without them
          const studentsNeedingIds = validStudents.filter((s) => !s.student_id || s.student_id.trim() === '') as Array<{
            rowIndex: number;
            student_id: string;
            first_name: string;
            last_name: string;
            email?: string;
            [key: string]: any;
          }>;
          let idAssignmentResult = { success: true, ids: [] as string[] };
          
          if (studentsNeedingIds.length > 0) {
            const assignmentResult = await StudentIDService.autoAssignIDs(studentsNeedingIds);
            if (!assignmentResult.success) {
              toast.error(assignmentResult.error || 'Failed to auto-generate IDs for import');
              setImporting(false);
              return;
            }
            idAssignmentResult = { success: true, ids: assignmentResult.ids || [] };
          }

          let generatedIndex = 0;
          const studentsWithIds: Student[] = validStudents.map((row) => {
            const existingId = row.student_id?.trim();
            if (existingId) {
              return {
                student_id: existingId,
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email || undefined,
              };
            }

            const generatedId = idAssignmentResult.ids?.[generatedIndex++];
            return {
              student_id: generatedId || '',
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email || undefined,
            };
          });

          if (studentsWithIds.some((s) => !s.student_id)) {
            toast.error('Failed to assign IDs for one or more students.');
            setImporting(false);
            return;
          }

          const duplicateIdsInFile = new Set<string>();
          const seenIds = new Set<string>();
          for (const student of studentsWithIds) {
            if (seenIds.has(student.student_id)) {
              duplicateIdsInFile.add(student.student_id);
            } else {
              seenIds.add(student.student_id);
            }
          }

          if (duplicateIdsInFile.size > 0) {
            toast.error(`Duplicate IDs in file: ${Array.from(duplicateIdsInFile).join(', ')}`);
            return;
          }

          const existingClassIds = new Set(students.map((s) => s.student_id));
          const localConflicts = studentsWithIds
            .map((s) => s.student_id)
            .filter((id) => existingClassIds.has(id));
          if (localConflicts.length > 0) {
            toast.error(`IDs already in this class: ${Array.from(new Set(localConflicts)).join(', ')}`);
            return;
          }

          const dbConflicts = await StudentIDService.checkForConflicts(
            studentsWithIds.map((s) => s.student_id)
          );
          if (dbConflicts.length > 0) {
            toast.error(`IDs already exist in database: ${Array.from(new Set(dbConflicts)).join(', ')}`);
            return;
          }

          const generatedCount = parsedStudents.filter((s) => !s.student_id).length;
          setImportPreview(studentsWithIds);
          setShowImportDialog(true);
          toast.success(
            `Ready to import ${studentsWithIds.length} student(s)` +
              (generatedCount > 0 ? ` with ${generatedCount} auto-generated ID(s)` : '')
          );
        } catch (error) {
          console.error('Error parsing import file:', error);
          toast.error('Failed to parse the uploaded file');
        } finally {
          setImporting(false);
        }
      };

      reader.onerror = () => {
        setImporting(false);
        toast.error('Failed to read file');
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error importing students:', error);
      toast.error('Failed to import students');
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (importPreview.length === 0) return;

    const currentIds = new Set(students.map((s) => s.student_id));
    const idConflicts = importPreview
      .map((s) => s.student_id)
      .filter((id) => currentIds.has(id));
    if (idConflicts.length > 0) {
      toast.error(`Import blocked. Duplicate IDs in class: ${Array.from(new Set(idConflicts)).join(', ')}`);
      return;
    }

    const dbConflicts = await StudentIDService.checkForConflicts(importPreview.map((s) => s.student_id));
    if (dbConflicts.length > 0) {
      toast.error(`Import blocked. IDs already exist in database: ${Array.from(new Set(dbConflicts)).join(', ')}`);
      return;
    }

    const updatedStudents = [...students, ...importPreview];
    setStudents(updatedStudents);
    
    // CRITICAL: Save the updated class with new students to Firestore
    if (user && selectedClass) {
      try {
        // Import updateClass from classService
        const { updateClass } = await import('@/services/classService');
        
        // Update the class with the new students array
        await updateClass(selectedClass.id, {
          students: updatedStudents,
        });

        // Also create individual student records in the students collection
        for (const student of importPreview) {
          const studentDocRef = doc(db, 'students', student.student_id);
          await setDoc(studentDocRef, {
            student_id: student.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            email: student.email || null,
            created_by: user.id,
            class_id: selectedClass.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (error) {
        console.error('Error saving students to Firestore:', error);
        toast.error('Failed to save students to database: ' + (error instanceof Error ? error.message : String(error)));
        return;
      }
    }
    
    // Log bulk ID import
    if (user && selectedClass) {
      const idChangeRecords = importPreview.map(student => ({
        studentName: `${student.first_name} ${student.last_name}`,
        oldId: null as string | null,
        newId: student.student_id,
        classId: selectedClass.id,
        className: selectedClass.class_name,
        changeType: 'import' as const,
      }));

      await IDChangeLogger.logBulkIDChanges(
        user.id,
        user.email,
        idChangeRecords,
        selectedClass.id,
        selectedClass.class_name
      );
    }

    // Mark validated students as official
    if (user) {
      const studentIds = importPreview.map((s) => s.student_id);
      const markResult = await OfficialRecordService.markMultipleAsOfficial(
        studentIds,
        user.id,
        user.email
      );
      
      if (markResult.success > 0) {
        toast.success(
          `Imported ${importPreview.length} students and marked ${markResult.success} as official records`
        );
      } else {
        toast.warning(`Imported ${importPreview.length} students but failed to mark some as official`);
      }
    } else {
      toast.success(`Imported ${importPreview.length} students`);
    }

    setImportPreview([]);
    setShowImportDialog(false);
  };

  const downloadTemplate = () => {
    const currentYear = new Date().getFullYear();
    const template = [
      {
        student_id: '',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: 'juan.delacruz@example.com',
      },
      {
        student_id: `${currentYear}-0001`,
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'maria.santos@example.com',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'student_classes_template.xlsx');
  };

  const filteredClasses = classes.filter(c =>
    c.class_name.toLowerCase().includes(search.toLowerCase()) ||
    c.course_subject.toLowerCase().includes(search.toLowerCase()) ||
    c.section_block.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Class</h1>
          <p className="text-muted-foreground mt-1">Manage student roster and information</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => setShowAddDialog(true)} className="gradient-primary gap-2">
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      <Card className="card-elevated mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search students by name, ID, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search ? 'No classes found matching your search' : 'No classes yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClasses.map((classItem) => (
            <Card key={classItem.id} className="card-elevated hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedClass(classItem);
                setShowViewDialog(true);
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{classItem.class_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {classItem.course_subject} • {classItem.section_block}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(classItem.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Students</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <GraduationCap className="w-4 h-4 text-yellow-600" />
                      {classItem.students.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Scanned</p>
                    <p className="text-sm font-medium text-primary">
                      {classItem.students.length} / {classItem.students.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Average Score</p>
                    <p className="text-sm font-medium">84%</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ width: '100%' }}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground mt-1">100%</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>
              Create a new class and add students to the roster
            </DialogDescription>
          </DialogHeader>

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Class Information</TabsTrigger>
              <TabsTrigger value="students">Student Roster</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class_name">Class Name *</Label>
                  <Input
                    id="class_name"
                    value={newClass.class_name}
                    onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })}
                    placeholder="e.g., Computer Science 101"
                  />
                  <p className="text-xs text-muted-foreground">Letters only</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course_subject">Course/Subject *</Label>
                  <Input
                    id="course_subject"
                    value={newClass.course_subject}
                    onChange={(e) => setNewClass({ ...newClass, course_subject: e.target.value })}
                    placeholder="e.g., Introduction to Programming"
                  />
                  <p className="text-xs text-muted-foreground">Required</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section_block">Section/Block *</Label>
                  <Input
                    id="section_block"
                    value={newClass.section_block}
                    onChange={(e) => setNewClass({ ...newClass, section_block: e.target.value })}
                    placeholder="e.g., A"
                  />
                  <p className="text-xs text-muted-foreground">Required field</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="room">Room *</Label>
                  <Input
                    id="room"
                    value={newClass.room}
                    onChange={(e) => setNewClass({ ...newClass, room: e.target.value })}
                    placeholder="e.g., 301"
                  />
                  <p className="text-xs text-muted-foreground">Numbers only</p>
                </div>
                
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-4 mt-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? 'Importing...' : 'Import CSV/Excel'}
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Student Manually</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Input
                        placeholder="Student ID (optional)"
                        value={newStudent.student_id}
                        onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">9 digits, start with 20</p>
                    </div>
                    <div>
                      <Input
                        placeholder="First Name *"
                        value={newStudent.first_name}
                        onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Letters, 4+ chars</p>
                    </div>
                    <div>
                      <Input
                        placeholder="Last Name *"
                        value={newStudent.last_name}
                        onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Letters, 4+ chars</p>
                    </div>
                    <div>
                      <Input
                        placeholder="Email (optional)"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">@gmail.com only</p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleAddStudent} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </div>

              {students.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, idx) => (
                        <TableRow key={`new-student-${idx}`}>
                          <TableCell>{student.student_id}</TableCell>
                          <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                          <TableCell>{student.email || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStudent(student.student_id)}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {students.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No students added yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClass} className="gradient-primary">
              Add Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Class Roster Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Class Roster</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xls, .xlsx) containing student information to create a new class or update an existing one.
            </DialogDescription>
          </DialogHeader>

          {importPreview.length > 0 ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center">
                    <Upload className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">students.xlsx</p>
                    <p className="text-xs text-muted-foreground">164 KB</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto"
                    onClick={() => {
                      setImportPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Rows</p>
                  <p className="text-2xl font-bold text-green-600">{importPreview.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Valid Students</p>
                  <p className="text-2xl font-bold text-green-600">{importPreview.length}</p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium mb-2 text-sm">Detected Student Information Fields</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Student Name</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>Student ID</span>
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((student, idx) => (
                      <TableRow key={`import-${idx}`}>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                        <TableCell>{student.email || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Upload className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="font-medium mb-2">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mb-4">Excel files only (.xls, .xlsx)</p>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportPreview([]);
            }}>
              Cancel
            </Button>
            {importPreview.length > 0 && (
              <Button onClick={confirmImport} className="gradient-primary">
                Confirm Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Quality Check Dialog */}
      <Dialog open={showDataQualityDialog} onOpenChange={setShowDataQualityDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Data Quality Issues Detected</DialogTitle>
            <DialogDescription>
              Review duplicates and inconsistencies before proceeding with the import
            </DialogDescription>
          </DialogHeader>

          {dataQualityResult && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                Data quality check found {dataQualityResult.issues?.length || 0} potential issues.
                Review and proceed with caution.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDataQualityDialog(false);
                    setDataQualityResult(null);
                    setImportPreview([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    // Proceed with import despite quality issues
                    const idAssignmentResult = await StudentIDService.bulkImportStudents(importPreview, true);
                    if (!idAssignmentResult.success) {
                      toast.error(idAssignmentResult.error || 'Failed to auto-generate IDs for import');
                      setShowDataQualityDialog(false);
                      return;
                    }

                    // Continue with rest of import logic
                    let generatedIndex = 0;
                    const studentsWithIds: Student[] = importPreview.map((row) => {
                      const existingId = row.student_id.trim();
                      if (existingId) {
                        return {
                          student_id: existingId,
                          first_name: row.first_name,
                          last_name: row.last_name,
                          email: row.email || undefined,
                        };
                      }

                      const generatedId = idAssignmentResult.ids?.[generatedIndex++];
                      return {
                        student_id: generatedId || '',
                        first_name: row.first_name,
                        last_name: row.last_name,
                        email: row.email || undefined,
                      };
                    });

                    setStudents([...students, ...studentsWithIds]);
                    setImportPreview([]);
                    setShowDataQualityDialog(false);
                    setShowImportDialog(false);

                    // Mark validated students as official
                    if (user) {
                      const studentIds = studentsWithIds.map((s) => s.student_id);
                      const markResult = await OfficialRecordService.markMultipleAsOfficial(
                        studentIds,
                        user.id,
                        user.email
                      );
                      
                      if (markResult.success > 0) {
                        toast.success(
                          `Imported ${studentsWithIds.length} students and marked ${markResult.success} as official records`
                        );
                      } else {
                        toast.warning(`Imported ${studentsWithIds.length} students but failed to mark some as official`);
                      }
                    } else {
                      toast.success(`Imported ${studentsWithIds.length} students`);
                    }
                  }}
                  className="gradient-primary"
                >
                  Proceed with Import
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Class Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedClass?.class_name}</DialogTitle>
            <DialogDescription>
              {selectedClass?.course_subject} - Section {selectedClass?.section_block}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Schedule</p>
                  <p className="font-medium">{selectedClass.schedule_day}</p>
                  <p className="text-sm">{selectedClass.schedule_time}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{selectedClass.room || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Semester</p>
                  <p className="font-medium">{selectedClass.semester || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School Year</p>
                  <p className="font-medium">{selectedClass.school_year || '—'}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Students ({selectedClass.students.length})</h4>
                {selectedClass.students.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClass.students.map((student, idx) => (
                          <TableRow key={`${selectedClass.id}-student-${idx}`}>
                            <TableCell>{student.student_id}</TableCell>
                            <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                            <TableCell>{student.email || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No students enrolled</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                if (selectedClass) {
                  // Load the selected class into edit mode
                  setNewClass({
                    class_name: selectedClass.class_name,
                    course_subject: selectedClass.course_subject,
                    section_block: selectedClass.section_block,
                    room: selectedClass.room,
                  });
                  setStudents(selectedClass.students);
                  setEditingClassId(selectedClass.id);
                  setShowViewDialog(false);
                  setShowAddDialog(true);
                  setCurrentTab('basic');
                }
              }}
            >
              Edit Class
            </Button>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this class and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
