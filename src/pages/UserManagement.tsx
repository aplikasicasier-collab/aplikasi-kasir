/**
 * User Management Page
 * 
 * Main page for managing users with:
 * - User list with search and filters
 * - User create/edit form modal
 * - Activity log viewer
 * - Reset password functionality
 * 
 * Requirements: 2.1, 3.1, 3.3
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertCircle, CheckCircle, Copy, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  UserList,
  UserFormModal,
  UserFormData,
  ActivityLog,
} from '../components/users';
import {
  UserOutletAssignmentModal,
  UserOutletAssignmentData,
} from '../components/outlet/UserOutletAssignmentModal';
import {
  User,
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} from '../api/users';
import { resetUserPassword } from '../api/auth';
import { assignUserToOutlets } from '../api/userOutlets';

type ViewMode = 'list' | 'activity';

interface TempPasswordModalProps {
  isOpen: boolean;
  password: string;
  userName: string;
  onClose: () => void;
}

/**
 * Modal to display temporary password after reset
 * Requirements 3.3: Show the temporary password only once
 */
const TempPasswordModal: React.FC<TempPasswordModalProps> = ({
  isOpen,
  password,
  userName,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Password Direset
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Password untuk <span className="font-medium text-gray-900 dark:text-white">{userName}</span> telah direset.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Password ini hanya ditampilkan sekali. Pastikan untuk menyimpannya.
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password Sementara
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-300 dark:border-gray-600">
              {password}
            </code>
            <Button
              size="sm"
              variant={copied ? 'primary' : 'outline'}
              onClick={handleCopy}
              title="Salin password"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          User akan diminta untuk mengubah password saat login berikutnya.
        </p>

        <Button onClick={onClose} className="w-full">
          Tutup
        </Button>
      </div>
    </div>
  );
};


const UserManagement: React.FC = () => {
  // State for users data
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [showUserForm, setShowUserForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [activityUserName, setActivityUserName] = useState<string>('');
  const [showOutletAssignment, setShowOutletAssignment] = useState(false);
  const [outletAssignmentUser, setOutletAssignmentUser] = useState<User | null>(null);

  // State for reset password modal
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [resetUserName, setResetUserName] = useState('');

  // State for view mode
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // State for action feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load users on mount
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Handle create new user
  const handleCreateNew = useCallback(() => {
    setSelectedUser(null);
    setShowUserForm(true);
  }, []);

  // Handle select user for edit
  const handleSelectUser = useCallback((user: User) => {
    setSelectedUser(user);
    setShowUserForm(true);
  }, []);

  // Handle save user (create or update)
  const handleSaveUser = useCallback(async (data: UserFormData) => {
    if (selectedUser) {
      // Update existing user
      await updateUser(selectedUser.id, {
        full_name: data.full_name,
        email: data.email,
        role: data.role,
      });
      setActionMessage({ type: 'success', text: 'User berhasil diperbarui' });
    } else {
      // Create new user
      await createUser({
        email: data.email,
        password: data.password!,
        full_name: data.full_name,
        role: data.role,
      });
      setActionMessage({ type: 'success', text: 'User berhasil dibuat' });
    }
    setShowUserForm(false);
    setSelectedUser(null);
    await loadUsers();
  }, [selectedUser, loadUsers]);


  // Handle reset password
  // Requirements 3.1: Generate temporary password
  // Requirements 3.3: Show temporary password only once
  const handleResetPassword = useCallback(async (user: User) => {
    // Confirm before resetting
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin mereset password untuk ${user.full_name}?\n\nUser akan diminta untuk mengubah password saat login berikutnya.`
    );
    
    if (!confirmed) return;

    try {
      const result = await resetUserPassword(user.id);
      setTempPassword(result.temporaryPassword);
      setResetUserName(user.full_name);
      setShowTempPassword(true);
      setActionMessage({ type: 'success', text: 'Password berhasil direset' });
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message || 'Gagal reset password' });
    }
  }, []);

  // Handle toggle user status (activate/deactivate)
  const handleToggleStatus = useCallback(async (user: User) => {
    const action = user.is_active ? 'menonaktifkan' : 'mengaktifkan';
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin ${action} ${user.full_name}?`
    );
    
    if (!confirmed) return;

    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        setActionMessage({ type: 'success', text: `${user.full_name} berhasil dinonaktifkan` });
      } else {
        await reactivateUser(user.id);
        setActionMessage({ type: 'success', text: `${user.full_name} berhasil diaktifkan` });
      }
      await loadUsers();
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message || 'Gagal mengubah status user' });
    }
  }, [loadUsers]);

  // Handle view activity log
  const handleViewActivity = useCallback((user: User) => {
    setActivityUserId(user.id);
    setActivityUserName(user.full_name);
    setViewMode('activity');
  }, []);

  // Handle assign outlet
  // Requirements 2.1, 2.2: Assign users to outlets
  const handleAssignOutlet = useCallback((user: User) => {
    setOutletAssignmentUser(user);
    setShowOutletAssignment(true);
  }, []);

  // Handle save outlet assignment
  const handleSaveOutletAssignment = useCallback(async (data: UserOutletAssignmentData) => {
    await assignUserToOutlets(data);
    setActionMessage({ type: 'success', text: 'Outlet berhasil di-assign ke user' });
    setShowOutletAssignment(false);
    setOutletAssignmentUser(null);
  }, []);

  // Handle close activity log
  const handleCloseActivity = useCallback(() => {
    setActivityUserId(null);
    setActivityUserName('');
    setViewMode('list');
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary-600" />
            User Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola pengguna dan hak akses aplikasi
          </p>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span
            className={`text-sm ${
              actionMessage.type === 'success'
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {actionMessage.text}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <Button size="sm" variant="outline" onClick={loadUsers} className="ml-auto">
            Coba Lagi
          </Button>
        </div>
      )}


      {/* Main Content */}
      {viewMode === 'list' ? (
        <Card className="p-6">
          <UserList
            users={users}
            loading={loading}
            onSelect={handleSelectUser}
            onCreateNew={handleCreateNew}
            onResetPassword={handleResetPassword}
            onToggleStatus={handleToggleStatus}
            onViewActivity={handleViewActivity}
            onAssignOutlet={handleAssignOutlet}
          />
        </Card>
      ) : (
        <Card className="p-6">
          <div className="mb-4">
            <Button variant="outline" onClick={handleCloseActivity}>
              ← Kembali ke Daftar User
            </Button>
          </div>
          {activityUserId && (
            <ActivityLog userId={activityUserId} userName={activityUserName} />
          )}
        </Card>
      )}

      {/* User Form Modal */}
      <UserFormModal
        isOpen={showUserForm}
        user={selectedUser}
        onSave={handleSaveUser}
        onClose={() => {
          setShowUserForm(false);
          setSelectedUser(null);
        }}
      />

      {/* Temporary Password Modal */}
      <TempPasswordModal
        isOpen={showTempPassword}
        password={tempPassword}
        userName={resetUserName}
        onClose={() => {
          setShowTempPassword(false);
          setTempPassword('');
          setResetUserName('');
        }}
      />

      {/* User Outlet Assignment Modal */}
      <UserOutletAssignmentModal
        isOpen={showOutletAssignment}
        user={outletAssignmentUser}
        onSave={handleSaveOutletAssignment}
        onClose={() => {
          setShowOutletAssignment(false);
          setOutletAssignmentUser(null);
        }}
      />
    </div>
  );
};

export default UserManagement;
