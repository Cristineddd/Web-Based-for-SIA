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
  X,
  ArrowLeft
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

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 border-b z-50 flex items-center px-3" style={{ backgroundColor: '#3E5F44' }}>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 hover:bg-[#2E4A33] rounded-md"
        >
          {mobileOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
        </button>
        <div className="ml-2 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-white cursor-pointer hover:text-gray-200" />
          <h1 className="font-bold text-white text-sm">SIA</h1>
          <p className="text-xs text-gray-200 truncate">Exam & Quiz Builder</p>
        </div>
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
          "h-screen flex flex-col transition-all duration-300 fixed left-0 top-0 z-40 border-r",
          // Desktop
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-64",
        )}
        style={{ backgroundColor: '#3E5F44' }}
      >
        {/* Header */}
        <div className="p-3 border-b border-[#2E4A33]">
          {!collapsed && (
            <div className="overflow-hidden flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-white cursor-pointer hover:text-gray-200 flex-shrink-0" />
              <div>
                <h1 className="font-bold text-white text-sm">SIA</h1>
                <p className="text-xs text-gray-200 truncate">Exam & Quiz Builder</p>
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
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-[#2E4A33] text-white" 
                    : "text-gray-200 hover:bg-[#2E4A33] hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-[#2E4A33]">
          {!collapsed && user && (
            <div className="px-2 py-1.5 mb-1">
              <p className="text-xs font-medium text-gray-200 truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-200 hover:bg-[#2E4A33] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Sign out</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full border bg-white shadow-sm hover:bg-gray-100 p-0"
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
          "md:hidden h-screen flex flex-col fixed left-0 top-12 z-40 border-r w-56 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: '#3E5F44' }}
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
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive 
                    ? "bg-[#2E4A33] text-white" 
                    : "text-gray-200 hover:bg-[#2E4A33] hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#2E4A33]">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-200 hover:bg-[#2E4A33] hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}