"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Archive,
  Settings,
  Menu,
  X,
  FileSpreadsheet,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/exams", label: "Exams", icon: FileText },
  { path: "/classes", label: "Class", icon: Users },
  { path: "/results", label: "Results", icon: BarChart3 },
  { path: "/templates", label: "Templates", icon: FileSpreadsheet },
  { path: "/logs", label: "Logs", icon: History },
  { path: "/archive", label: "Archive", icon: Archive },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } =
    useSidebarContext();

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    router.push("/");
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b z-50 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 hover:bg-muted rounded-md"
        >
          {mobileOpen ? (
            <X className="w-5 h-5 text-sidebar-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-sidebar-foreground" />
          )}
        </button>
        <h1 className="ml-3 font-bold text-sidebar-foreground">SIA</h1>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen bg-sidebar flex flex-col transition-all duration-300 fixed left-0 top-0 z-40 border-r border-sidebar-border",
          "hidden md:flex",
          collapsed ? "md:w-20" : "md:w-64",
        )}
      >
        {/* Header/Logo */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#BA8E23] flex items-center justify-center text-white font-bold text-xl shadow-lg">
              S
            </div>
            {!collapsed && (
              <span className="font-bold text-xl text-white tracking-wider">
                SIA
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group font-semibold",
                  isActive
                    ? "bg-[#BA8E23] text-white shadow-lg"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isActive
                      ? "text-white"
                      : "text-white/70 group-hover:text-white",
                  )}
                />
                {!collapsed && (
                  <span className="text-[15px]">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Profile */}
        <div className="p-4 mt-auto border-t border-white/10">
          {!collapsed && (
            <div className="bg-white/5 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#BA8E23] flex items-center justify-center text-white font-bold text-lg">
                  P
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Professor
                  </p>
                  <p className="text-[11px] text-white/50 truncate uppercase tracking-tighter">
                    Instructor
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/20 h-10 rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </div>
          )}
          {collapsed && (
            <button
              onClick={handleSignOut}
              className="w-12 h-12 mx-auto flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:bg-destructive/20 hover:text-destructive transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "md:hidden h-screen bg-sidebar flex flex-col fixed left-0 top-14 z-40 border-r border-sidebar-border w-64 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 font-semibold",
                  isActive
                    ? "bg-[#BA8E23] text-white shadow-lg"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 p-4 bg-white/5 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-[#BA8E23] flex items-center justify-center text-white font-bold">
              P
            </div>
            <div>
              <p className="text-sm font-bold text-white">Professor</p>
              <p className="text-xs text-white/50">Instructor</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            className="w-full justify-center gap-2 bg-white/5 hover:bg-destructive/20 text-white border border-white/20 h-12 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
