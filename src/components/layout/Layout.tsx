import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeRoute, onNavigate }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeRoute={activeRoute} onNavigate={onNavigate} />
      <main className="flex-1 ml-64 overflow-auto">
        {children}
      </main>
    </div>
  );
};