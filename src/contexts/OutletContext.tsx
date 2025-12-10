import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet } from '@/types';
import { getUserOutlets, getDefaultOutlet } from '@/api/userOutlets';
import { getOutlets } from '@/api/outlets';
import { useAuthStore } from '@/stores/authStore';

/**
 * Outlet Context Value Interface
 * Requirements: 2.3, 2.4, 7.2
 */
export interface OutletContextValue {
  /** Currently selected outlet */
  currentOutlet: Outlet | null;
  /** List of outlets available to the current user */
  availableOutlets: Outlet[];
  /** Set the current outlet */
  setCurrentOutlet: (outlet: Outlet) => void;
  /** Loading state for outlet data */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh available outlets */
  refreshOutlets: () => Promise<void>;
  /** Whether user needs to select an outlet */
  needsOutletSelection: boolean;
}

const OutletContext = createContext<OutletContextValue | undefined>(undefined);

const OUTLET_STORAGE_KEY = 'selected-outlet';

interface OutletProviderProps {
  children: React.ReactNode;
}

/**
 * OutletProvider - Provides outlet context to the application
 * 
 * Features:
 * - Loads user's assigned outlets on mount (Requirements: 2.3)
 * - Auto-selects default outlet if set (Requirements: 7.2)
 * - Persists selected outlet to localStorage
 * - Admin users get access to all outlets (Requirements: 2.5)
 */
export function OutletProvider({ children }: OutletProviderProps): JSX.Element {
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, isAuthenticated } = useAuthStore();


  /**
   * Load outlets for the current user
   * Admin users get all outlets, others get assigned outlets only
   * Requirements: 2.3, 2.5
   */
  const loadOutlets = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setAvailableOutlets([]);
      setCurrentOutletState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let outlets: Outlet[];

      // Admin users have access to all outlets (Requirements: 2.5)
      if (user.role === 'admin') {
        outlets = await getOutlets(false); // Only active outlets
      } else {
        // Non-admin users only see assigned outlets (Requirements: 2.3)
        outlets = await getUserOutlets(user.id);
        // Filter to only active outlets
        outlets = outlets.filter(outlet => outlet.is_active);
      }

      setAvailableOutlets(outlets);

      // Try to restore previously selected outlet from localStorage
      const storedOutletId = localStorage.getItem(OUTLET_STORAGE_KEY);
      const storedOutlet = storedOutletId 
        ? outlets.find(o => o.id === storedOutletId) 
        : null;

      if (storedOutlet) {
        setCurrentOutletState(storedOutlet);
      } else if (outlets.length > 0) {
        // Try to get default outlet (Requirements: 7.2)
        const defaultOutlet = await getDefaultOutlet(user.id);
        
        if (defaultOutlet && outlets.some(o => o.id === defaultOutlet.id)) {
          // Auto-select default outlet
          setCurrentOutletState(defaultOutlet);
          localStorage.setItem(OUTLET_STORAGE_KEY, defaultOutlet.id);
        } else if (outlets.length === 1) {
          // Auto-select if only one outlet available
          setCurrentOutletState(outlets[0]);
          localStorage.setItem(OUTLET_STORAGE_KEY, outlets[0].id);
        }
        // If multiple outlets and no default, user needs to select (Requirements: 2.4)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load outlets';
      setError(message);
      console.error('Failed to load outlets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  /**
   * Set the current outlet and persist to localStorage
   * Requirements: 2.4
   */
  const setCurrentOutlet = useCallback((outlet: Outlet) => {
    setCurrentOutletState(outlet);
    localStorage.setItem(OUTLET_STORAGE_KEY, outlet.id);
  }, []);

  /**
   * Refresh available outlets
   */
  const refreshOutlets = useCallback(async () => {
    await loadOutlets();
  }, [loadOutlets]);

  // Load outlets when user changes or authenticates
  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  // Clear outlet data on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentOutletState(null);
      setAvailableOutlets([]);
      localStorage.removeItem(OUTLET_STORAGE_KEY);
    }
  }, [isAuthenticated]);

  /**
   * Determine if user needs to select an outlet
   * True when: user has multiple outlets, no current selection, and not loading
   * Requirements: 2.4, 7.3
   */
  const needsOutletSelection = useMemo(() => {
    return (
      isAuthenticated &&
      !isLoading &&
      availableOutlets.length > 1 &&
      currentOutlet === null
    );
  }, [isAuthenticated, isLoading, availableOutlets.length, currentOutlet]);

  const value = useMemo<OutletContextValue>(() => ({
    currentOutlet,
    availableOutlets,
    setCurrentOutlet,
    isLoading,
    error,
    refreshOutlets,
    needsOutletSelection,
  }), [
    currentOutlet,
    availableOutlets,
    setCurrentOutlet,
    isLoading,
    error,
    refreshOutlets,
    needsOutletSelection,
  ]);

  return (
    <OutletContext.Provider value={value}>
      {children}
    </OutletContext.Provider>
  );
}

/**
 * useOutlet hook - Provides easy access to outlet context
 * Requirements: 2.3
 * 
 * @throws Error if used outside of OutletProvider
 */
export function useOutlet(): OutletContextValue {
  const context = useContext(OutletContext);
  
  if (context === undefined) {
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  
  return context;
}

export default OutletContext;
