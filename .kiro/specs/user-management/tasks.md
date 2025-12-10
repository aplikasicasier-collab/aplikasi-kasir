 # Implementation Plan

- [x] 1. Setup database schema for user management





  - [x] 1.1 Create SQL migration file for user_profiles and user_activity_logs tables


    - Add tables with proper constraints and foreign keys
    - Add RLS policies for role-based access
    - _Requirements: 1.1, 2.1, 7.1_


  - [x] 1.2 Run migration on Supabase





    - Execute SQL in Supabase dashboard or CLI
    - _Requirements: 1.1_

- [x] 2. Implement Permission Utilities







  - [x] 2.1 Create permission constants and role mapping


    - Define Permission type with all permissions
    - Create ROLE_PERMISSIONS mapping for admin, manager, kasir
    - _Requirements: 5.1, 5.2, 5.3_


  - [x] 2.2 Create permission check functions

    - Implement `hasPermission()` function
    - Implement `getAccessibleRoutes()` function
    - Implement `canAccessRoute()` function
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 2.3 Write property test for role permissions


    - **Property 10: Role-Based Permission Access**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 3. Implement User API





  - [x] 3.1 Create user validation functions


    - Implement email format validation
    - Implement password minimum length validation
    - Implement role validation
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 3.2 Write property tests for validation

    - **Property 2: Email Validation and Uniqueness**
    - **Property 3: Password Minimum Length Validation**
    - **Property 4: Role Validation**
    - **Validates: Requirements 1.2, 1.3, 1.5**
  - [x] 3.3 Create user CRUD functions


    - Implement `createUser()` with Supabase Auth integration
    - Implement `getUsers()` with filters
    - Implement `getUserById()`
    - Implement `updateUser()`
    - _Requirements: 1.1, 1.4, 2.1, 2.2_

  - [x] 3.4 Write property test for user CRUD

    - **Property 1: User Creation Data Persistence**
    - **Property 5: User Update Persistence**
    - **Validates: Requirements 1.1, 1.4, 2.2**
  - [x] 3.5 Implement user status management


    - Implement `deactivateUser()` function
    - Implement `reactivateUser()` function
    - _Requirements: 2.3, 2.4_
  - [x] 3.6 Write property test for user status


    - **Property 6: User Status and Login Access**
    - **Validates: Requirements 2.3, 2.4**
  - [x] 3.7 Implement user search


    - Add search by name or email
    - _Requirements: 2.5_
  - [x] 3.8 Write property test for user search


    - **Property 7: User Search Filtering**
    - **Validates: Requirements 2.5**

- [x] 4. Implement Auth API





  - [x] 4.1 Create login function with activity logging


    - Implement `login()` with Supabase Auth
    - Log login success/failure events
    - Check user is_active status
    - _Requirements: 2.3, 7.3_

  - [x] 4.2 Create logout function

    - Implement `logout()` with activity logging
    - Clear auth state
    - _Requirements: 7.3_

  - [x] 4.3 Create password management functions

    - Implement `changePassword()` with validation
    - Implement `resetUserPassword()` for admin
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.4 Write property tests for password management

    - **Property 8: Password Reset Flag**
    - **Property 9: Password Change Validation**
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.3**

- [x] 5. Implement Activity API






  - [x] 5.1 Create activity logging functions

    - Implement `logActivity()` function
    - Implement `getUserActivity()` with 30-day filter
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.2 Write property test for activity log

    - **Property 11: Activity Log Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 6. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update Auth Store






  - [x] 7.1 Extend auth store with permission checking

    - Add permission check methods
    - Add role-based route access
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Add must_change_password handling

    - Redirect to password change on login if flag is set
    - _Requirements: 3.2_

- [x] 8. Build User Management UI Components





  - [x] 8.1 Create User List component


    - Display users table with name, email, role, status, last login
    - Add search input
    - Add filter by role and status
    - _Requirements: 2.1, 2.5_
  - [x] 8.2 Create User Form Modal


    - Build form for create/edit user
    - Include email, password (create only), name, role fields
    - Add validation feedback
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2_
  - [x] 8.3 Create Activity Log component


    - Display activity table with event type, timestamp, IP
    - Filter to last 30 days
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 8.4 Create Change Password Modal


    - Build form with current password, new password, confirm
    - Add validation feedback
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 9. Build User Management Page





  - [x] 9.1 Create main User Management page


    - Integrate User List, User Form, Activity Log components
    - Add state management for selected user and modals
    - _Requirements: 2.1_

  - [x] 9.2 Add reset password functionality

    - Add reset button in user list
    - Show temporary password modal
    - _Requirements: 3.1, 3.3_

- [x] 10. Build Profile Page






  - [x] 10.1 Create Profile page

    - Display user info (name, email, role, created_at, last_login)
    - Add change password button
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.2 Integrate Change Password Modal

    - Connect to auth API
    - Handle success/error states
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 11. Implement Route Protection





  - [x] 11.1 Create ProtectedRoute component


    - Check authentication status
    - Check role-based access
    - Redirect unauthorized users
    - _Requirements: 5.4_

  - [x] 11.2 Update navigation menu

    - Show only accessible routes based on role
    - _Requirements: 5.5_

  - [x] 11.3 Update App.tsx routing

    - Wrap routes with ProtectedRoute
    - Add User Management and Profile routes
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 12. Update Login Page






  - [x] 12.1 Integrate with new auth API

    - Use login function with activity logging
    - Handle inactive user error
    - Handle must_change_password redirect
    - _Requirements: 2.3, 3.2, 7.3_



- [x] 13. Final Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
