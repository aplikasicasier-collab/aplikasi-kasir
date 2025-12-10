/**
 * ProtectedRoute Component
 * 
 * Provides route protection based on:
 * - Authentication status
 * - Role-based access control
 * - Redirects unauthorized users
 * 
 * Requirements: 5.4
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoute?: string;
}

/**
 * ProtectedRoute wraps routes that require authentication and authorization
 * 
 * @param children - The component to render if authorized
 * @param requiredRoute - Optional route path to check access for (defaults to current path)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRoute 
}) => {
  const location = useLocation();
  const { isAuthenticated, user, canAccessRoute, mustChangePassword } = useAuthStore();

  // Check authentication status
  if (!isAuthenticated || !user) {
    // Redirect to login, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user must change password (Requirement 3.2)
  // Allow access to profile page for password change
  if (mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" state={{ mustChangePassword: true }} replace />;
  }

  // Check role-based access (Requirements 5.1, 5.2, 5.3)
  const routeToCheck = requiredRoute || location.pathname;
  
  // Normalize route for checking (handle /inventori vs /inventory)
  const normalizedRoute = normalizeRoute(routeToCheck);
  
  if (!canAccessRoute(normalizedRoute)) {
    // Redirect to dashboard with access denied message (Requirement 5.4)
    return (
      <Navigate 
        to="/" 
        state={{ accessDenied: true, attemptedRoute: routeToCheck }} 
        replace 
      />
    );
  }

  return <>{children}</>;
};

/**
 * Normalize route paths for permission checking
 * Maps UI routes to permission routes
 */
function normalizeRoute(route: string): string {
  const routeMap: Record<string, string> = {
    '/inventori': '/inventory',
    '/pengaturan': '/settings',
    '/users': '/users',
    '/user-management': '/users',
  };
  
  return routeMap[route] || route;
}

export default ProtectedRoute;
