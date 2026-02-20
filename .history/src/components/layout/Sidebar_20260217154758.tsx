'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/exams', label: 'Exams', icon: FileText },
  { path: '/classes', label: 'Classes', icon: Users },
  { path: '/results', label: 'Results', icon: BarChart3 },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/archive', label: 'Archive', icon: Archive },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarContext();

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    router.push('/');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when a link is clicked
    setMobileOpen(false);
  };

  // Get first letter of email for avatar
  const getEmailInitial = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#3E5F44] border-b z-50 flex items-center px-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 hover:bg-[#2F4A35] rounded-md text-white"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <h1 className="ml-2 font-bold text-white text-sm">SIA</h1>
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
          "h-screen bg-[#3E5F44] flex flex-col transition-all duration-300 fixed left-0 top-0 z-40 border-r border-[#2F4A35]",
          // Desktop
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2F4A35]">
          {!collapsed && (
            <div className="overflow-hidden flex items-center gap-2">
              <div>
                <h1 className="font-bold text-white text-sm">SIA</h1>
                <p className="text-xs text-white/60 truncate">Exam & Quiz Builder</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || 
                            pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#4F7A6B] transition-colors",
                  isActive && "bg-[#4F7A6B] text-white border-l-4 border-[#F5E6C8]"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-[#2F4A35]">
          {!collapsed && user && (
            <div className="px-2 py-2 mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F5E6C8] rounded-md flex items-center justify-center text-[#3E5F44] font-bold text-sm">
                {getEmailInitial()}
              </div>
              <p className="text-sm font-medium text-white/80 truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="flex justify-center">
            <button
              onClick={handleSignOut}
              className="sidebar-item w-full justify-center text-left text-white/80 hover:text-white hover:bg-[#4F7A6B] transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Sign out</span>}
            </button>
          </div>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full border bg-white shadow-sm hover:bg-gray-100 p-0 text-[#3E5F44]"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-2.5 h-2.5" />
          ) : (
            <ChevronLeft className="w-2.5 h-2.5" />
          )}
        </Button>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={cn(
          "md:hidden h-screen bg-[#3E5F44] flex flex-col fixed left-0 top-12 z-40 border-r border-[#2F4A35] w-56 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || 
                            pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={handleNavClick}
                className={cn(
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#2F4A35] transition-colors",
                  isActive && "bg-[#2F4A35] text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#2F4A35]">
          {user && (
            <div className="px-3 py-2 mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F5E6C8] rounded-md flex items-center justify-center text-[#3E5F44] font-bold text-sm">
                {getEmailInitial()}
              </div>
              <p className="text-base font-medium text-white/80 truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="flex justify-center">
            <button
              onClick={handleSignOut}
              className="sidebar-item w-full justify-center text-left text-white/80 hover:text-white hover:bg-[#2F4A35] transition-colors"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}