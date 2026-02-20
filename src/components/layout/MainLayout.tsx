'use client';

import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebarContext } from '@/contexts/SidebarContext';
import { ReactNode } from 'react';

function MainLayoutContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarContext();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <Sidebar />
        <main className={`flex-1 overflow-auto bg-background transition-all duration-300 pt-14 md:pt-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'} p-2 sm:p-3 md:p-4`}>
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
