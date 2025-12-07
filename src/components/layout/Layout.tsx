import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeRoute, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  // Tutup sidebar saat route berubah (khusus mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeRoute]);

  // Handle Scroll untuk Auto-hide/Show Navbar
  useEffect(() => {
    const handleScroll = () => {
      if (!mainRef.current) return;
      
      const currentScrollY = mainRef.current.scrollTop;
      
      // Jika scroll ke bawah lebih dari 50px, sembunyikan navbar
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowNavbar(false);
      } 
      // Jika scroll ke atas, tampilkan navbar
      else {
        setShowNavbar(true);
      }

      setLastScrollY(currentScrollY);
    };

    const mainElement = mainRef.current;
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [lastScrollY]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Navbar Mobile (Floating/Sticky) */}
      <div 
        className={`md:hidden fixed top-0 left-0 right-0 z-50 p-4 transition-transform duration-300 ease-in-out ${
          showNavbar ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-200"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay Gelap saat Sidebar Terbuka di Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Gunakan layout flex yang benar untuk desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 
        md:relative md:translate-x-0 
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar activeRoute={activeRoute} onNavigate={onNavigate} />
      </div>

      {/* Konten Utama */}
      <main 
        ref={mainRef}
        className="flex-1 w-full md:ml-0 overflow-y-auto overflow-x-hidden h-full scroll-smooth"
      >
        <div className="pt-20 md:pt-0 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
