/**
 * Barcode Input Component
 * Text input for external barcode scanners
 * Auto-submits on Enter key press
 * Requirements: 2.1, 2.4
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Barcode, X } from 'lucide-react';

export interface BarcodeInputProps {
  onSubmit: (barcode: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const BarcodeInput: React.FC<BarcodeInputProps> = ({
  onSubmit,
  autoFocus = true,
  placeholder = 'Scan atau ketik barcode...',
  disabled = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-focus on mount if enabled
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  // Handle form submission (Enter key)
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedValue = value.trim();
    if (!trimmedValue || isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Process within 100ms as per requirement 2.2
      await Promise.resolve(onSubmit(trimmedValue));
    } finally {
      // Clear input and refocus
      setValue('');
      setIsProcessing(false);
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [value, isProcessing, onSubmit]);

  // Handle key down for Enter key detection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Clear input
  const handleClear = () => {
    setValue('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isProcessing}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`
            w-full pl-10 pr-10 py-3 
            border border-gray-300 dark:border-gray-600 
            rounded-lg 
            focus:ring-2 focus:ring-primary-500 focus:border-transparent 
            bg-white dark:bg-gray-800 
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          `}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Hidden submit button for form submission */}
      <button type="submit" className="hidden" />
    </form>
  );
};

export default BarcodeInput;
