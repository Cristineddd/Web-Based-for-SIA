"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Bell, UserCheck, X } from "lucide-react";
import { ScanningService } from "@/services/scanningService";
import { NullIdAlert } from "@/types/scanning";
import { formatDistanceToNow } from "date-fns";

interface NullIdAlertManagerProps {
  examId: string;
  userId: string;
}

export default function NullIdAlertManager({
  examId,
  userId,
}: NullIdAlertManagerProps) {
  const [alerts, setAlerts] = useState<NullIdAlert[]>([]);
  const [allAlerts, setAllAlerts] = useState<NullIdAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<NullIdAlert | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionReason, setResolutionReason] = useState("");
  const [assignedStudentId, setAssignedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"new" | "resolved" | "all">("new");

  useEffect(() => {
    // Subscribe to new alerts
    const unsubscribe = ScanningService.subscribeToNullIdAlerts(
      examId,
      (newAlerts) => {
        setAlerts(newAlerts);
        setLoading(false);
      },
    );

    // Load all alerts
    loadAllAlerts();

    return () => {
      unsubscribe();
    };
  }, [examId]);

  const loadAllAlerts = async () => {
    const result = await ScanningService.getAllAlerts(examId);
    if (result.success && result.data) {
      setAllAlerts(result.data);
    }
  };

  const handleResolveClick = (alert: NullIdAlert) => {
    setSelectedAlert(alert);
    setShowResolveDialog(true);
    setResolutionReason("");
    setAssignedStudentId("");
  };

  const handleResolve = async () => {
    if (!selectedAlert || !resolutionReason.trim()) {
      return;
    }

    const result = await ScanningService.resolveNullIdAlert(
      selectedAlert.id,
      userId,
      resolutionReason,
      assignedStudentId || undefined,
    );

    if (result.success) {
      setShowResolveDialog(false);
      setSelectedAlert(null);
      loadAllAlerts();
    }
  };

  const handleBulkResolve = async () => {
    const alertIds = alerts.map((a) => a.id);
    await ScanningService.bulkResolveAlerts(alertIds, userId, "Bulk resolved");
    loadAllAlerts();
  };

  const getFilteredAlerts = () => {
    switch (activeTab) {
      case "new":
        return allAlerts.filter((a) => a.status === "new");
      case "resolved":
        return allAlerts.filter((a) => a.status === "resolved");
      default:
        return allAlerts;
    }
  };

  const filteredAlerts = getFilteredAlerts();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading alerts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Notifications */}
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 animate-pulse" />
            {alerts.length} Unrecognized Student ID
            {alerts.length > 1 ? "s" : ""} Detected
          </AlertTitle>
          <AlertDescription>
            Review and resolve these alerts to assign scans to the correct
            students.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerts Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Null ID Alert Dashboard</CardTitle>
              <CardDescription>
                Manage scans with unrecognized or missing student IDs
              </CardDescription>
            </div>
            {alerts.length > 0 && (
              <Button variant="outline" onClick={handleBulkResolve}>
                Resolve All ({alerts.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="new" className="relative">
                New
                {alerts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {alerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === "new"
                      ? "No new alerts. All scans have valid student IDs!"
                      : "No alerts found."}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Detected ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-medium">
                            {alert.detectedId || "N/A"}
                          </TableCell>
                          <TableCell>
                            {alert.status === "new" && (
                              <Badge variant="destructive">New</Badge>
                            )}
                            {alert.status === "resolved" && (
                              <Badge variant="default">Resolved</Badge>
                            )}
                            {alert.status === "ignored" && (
                              <Badge variant="secondary">Ignored</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(alert.timestamp), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell>
                            {alert.status === "new" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResolveClick(alert)}
                              >
                                Resolve
                              </Button>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {alert.assignedStudentId && (
                                  <span>
                                    Assigned to: {alert.assignedStudentId}
                                  </span>
                                )}
                                {alert.resolutionReason && (
                                  <div className="text-xs">
                                    {alert.resolutionReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
            <DialogDescription>
              Choose how to handle the scan with unrecognized ID:{" "}
              {selectedAlert?.detectedId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="student-id">
                Assign to Student ID (Optional)
              </Label>
              <Input
                id="student-id"
                placeholder="Enter correct student ID"
                value={assignedStudentId}
                onChange={(e) => setAssignedStudentId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Leave empty if this scan should be discarded
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Resolution Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain how this alert was resolved..."
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResolveDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={!resolutionReason.trim()}>
              {assignedStudentId ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign & Resolve
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
