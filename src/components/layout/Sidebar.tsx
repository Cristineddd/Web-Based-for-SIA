"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  AlertTriangle,
  Archive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { getClasses } from "@/services/classService";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/classes", label: "Classes", icon: Users },
  { path: "/exams", label: "Exams", icon: FileText },
  { path: "/results", label: "Results", icon: BarChart3 },
  { path: "/archive", label: "Archive", icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { collapsed, setCollapsed } = useSidebarContext();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [classCount, setClassCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchClassCount() {
      if (!user?.id) return;
      try {
        const classes = await getClasses(user.id);
        setClassCount(classes.length);
      } catch (error) {
        console.error("Error fetching class count for sidebar:", error);
      }
    }
    fetchClassCount();
  }, [user?.id]);

  const handleSignOut = () => {
    signOut();
    setShowSignOutModal(false);
    router.push("/");
  };

  const getEmailInitial = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-3 shadow-sm safe-area-inset-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <Image
              src="/gclogo.png"
              alt="GC Logo"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <h1 className="font-bold text-green-700 text-sm">GC SMART CHECK</h1>
        </div>
        
        {/* User avatar with sign out */}
        {user && (
          <button
            onClick={() => setShowSignOutModal(true)}
            className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs hover:bg-green-700 transition-colors"
            title={user.email}
          >
            {getEmailInitial()}
          </button>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "bg-white flex flex-col transition-all duration-300 fixed left-0 z-40 border-r border-gray-200 shadow-sm",
          "hidden md:flex",
          "top-0 bottom-0",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          {!collapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-green-50 rounded-xl">
                <Image
                  src="/gclogo.png"
                  alt="GC Logo"
                  width={30}
                  height={30}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 text-sm leading-tight">
                  GC SMART CHECK
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Exam &amp; Quiz Builder
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 flex items-center justify-center bg-green-50 rounded-xl">
                <Image
                  src="/gclogo.png"
                  alt="GC Logo"
                  width={26}
                  height={26}
                  className="object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");
            const isDisabled = item.path === "/exams" && classCount === 0;

            const content = (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-green-50 text-green-700 border-l-[3px] border-green-600 pl-[9px]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
                  isDisabled &&
                    "opacity-50 cursor-not-allowed grayscale pointer-events-none hover:bg-transparent hover:text-gray-500",
                )}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] flex-shrink-0",
                    isActive ? "text-green-600" : "text-gray-400",
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );

            if (isDisabled) {
              return (
                <div key={item.path} title="Create at least one class to access exams">
                  {content}
                </div>
              );
            }

            return (
              <Link key={item.path} href={item.path}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-4 border-t border-gray-100 space-y-1">
          {/* User Info */}
          {!collapsed && user && (
            <div className="px-3 py-2 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {getEmailInitial()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user.displayName || "Faculty"}
                  </p>
                  <p 
                    className="text-xs text-gray-500 truncate cursor-help" 
                    title={user.email}
                  >
                    {user.instructorId || user.email?.split('@')[0]}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {collapsed && user && (
            <div className="flex justify-center mb-2">
              <div 
                className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-help"
                title={user.email}
              >
                {getEmailInitial()}
              </div>
            </div>
          )}

          {/* Divider before Sign Out */}
          <div className="border-t border-gray-100 my-2" />

          {/* Sign Out Button */}
          <button
            onClick={() => setShowSignOutModal(true)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-150",
              collapsed && "justify-center",
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-green-50 p-0 text-green-700"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-2.5 h-2.5" />
          ) : (
            <ChevronLeft className="w-2.5 h-2.5" />
          )}
        </Button>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-3 safe-area-inset-bottom">
        <div className="bg-white rounded-[28px] shadow-[0_-2px_20px_rgba(0,0,0,0.08)] mx-auto border border-gray-200/50 overflow-hidden">
          <div className="flex items-center justify-between h-[64px] px-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path || pathname.startsWith(item.path + "/");
              const isDisabled = item.path === "/exams" && classCount === 0;

              const content = (
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 rounded-2xl transition-all duration-200 relative",
                    isActive && "scale-105",
                    isDisabled && "opacity-30 cursor-not-allowed grayscale pointer-events-none",
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
                      isActive
                        ? "bg-green-600 shadow-lg shadow-green-600/30"
                        : "bg-transparent",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[22px] h-[22px] flex-shrink-0 transition-all duration-200",
                        isActive ? "text-white" : "text-gray-500",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-all duration-200 leading-none",
                      isActive ? "text-green-700" : "text-gray-500",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );

              if (isDisabled) {
                return (
                  <div key={item.path} className="flex-1 min-w-0" title="Create at least one class to access exams">
                    {content}
                  </div>
                );
              }

              return (
                <Link key={item.path} href={item.path} className="flex-1 min-w-0">
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Sign out modal */}
      {showSignOutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setShowSignOutModal(false)
          }
        >
          <div
            className="absolute inset-0 bg-black/40 cursor-pointer"
            onClick={() => setShowSignOutModal(false)}
          />
          <div
            className="relative w-full max-w-sm bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Sign Out</h2>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to sign out? You&apos;ll need to log in
                again to access your exams and data.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
