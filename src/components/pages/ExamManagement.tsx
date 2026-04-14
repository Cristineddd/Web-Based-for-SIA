import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

/* ...existing code... */

export default function ExamManagement() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <style>{`
            input:-webkit-autofill,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:active {
              -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
              box-shadow: 0 0 0 1000px #fff inset !important;
              border: 1px solid #e5e7eb !important;
              outline: none !important;
            }
            .search-override,
            .search-override:focus,
            .search-override:active {
              border-color: #e5e7eb !important;
              box-shadow: none !important;
              outline: none !important;
            }
          `}</style>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
          <Input
            placeholder="Search exams by title, class, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-override pl-12 h-12 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-gray-300"
            autoComplete="off"
          />
        </div>
      </div>
    </>
  );
}