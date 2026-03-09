'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Menu,
  X,
  AlertTriangle,
  Archive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/classes', label: 'Classes', icon: Users },
  { path: '/exams', label: 'Exams', icon: FileText },
  { path: '/results', label: 'Results', icon: BarChart3 },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/archive', label: 'Archive', icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarContext();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const prevPathRef = useRef(pathname);

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      setMobileOpen(false);
      prevPathRef.current = pathname;
    }
  }, [pathname, setMobileOpen]);

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    setShowSignOutModal(false);
    router.push('/');
  };

  const handleNavClick = () => {
    // Don't auto-close sidebar on nav click - user must toggle it manually
  };

  const getEmailInitial = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#166534] border-b z-50 flex items-center px-3 gap-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 hover:bg-[#1a7a3e] rounded-md text-white transition-colors"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">G</span>
        </div>
        <h1 className="font-bold text-white text-sm">GC SMART CHECK</h1>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30 pointer-events-none"
        />
      )}

      <aside 
        className={cn(
          "bg-[#166534] flex flex-col transition-all duration-300 fixed left-0 z-40 border-r border-[#F0E6D2]",
          // Desktop
          "hidden md:flex",
          "top-0 bottom-0",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >

        <div className="p-5 border-b border-[#F0E6D2]">
          {!collapsed ? (
            <div className="overflow-hidden flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <h1 className="font-bold text-white text-sm">GC SMART CHECK</h1>
                <p className="text-xs text-white/60 break-words">Exam & Quiz Builder</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">G</span>
              </div>
            </div>
          )}
        </div>

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
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#1a7a3e] transition-colors",
                  isActive && "bg-[#B38B00] text-white border-r-4 border-[#F0E6D2]"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-2 border-t border-[#F0E6D2] bg-[#166534]">
          {!collapsed && user && (
            <div className="px-2 py-2 mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#B38B00] rounded-md flex items-center justify-center text-white font-bold text-sm">
                {getEmailInitial()}
              </div>
              <p className="text-sm font-medium text-white/80 truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="w-full px-1">
            <button
              onClick={() => setShowSignOutModal(true)}
              className={cn(
                "w-full h-10 flex items-center text-white/80 border-2 rounded-lg hover:text-white hover:bg-emerald-700 hover:border-emerald-500 transition-all duration-200 active:scale-95",
                collapsed ? "justify-center px-2" : "justify-start px-3"
              )}
              style={{
                borderColor: "#F0E6D2",
                backgroundColor: "transparent",
                color: "white",
                minHeight: "40px",
                touchAction: "manipulation"
              }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: "#B38B00" }} />
              {!collapsed && <span className="text-sm ml-2 font-medium">Sign out</span>}
            </button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full border bg-white shadow-sm hover:bg-emerald-50 p-0 text-emerald-700"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-2.5 h-2.5" />
          ) : (
            <ChevronLeft className="w-2.5 h-2.5" />
          )}
        </Button>
      </aside>

      <aside 
        className={cn(
          "md:hidden fixed left-0 top-12 bg-[#166534] flex flex-col border-r border-[#F0E6D2] w-56 z-40 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ 
          height: 'calc(100vh - 3rem)',
          minHeight: 'calc(100vh - 3rem)'
        }}
      >

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0">
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
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#1a7a3e] transition-colors",
                  isActive && "bg-[#B38B00] text-white border-r-4 border-[#F0E6D2]"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-3 border-t border-[#F0E6D2] bg-[#166534] mt-auto">
          {user && (
            <div className="px-3 py-2 mb-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#B38B00] rounded-md flex items-center justify-center text-white font-bold text-sm">
                {getEmailInitial()}
              </div>
              <p className="text-sm font-medium text-white/80 truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="w-full">
              <button
                onClick={() => setShowSignOutModal(true)}
                className="w-full h-12 flex items-center justify-start text-left border-2 rounded-lg hover:text-white hover:bg-emerald-700 hover:border-emerald-500 active:bg-emerald-800 transition-all duration-200 px-4 py-3"
              style={{
                borderColor: "#10b981",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                minHeight: "48px",
                touchAction: "manipulation"
              }}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 mr-3" style={{ color: "#10b981" }} />
              <span className="font-medium text-base">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {showSignOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowSignOutModal(false)}>
          <div 
            className="absolute inset-0 bg-black/50 cursor-pointer" 
            onClick={() => setShowSignOutModal(false)}
            style={{ touchAction: 'manipulation' }}
          />
          <div 
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl p-6 sm:p-8"
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#F0E6D2', 
              borderWidth: '1px',
              boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.3)',
              touchAction: 'manipulation'
            }}
            onClick={(e) => e.stopPropagation()}
          >

            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#B38B00]/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#B38B00' }} />
              </div>
              
              <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: '#166534' }}>Sign Out</h2>
              <p className="text-sm sm:text-base mb-6" style={{ color: '#B38B00' }}>
                Are you sure you want to sign out? You'll need to log in again to access your exams and data.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="w-full h-12 px-4 py-2 rounded-xl font-medium transition-all duration-200 border-2 text-sm sm:text-base active:scale-95"
                  style={{ 
                    borderColor: '#F0E6D2',
                    color: '#166534',
                    backgroundColor: 'transparent',
                    touchAction: 'manipulation',
                    minHeight: '48px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full h-12 px-4 py-2 text-white hover:opacity-90 active:scale-95 rounded-xl font-medium transition-all duration-200 text-sm sm:text-base"
                  style={{ 
                    backgroundColor: '#166534',
                    boxShadow: '0 4px 8px -2px rgba(22, 101, 52, 0.2)',
                    touchAction: 'manipulation',
                    minHeight: '48px'
                  }}
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