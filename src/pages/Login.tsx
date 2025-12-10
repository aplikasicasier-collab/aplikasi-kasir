import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { BackgroundAnimation } from '../components/ui/BackgroundAnimation';
import { AppLogo } from '../components/ui/AppLogo';
import { login as authLogin } from '../api/auth';
import { ChangePasswordModal } from '../components/users/ChangePasswordModal';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  const storeLogin = useAuthStore((state) => state.login);
  const setMustChangePassword = useAuthStore((state) => state.setMustChangePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Use login function from auth API with activity logging (Requirement 7.3)
      const result = await authLogin({ email, password });
      
      // Store user in auth store
      storeLogin(result.user);
      
      // Handle must_change_password redirect (Requirement 3.2)
      if (result.mustChangePassword) {
        setShowChangePasswordModal(true);
      }
    } catch (err: any) {
      console.error(err);
      // Handle inactive user error (Requirement 2.3)
      // The auth API returns specific error messages for different scenarios
      setError(err.message || 'Login gagal. Periksa email dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    setShowChangePasswordModal(false);
    setMustChangePassword(false);
  };

  const handlePasswordChangeClose = () => {
    // User must change password, cannot close modal without changing
    // Keep modal open - they need to change password to continue
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundAnimation />
      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-8 animate-slide-in">
          {/* Logo Aplikasi */}
          <div className="mb-4 inline-block">
             <AppLogo size="xl" />
          </div>
          <p className="text-gray-300 mt-2">
            Sistem Kasir Modern untuk Bisnis Anda
          </p>
        </div>

        <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Card className="backdrop-blur-lg bg-white/10 border-white/20 shadow-glass">
            <CardHeader className="text-center border-white/20">
              <CardTitle className="text-white">Masuk ke Aplikasi</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Error message display (Requirements 2.3, 7.3) */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Email atau Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Masukkan email atau username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Masukkan password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-500 hover:to-gold-700 text-gray-900 font-semibold"
                >
                  Masuk
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  Hubungi administrator untuk mendapatkan akun.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Modal for must_change_password redirect (Requirement 3.2) */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={handlePasswordChangeClose}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
};

export default Login;
