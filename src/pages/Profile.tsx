/**
 * Profile Page
 * 
 * Display user info (name, email, role, created_at, last_login)
 * Add change password button
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import React, { useState } from 'react';
import { User as UserIcon, Mail, Shield, Calendar, Clock, Key, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChangePasswordModal } from '../components/users/ChangePasswordModal';
import { useAuthStore } from '../stores/authStore';

/**
 * Format date to Indonesian locale
 */
const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Format datetime to Indonesian locale with time
 */
const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return 'Belum pernah login';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get role display name in Indonesian
 */
const getRoleDisplayName = (role: string): string => {
  const roleNames: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    kasir: 'Kasir',
  };
  return roleNames[role] || role;
};


/**
 * Get role badge color
 */
const getRoleBadgeColor = (role: string): string => {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    kasir: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };
  return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

interface ProfileInfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

const ProfileInfoItem: React.FC<ProfileInfoItemProps> = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 rounded-lg">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 text-gray-900 dark:text-white">{value}</div>
    </div>
  </div>
);

const Profile: React.FC = () => {
  const { user } = useAuthStore();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Handle password change success
  const handlePasswordChangeSuccess = () => {
    setPasswordChanged(true);
    setTimeout(() => setPasswordChanged(false), 3000);
  };

  if (!user) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Silakan login untuk melihat profil Anda.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserIcon className="w-7 h-7 text-primary-600" />
          Profil Saya
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Lihat informasi akun dan kelola keamanan
        </p>
      </div>

      {/* Success Message */}
      {passwordChanged && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-400">
            Password berhasil diubah
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Informasi Akun
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name - Requirement 6.1 */}
            <ProfileInfoItem
              icon={<UserIcon className="w-5 h-5 text-primary-600" />}
              label="Nama Lengkap"
              value={user.full_name}
            />

            {/* Email - Requirement 6.1 */}
            <ProfileInfoItem
              icon={<Mail className="w-5 h-5 text-primary-600" />}
              label="Email"
              value={user.email}
            />

            {/* Role - Requirement 6.1 */}
            <ProfileInfoItem
              icon={<Shield className="w-5 h-5 text-primary-600" />}
              label="Role"
              value={
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                  {getRoleDisplayName(user.role)}
                </span>
              }
            />

            {/* Last Login - Requirement 6.1 */}
            <ProfileInfoItem
              icon={<Clock className="w-5 h-5 text-primary-600" />}
              label="Login Terakhir"
              value={formatDateTime(user.last_login_at)}
            />

            {/* Account Creation Date - Requirement 6.3 */}
            <ProfileInfoItem
              icon={<Calendar className="w-5 h-5 text-primary-600" />}
              label="Tanggal Bergabung"
              value={formatDate(user.created_at)}
            />
          </div>
        </Card>

        {/* Security Card - Requirement 6.2 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Keamanan
          </h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ubah password untuk keamanan akun
                  </p>
                </div>
              </div>
              
              {/* Change Password Button - Requirement 6.2 */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowChangePassword(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                Ubah Password
              </Button>
            </div>

            {/* Account Status */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Status Akun
              </p>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium ${
                user.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {user.is_active ? 'Aktif' : 'Tidak Aktif'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Change Password Modal - Requirement 6.2, 4.1, 4.2, 4.3, 4.4 */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default Profile;
