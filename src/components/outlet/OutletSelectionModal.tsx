/**
 * Outlet Selection Modal Component
 * 
 * Shows after login when user has multiple outlets and needs to select one
 * Requirements: 2.3, 2.4, 7.2, 7.3
 */

import React from 'react';
import { Store, MapPin, Check } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { Outlet } from '@/types';

interface OutletSelectionModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when an outlet is selected */
  onSelect?: (outlet: Outlet) => void;
}

export const OutletSelectionModal: React.FC<OutletSelectionModalProps> = ({
  isOpen,
  onSelect,
}) => {
  const { availableOutlets, setCurrentOutlet, currentOutlet } = useOutlet();

  if (!isOpen) {
    return null;
  }

  const handleSelectOutlet = (outlet: Outlet) => {
    setCurrentOutlet(outlet);
    onSelect?.(outlet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Pilih Outlet
          </h2>
          <p className="text-primary-100">
            Silakan pilih outlet untuk memulai sesi kerja Anda
          </p>
        </div>

        {/* Outlet List */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {availableOutlets.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => handleSelectOutlet(outlet)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                  currentOutlet?.id === outlet.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
                }`}
              >
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary-600" />
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                      {outlet.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {outlet.name}
                  </h3>
                  {outlet.address && (
                    <p className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{outlet.address}</span>
                    </p>
                  )}
                </div>

                {currentOutlet?.id === outlet.id && (
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Anda dapat mengganti outlet kapan saja melalui menu di header
          </p>
        </div>
      </div>
    </div>
  );
};

export default OutletSelectionModal;
