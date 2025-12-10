import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Store, 
  Upload, 
  Save, 
  Crown, 
  MapPin, 
  Phone, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ReturnPolicyForm } from '../components/retur';
import { RetentionSettings } from '../components/audit';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabaseClient';

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { settings, fetchSettings, updateSettings, loading } = useSettingsStore();
  
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      fetchSettings(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name);
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (!settings?.is_premium) {
      alert('Fitur upload logo hanya untuk pengguna Premium!');
      return;
    }

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      
      await updateSettings({ shop_logo_url: data.publicUrl });
      alert('Logo berhasil diperbarui!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert('Gagal mengupload logo: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage('');
    try {
      await updateSettings({
        shop_name: shopName,
        address,
        phone
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      setErrorMessage(error.message);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 mt-12 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-2">
          Pengaturan Toko
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Kelola profil toko, branding, dan informasi kontak.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branding Section */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Store className="w-5 h-5 mr-2 text-primary-600" />
                  Identitas Toko
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Premium Banner */}
                {!settings?.is_premium && (
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-4 text-white flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-white/10 rounded-lg mr-3">
                        <Crown className="w-6 h-6 text-gold-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gold-400">Upgrade ke Premium</h3>
                        <p className="text-xs text-gray-300">Buka fitur ganti nama & logo toko custom</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-gold-500 text-black hover:bg-gold-600 border-none"
                      onClick={() => alert('Hubungi admin untuk upgrade!')}
                    >
                      Upgrade
                    </Button>
                  </div>
                )}

                {/* Logo Upload */}
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                      {settings?.shop_logo_url ? (
                        <img 
                          src={settings.shop_logo_url} 
                          alt="Shop Logo" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-8 h-8 text-gray-400" />
                      )}
                      
                      {/* Overlay Upload */}
                      {settings?.is_premium && (
                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200">
                          <Upload className="w-6 h-6 text-white" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>
                    {isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Toko
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      disabled={!settings?.is_premium}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Nama Toko Anda"
                    />
                    {!settings?.is_premium && (
                      <p className="text-xs text-red-500 mt-1 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Fitur Premium
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        Alamat
                      </div>
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Alamat lengkap toko..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-1 text-gray-400" />
                        Nomor Telepon
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0812..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4">
                  {errorMessage && (
                    <p className="text-sm text-red-500 mr-4">{errorMessage}</p>
                  )}
                  {saveStatus === 'success' && (
                    <p className="text-sm text-green-600 mr-4">Perubahan disimpan!</p>
                  )}
                  <Button
                    onClick={handleSave}
                    isLoading={saveStatus === 'saving'}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Simpan Perubahan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Return Policy Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ReturnPolicyForm />
          </motion.div>

          {/* Audit Log Retention Settings - Admin Only */}
          {user?.role === 'admin' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <RetentionSettings />
            </motion.div>
          )}
        </div>

        {/* Info Panel */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-blue-50 border-blue-100">
              <CardHeader>
                <CardTitle className="text-blue-800 text-lg">Informasi Akun</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-blue-100">
                    <span className="text-blue-600">Email</span>
                    <span className="font-medium text-blue-900">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-blue-100">
                    <span className="text-blue-600">Role</span>
                    <span className="font-medium text-blue-900 capitalize">{user?.role}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-blue-100">
                    <span className="text-blue-600">Status Toko</span>
                    <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${settings?.is_premium ? 'bg-gold-100 text-gold-700' : 'bg-gray-200 text-gray-600'}`}>
                      {settings?.is_premium ? 'Premium' : 'Free Plan'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-blue-600">Bergabung</span>
                    <span className="font-medium text-blue-900">
                      {new Date(user?.created_at || '').toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
