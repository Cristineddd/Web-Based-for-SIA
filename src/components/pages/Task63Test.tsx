/*
 * Task [SS2] 6.3 – Mark validated entries as official records
 * 
 * QA Testing Steps:
 * 1. Navigate to Classes page (/classes)
 * 2. Click "View" on any class with students
 * 3. In the View Class dialog:
 *    a. Look for verification status badges (green "Verified" = official, yellow "Unverified" = unvalidated)
 *    b. Click shield button to verify a student
 *    c. Status should change from "Unverified" to "Verified" 
 *    d. Student record is now marked as "official" in database
 * 4. Test persistence:
 *    a. Refresh the page
 *    b. Reopen the class dialog
 *    c. Verify that verified students still show as "Verified"
 * 5. Test official records filtering:
 *    a. Go to any module that uses student data
 *    b. Only students marked as "official" should appear
 *    c. Unverified students should be filtered out
 * 6. Test export functionality:
 *    a. Click "Export Verified (X)" button
 *    b. Only official records should be exported
 *    c. File should contain only verified students
 * 
 * Expected Results:
 * - ✅ Validation status updates in database immediately
 * - ✅ Status persists after page reload  
 * - ✅ Only official records appear in modules
 * - ✅ Export contains only verified/official students
 * - ✅ Validation changes are logged for audit
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, RefreshCw, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OfficialRecordService, type ValidationStatus } from "@/services/officialRecordService";
import { ValidationGuardService } from "@/services/validationGuardService";
import { ValidationStatusBadge } from "@/components/validation/OfficialRecordGuard";

interface TestStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  validation_status?: ValidationStatus;
  validation_date?: string;
  validated_by?: string;
}

export default function Task63TestPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [officialRecords, setOfficialRecords] = useState<TestStudent[]>([]);
  const [unvalidatedRecords, setUnvalidatedRecords] = useState<TestStudent[]>([]);
  const [pendingRecords, setPendingRecords] = useState<TestStudent[]>([]);
  const [validating, setValidating] = useState<string | null>(null);
  const [stats, setStats] = useState({
    official: 0,
    unvalidated: 0,
    pending: 0,
    total: 0,
  });

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      
      // Load different validation status records
      const [official, unvalidated, pending, statistics] = await Promise.all([
        OfficialRecordService.getOfficialRecords(),
        OfficialRecordService.getUnvalidatedRecords(),
        OfficialRecordService.getPendingRecords(),
        OfficialRecordService.getValidationStatistics(),
      ]);

      setOfficialRecords(official as TestStudent[]);
      setUnvalidatedRecords(unvalidated as TestStudent[]);
      setPendingRecords(pending as TestStudent[]);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsOfficial = async (studentId: string, studentName: string) => {
    if (!user) return;
    
    setValidating(studentId);
    try {
      const success = await OfficialRecordService.markAsOfficialWithLogging(
        studentId,
        user.id,
        user.email,
        studentName
      );
      
      if (success) {
        toast.success(`${studentName} marked as official`);
        await loadRecords(); // Reload to see changes
      } else {
        toast.error('Failed to mark as official');
      }
    } catch (error) {
      console.error('Error marking as official:', error);
      toast.error('Failed to mark as official');
    } finally {
      setValidating(null);
    }
  };

  const handleResetValidation = async (studentId: string, studentName: string) => {
    if (!user) return;
    
    setValidating(studentId);
    try {
      const success = await OfficialRecordService.resetValidationStatusWithLogging(
        studentId,
        user.id,
        user.email,
        studentName,
        'Manual reset via test page'
      );
      
      if (success) {
        toast.success(`${studentName} reset to unvalidated`);
        await loadRecords();
      } else {
        toast.error('Failed to reset validation');
      }
    } catch (error) {
      console.error('Error resetting validation:', error);
      toast.error('Failed to reset validation');
    } finally {
      setValidating(null);
    }
  };

  const testOfficialFiltering = async () => {
    try {
      const allStudentIds = [
        ...officialRecords.map(s => s.student_id),
        ...unvalidatedRecords.map(s => s.student_id),
        ...pendingRecords.map(s => s.student_id),
      ];
      
      const officialOnly = await ValidationGuardService.filterToOfficialOnly(allStudentIds);
      
      toast.success(
        `Filtering test: ${allStudentIds.length} total students, ${officialOnly.length} official records would be used in modules`
      );
    } catch (error) {
      console.error('Error testing filtering:', error);
      toast.error('Failed to test filtering');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mr-3" />
          <span>Loading validation records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task 6.3 - Official Records Testing</h1>
          <p className="text-muted-foreground">
            Test marking validated entries as official records
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadRecords} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={testOfficialFiltering} variant="outline">
            <Shield className="w-4 h-4 mr-2" />
            Test Filtering
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Official Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.official}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.official / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Unvalidated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.unvalidated}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.unvalidated / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All student records</p>
          </CardContent>
        </Card>
      </div>

      {/* Official Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            Official Records ({stats.official})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {officialRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validated Date</TableHead>
                  <TableHead>Validated By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officialRecords.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell className="font-mono">{student.student_id}</TableCell>
                    <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                    <TableCell>{student.email || '—'}</TableCell>
                    <TableCell>
                      <ValidationStatusBadge status="official" />
                    </TableCell>
                    <TableCell>
                      {student.validation_date 
                        ? new Date(student.validation_date).toLocaleString()
                        : '—'
                      }
                    </TableCell>
                    <TableCell>{student.validated_by || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetValidation(student.student_id, `${student.first_name} ${student.last_name}`)}
                        disabled={validating === student.student_id}
                      >
                        {validating === student.student_id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          'Reset'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No official records found</p>
          )}
        </CardContent>
      </Card>

      {/* Unvalidated Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Unvalidated Records ({stats.unvalidated})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unvalidatedRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unvalidatedRecords.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell className="font-mono">{student.student_id}</TableCell>
                    <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                    <TableCell>{student.email || '—'}</TableCell>
                    <TableCell>
                      <ValidationStatusBadge status="unvalidated" />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarkAsOfficial(student.student_id, `${student.first_name} ${student.last_name}`)}
                        disabled={validating === student.student_id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {validating === student.student_id ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                        )}
                        Mark Official
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No unvalidated records found</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Records */}
      {stats.pending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <RefreshCw className="w-5 h-5" />
              Pending Records ({stats.pending})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecords.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell className="font-mono">{student.student_id}</TableCell>
                    <TableCell>{`${student.first_name} ${student.last_name}`}</TableCell>
                    <TableCell>{student.email || '—'}</TableCell>
                    <TableCell>
                      <ValidationStatusBadge status="pending" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMarkAsOfficial(student.student_id, `${student.first_name} ${student.last_name}`)}
                          disabled={validating === student.student_id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {validating === student.student_id ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetValidation(student.student_id, `${student.first_name} ${student.last_name}`)}
                          disabled={validating === student.student_id}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}