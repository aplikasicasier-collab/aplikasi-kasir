/**
 * Activity Log Component
 * 
 * Display activity table with event type, timestamp, IP
 * Filter to last 30 days
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import React, { useEffect, useState } from 'react';
import { Activity, Loader2, AlertCircle, LogIn, LogOut, Key, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { ActivityLog as ActivityLogType, getUserActivity, ActivityEventType } from '@/api/activity';

interface ActivityLogProps {
  userId: string;
  userName?: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ userId, userName }) => {
  const [activities, setActivities] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get last 30 days of activity (Requirement 7.2)
      const data = await getUserActivity(userId, 30);
      setActivities(data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat activity log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadActivities();
    }
  }, [userId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventIcon = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'login_success':
        return <LogIn className="w-4 h-4 text-green-500" />;
      case 'login_failure':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'logout':
        return <LogOut className="w-4 h-4 text-blue-500" />;
      case 'password_change':
        return <Key className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getEventLabel = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'login_success':
        return 'Login Berhasil';
      case 'login_failure':
        return 'Login Gagal';
      case 'logout':
        return 'Logout';
      case 'password_change':
        return 'Ubah Password';
      default:
        return eventType;
    }
  };

  const getEventBadgeClass = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'login_success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'login_failure':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'logout':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'password_change':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Log
            {userName && <span className="text-gray-500 font-normal"> - {userName}</span>}
          </h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadActivities}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Info */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Menampilkan aktivitas 30 hari terakhir
      </p>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Tidak ada aktivitas dalam 30 hari terakhir
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Event
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Waktu
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  IP Address
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  User Agent
                </th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr
                  key={activity.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getEventIcon(activity.event_type)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventBadgeClass(activity.event_type)}`}>
                        {getEventLabel(activity.event_type)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                    {formatDate(activity.created_at)}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm font-mono">
                    {activity.ip_address || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm max-w-xs truncate" title={activity.user_agent || undefined}>
                    {activity.user_agent ? (
                      <span className="truncate block">{activity.user_agent}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!loading && activities.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Total {activities.length} aktivitas
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
