"use client";

import { useEffect, useState } from "react";
import {
  History,
  Search,
  FileDown,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { BatchService, BatchRecord } from "@/services/batchService";
import { toast } from "sonner";
import { BadgeCheck, Printer } from "lucide-react";

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchLogs() {
      if (!user) return;
      try {
        setLoading(true);
        const result = await BatchService.getLogsByUserId(user.id);
        if (result.success && result.data) {
          setLogs(result.data);
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
        toast.error("Failed to load activity logs");
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [user]);

  const filteredLogs = logs.filter(
    (log) =>
      log.examCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.examId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-8 space-y-8 bg-[#FAF9F6] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[#004D2C] flex items-center gap-3">
            <History className="w-8 h-8 text-[#BA8E23]" />
            Activity Logs
          </h1>
          <p className="text-gray-400 font-bold">
            Historical log of all printed and generated answer sheets
          </p>
        </div>
      </div>

      <Card className="rounded-[32px] border-[#BA8E23]/20 shadow-xl overflow-hidden bg-white">
        <div className="p-6 border-b bg-white flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by Exam Code..."
              className="pl-12 h-12 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-all font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl font-bold h-11 border-gray-200"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Filter by Date
            </Button>
            <Button className="bg-[#004D2C] hover:bg-[#003d22] text-white rounded-xl font-black h-11 px-6 shadow-md">
              <FileDown className="w-4 h-4 mr-2" />
              Export History
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="py-6 px-8 font-black text-[#004D2C] text-sm uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="py-6 px-6 font-black text-[#004D2C] text-sm uppercase tracking-wider">
                    Type
                  </th>
                  <th className="py-6 px-6 font-black text-[#004D2C] text-sm uppercase tracking-wider">
                    Exam Code
                  </th>
                  <th className="py-6 px-6 font-black text-[#004D2C] text-sm uppercase tracking-wider">
                    Details
                  </th>
                  <th className="py-6 px-8 font-black text-[#004D2C] text-sm uppercase tracking-wider text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-20 text-center text-gray-400 font-bold"
                    >
                      Loading logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                        <History className="w-8 h-8 text-gray-200" />
                      </div>
                      <p className="text-gray-400 font-bold">
                        No activity logs found
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-emerald-50/30 transition-colors group"
                    >
                      <td className="py-6 px-8">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-[#BA8E23]" />
                          <span className="text-gray-500 font-bold">
                            {new Date(log.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="flex items-center gap-2">
                          {log.type === "review" ? (
                            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                              <BadgeCheck className="w-3 h-3" />
                              Review
                            </div>
                          ) : (
                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                              <Printer className="w-3 h-3" />
                              Print
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">
                            #
                          </div>
                          <span className="text-[#004D2C] font-black">
                            {log.examCode}
                          </span>
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        {log.type === "review" ? (
                          <span className="text-gray-400 font-bold italic text-sm">
                            Exam Approved
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-black border">
                            {log.sheetCount} Sheets
                          </span>
                        )}
                      </td>
                      <td className="py-6 px-8 text-right">
                        {log.isDuplicate ? (
                          <span className="text-amber-500 flex items-center justify-end gap-1 text-xs font-black">
                            <AlertCircle className="w-3 h-3" />
                            Potential Duplicate
                          </span>
                        ) : (
                          <span className="text-emerald-500 text-xs font-black">
                            {log.type === "review" ? "Approved" : "Success"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
