'use client';

import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';

export default function Reports() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Analytics and insights about exam performance.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-6 border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Exams This Month</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">0</p>
              <p className="text-xs text-muted-foreground mt-2">No data yet</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Class Average</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">0%</p>
              <p className="text-xs text-muted-foreground mt-2">No results yet</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Pass Rate</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-2">0%</p>
              <p className="text-xs text-muted-foreground mt-2">No data yet</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <PieChart className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6 border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4">Grade Distribution</h3>
          <div className="h-48 sm:h-64 bg-muted/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Bar Chart Placeholder</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4">Score Trend</h3>
          <div className="h-48 sm:h-64 bg-muted/30 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Line Chart Placeholder</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance by Question */}
      <Card className="p-4 sm:p-6 border">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4">Performance by Question</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No data available yet. Create exams and grade answers to see performance analysis.</p>
        </div>
      </Card>

      {/* Export Options */}
      <Card className="p-4 sm:p-6 border bg-blue-50 border-blue-200">
        <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3">Generate Report</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">Export reports in various formats for institutional records.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:bg-primary/90">
            Download PDF
          </button>
          <button className="px-4 py-2 border rounded-md font-semibold text-sm hover:bg-muted/30">
            Download Excel
          </button>
        </div>
      </Card>
    </div>
  );
}
