/**
 * Outlet Selector Component
 * 
 * Dropdown in header/navbar to show current outlet and allow switching
 * Requirements: 2.3, 2.4
 */

import React, { useState, useRef, useEffect } from 'react';
import { Store, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { Outlet } from '@/types';

interface OutletSelectorProps {
  onOutletChange?: (outlet: Outlet) => void;
  className?: string;
}

export const OutletSelector: React.FC<OutletSelectorProps> = ({
  onOutletChange,
  className = '',
}) => {
  const { currentOutlet, availableOutlets, setCurrentOutlet, isLoading } = useOutlet();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelectOutlet = (outlet: Outlet) => {
    setCurrentOutlet(outlet);
    setIsOpen(false);
    onOutletChange?.(outlet);
  };

  // Don't render if no outlets available
  if (!isLoading && availableOutlets.length === 0) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-gray-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Memuat outlet...</span>
      </div>
    );
  }

  // If only one outlet, show it without dropdown
  if (availableOutlets.length === 1) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
        <Store className="w-4 h-4 text-primary-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {currentOutlet?.name || availableOutlets[0].name}
        </span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Store className="w-4 h-4 text-primary-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
          {currentOutlet?.name || 'Pilih Outlet'}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          {availableOutlets.map((outlet) => (
            <button
              key={outlet.id}
              onClick={() => handleSelectOutlet(outlet)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                currentOutlet?.id === outlet.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
              }`}
              role="option"
              aria-selected={currentOutlet?.id === outlet.id}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {outlet.code}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {outlet.name}
                </p>
                {outlet.address && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {outlet.address}
                  </p>
                )}
              </div>
              {currentOutlet?.id === outlet.id && (
                <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OutletSelector;
