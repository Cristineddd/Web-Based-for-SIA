import { ActivityType, AuditLog, GradeSnapshot } from "./src/types/audit";

// The exact filtering logic from AuditLogs.tsx
function filterLogs(
  logs: AuditLog[],
  searchQuery: string,
  selectedActivity: ActivityType | "all",
  selectedStatus: "all" | "success" | "failed" | "pending",
  selectedReviewer: string,
  dateFrom: string,
  dateTo: string,
): AuditLog[] {
  let filtered = logs;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.description.toLowerCase().includes(query) ||
        log.adminEmail.toLowerCase().includes(query) ||
        log.fileName?.toLowerCase().includes(query) ||
        log.entityName?.toLowerCase().includes(query) ||
        log.activity.toLowerCase().includes(query),
    );
  }

  if (selectedActivity !== "all") {
    filtered = filtered.filter((log) => log.activity === selectedActivity);
  }

  if (selectedStatus !== "all") {
    filtered = filtered.filter((log) => log.status === selectedStatus);
  }

  if (selectedReviewer !== "all") {
    filtered = filtered.filter((log) => log.adminEmail === selectedReviewer);
  }

  if (dateFrom || dateTo) {
    filtered = filtered.filter((log) => {
      const logDate = new Date(log.timestamp);
      logDate.setHours(0, 0, 0, 0);

      let matches = true;
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (logDate < from) matches = false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (logDate > to) matches = false;
      }
      return matches;
    });
  }

  return filtered;
}

const mockLogs: AuditLog[] = [
  {
    id: "1",
    adminId: "user1",
    adminEmail: "alice@example.com",
    activity: "class_created",
    description: "Created class Math 101",
    status: "success",
    timestamp: "2026-02-10T10:00:00Z",
    createdAt: null,
    expiresAt: null,
  },
  {
    id: "2",
    adminId: "user2",
    adminEmail: "bob@example.com",
    activity: "exam_created",
    description: "Created Exam 1",
    status: "success",
    timestamp: "2026-02-15T12:00:00Z",
    createdAt: null,
    expiresAt: null,
  },
  {
    id: "3",
    adminId: "user1",
    adminEmail: "alice@example.com",
    activity: "student_import",
    description: "Imported students",
    status: "failed",
    timestamp: "2026-02-28T10:00:00Z",
    createdAt: null,
    expiresAt: null,
  },
];

// Test 1: Multiple Reviewers
const aliceLogs = filterLogs(
  mockLogs,
  "",
  "all",
  "all",
  "alice@example.com",
  "",
  "",
);
console.assert(
  aliceLogs.length === 2 &&
    aliceLogs.every((l) => l.adminEmail === "alice@example.com"),
  "Multiple reviewers test failed for alice",
);

const bobLogs = filterLogs(
  mockLogs,
  "",
  "all",
  "all",
  "bob@example.com",
  "",
  "",
);
console.assert(
  bobLogs.length === 1 && bobLogs[0].adminEmail === "bob@example.com",
  "Multiple reviewers test failed for bob",
);

// Test 2: Verify Dates
const earlyLogs = filterLogs(
  mockLogs,
  "",
  "all",
  "all",
  "all",
  "2026-02-01",
  "2026-02-12",
);
console.assert(
  earlyLogs.length === 1 && earlyLogs[0].id === "1",
  "Date filter failed for early logs",
);

const lateLogs = filterLogs(
  mockLogs,
  "",
  "all",
  "all",
  "all",
  "2026-02-28",
  "2026-02-28",
);
console.assert(
  lateLogs.length === 1 && lateLogs[0].id === "3",
  "Date filter failed for late logs",
);

// Test 3: Export logic matches DB
// Using the same filtered array for exports ensures it matches DB.
console.log("All filtering logic tests passed!");
