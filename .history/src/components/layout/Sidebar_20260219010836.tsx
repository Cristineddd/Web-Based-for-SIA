'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
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
  AlertTriangle
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
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    setShowSignOutModal(false);
    router.push('/');
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const getEmailInitial = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-[#166534] border-b z-50 flex items-center px-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 hover:bg-[#B38B00] rounded-md text-white transition-colors"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <h1 className="ml-2 font-bold text-white text-sm">SIA</h1>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside 
        className={cn(
          "h-screen bg-[#166534] flex flex-col transition-all duration-300 fixed left-0 top-0 z-40 border-r border-[#F0E6D2]",
          // Desktop
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >

        <div className="p-5 border-b border-[#F0E6D2]">
          {!collapsed && (
            <div className="overflow-hidden flex items-center gap-3">
              <div>
                <h1 className="font-bold text-white text-sm">SIA</h1>
                <p className="text-xs text-white/60 truncate">Exam & Quiz Builder</p>
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
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#B38B00] transition-colors",
                  isActive && "bg-[#B38B00] text-white border-l-4 border-[#F0E6D2]"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[#F0E6D2]">
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
          <div className="flex justify-center">
            <button
              onClick={() => setShowSignOutModal(true)}
              className="sidebar-item w-full justify-center text-left text-white/80 border-2 rounded-lg hover:text-white hover:bg-[#B38B00] hover:border-[#B38B00] transition-all duration-200"
              style={{
                borderColor: "#F0E6D2",
                backgroundColor: "transparent",
                color: "white"
              }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" style={{ color: "#B38B00" }} />
              {!collapsed && <span className="text-sm">Sign out</span>}
            </button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full border bg-white shadow-sm hover:bg-[#FEF9E7] p-0 text-[#166534]"
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
          "md:hidden h-screen bg-[#166534] flex flex-col fixed left-0 top-12 z-40 border-r border-[#F0E6D2] w-56 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >

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
                  "sidebar-item text-white/80 hover:text-white hover:bg-[#B38B00] transition-colors",
                  isActive && "bg-[#B38B00] text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#F0E6D2]">
          {user && (
            <div className="px-3 py-2 mb-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#B38B00] rounded-md flex items-center justify-center text-white font-bold text-sm">
                {getEmailInitial()}
              </div>
              <p className="text-base font-medium text-white/80 truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="flex justify-center">
            <button
              onClick={() => setShowSignOutModal(true)}
              className="sidebar-item w-full justify-center text-left border-2 rounded-lg hover:text-white hover:bg-[#B38B00] hover:border-[#B38B00] transition-all duration-200"
              style={{
                borderColor: "#F0E6D2",
                backgroundColor: "#FEF9E7",
                color: "#166534"
              }}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" style={{ color: "#B38B00" }} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {showSignOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowSignOutModal(false)}
          />
          <div 
            className="relative w-full max-w-md rounded-2xl p-8"
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#F0E6D2', 
              borderWidth: '1px',
              boxShadow: '0 20px 40px -12px rgba(22, 101, 52, 0.3)'
            }}
          >

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#B38B00]/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" style={{ color: '#B38B00' }} />
              </div>
              
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#166534' }}>Sign Out</h2>
              <p className="text-sm mb-6" style={{ color: '#B38B00' }}>
                Are you sure you want to sign out? You'll need to log in again to access your exams and data.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 h-12 px-4 py-2 rounded-xl font-medium transition-all duration-200 border-2"
                  style={{ 
                    borderColor: '#F0E6D2',
                    color: '#166534',
                    backgroundColor: 'transparent'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 h-12 px-4 py-2 text-white hover:opacity-90 rounded-xl font-medium transition-all duration-200"
                  style={{ 
                    backgroundColor: '#166534',
                    boxShadow: '0 4px 8px -2px rgba(22, 101, 52, 0.2)'
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