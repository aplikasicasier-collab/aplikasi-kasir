import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { 
  hasPermission as checkPermission, 
  canAccessRoute as checkRouteAccess,
  getAccessibleRoutes as getRoutes,
  Permission,
  Role
} from '../lib/permissions';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  
  // Actions
  login: (user: User) => void;
  logout: () => void;
  setMustChangePassword: (value: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  
  // Permission checking methods (Requirements 5.1, 5.2, 5.3)
  hasPermission: (permission: Permission) => boolean;
  canAccessRoute: (route: string) => boolean;
  getAccessibleRoutes: () => string[];
  getUserRole: () => Role | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      mustChangePassword: false,
      
      // Login action - sets user and checks must_change_password flag (Requirement 3.2)
      login: (user) => set({ 
        user, 
        isAuthenticated: true,
        mustChangePassword: user.must_change_password || false
      }),
      
      // Logout action - clears all auth state
      logout: () => set({ 
        user: null, 
        isAuthenticated: false,
        mustChangePassword: false
      }),
      
      // Set must change password flag (Requirement 3.2)
      setMustChangePassword: (value) => set({ mustChangePassword: value }),
      
      // Update user data
      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ 
            user: { ...currentUser, ...userData },
            mustChangePassword: userData.must_change_password ?? get().mustChangePassword
          });
        }
      },
      
      // Check if current user has a specific permission (Requirements 5.1, 5.2, 5.3)
      hasPermission: (permission) => {
        const user = get().user;
        if (!user || !user.role) {
          return false;
        }
        return checkPermission(user.role, permission);
      },
      
      // Check if current user can access a specific route (Requirements 5.1, 5.2, 5.3)
      canAccessRoute: (route) => {
        const user = get().user;
        if (!user || !user.role) {
          return false;
        }
        return checkRouteAccess(user.role, route);
      },
      
      // Get all routes accessible by current user (Requirements 5.1, 5.2, 5.3)
      getAccessibleRoutes: () => {
        const user = get().user;
        if (!user || !user.role) {
          return [];
        }
        return getRoutes(user.role);
      },
      
      // Get current user's role
      getUserRole: () => {
        const user = get().user;
        if (!user || !user.role) {
          return null;
        }
        return user.role as Role;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        mustChangePassword: state.mustChangePassword
      }),
    }
  )
);
