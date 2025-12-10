/**
 * Scan Result Toast Component
 * Shows success/error/warning feedback after barcode scan
 * Displays product info on success
 * Requirements: 4.1, 4.2, 4.3
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, X, Package } from 'lucide-react';
import { Product } from '../../types';

export interface ScanResultProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  product?: Product;
  duration?: number; // Auto-dismiss duration in ms
  onDismiss?: () => void;
}

export const ScanResultToast: React.FC<ScanResultProps> = ({
  type,
  message,
  product,
  duration = 3000,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800 dark:text-green-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`
            fixed top-4 left-1/2 transform -translate-x-1/2 z-50
            max-w-md w-full mx-4
            p-4 rounded-lg border shadow-lg
            ${getBackgroundColor()}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${getTextColor()}`}>
                {message}
              </p>
              
              {/* Product info on success - Requirement 4.1 */}
              {type === 'success' && product && (
                <div className="mt-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {product.barcode}
                    </span>
                    <span className="font-semibold text-primary-600">
                      Rp {product.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleDismiss}
              className={`flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 ${getTextColor()}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook for managing scan result toasts
 */
export interface ScanToastState {
  type: 'success' | 'error' | 'warning';
  message: string;
  product?: Product;
}

export const useScanResultToast = () => {
  const [toast, setToast] = useState<ScanToastState | null>(null);

  const showSuccess = (message: string, product?: Product) => {
    setToast({ type: 'success', message, product });
  };

  const showError = (message: string) => {
    setToast({ type: 'error', message });
  };

  const showWarning = (message: string, product?: Product) => {
    setToast({ type: 'warning', message, product });
  };

  const dismiss = () => {
    setToast(null);
  };

  return {
    toast,
    showSuccess,
    showError,
    showWarning,
    dismiss,
  };
};

export default ScanResultToast;
