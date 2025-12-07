import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 'md' }) => {
  const { settings } = useSettingsStore();

  // Ukuran ikon based on props
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
  };

  // Ukuran teks di dalam ikon KM
  const iconTextSizes = {
    sm: 'text-xs',
    md: 'text-xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  };

  // Ukuran teks KasirMax based on props
  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-5xl',
  };

  // Default Logo (KasirMax)
  const DefaultLogo = () => (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${iconSizes[size]} bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-2xl ring-4 ring-white/10`}>
        <span className={`font-black text-white font-sans tracking-tighter leading-none ${iconTextSizes[size]}`}>
          KM
        </span>
      </div>
      <span className={`font-bold text-white font-sans tracking-tight ${textSizes[size]}`}>
        KasirMax
      </span>
    </div>
  );

  // Custom Logo (Premium)
  const CustomLogo = () => (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {settings?.shop_logo_url ? (
         <img 
           src={settings.shop_logo_url} 
           alt={settings.shop_name} 
           className={`${iconSizes[size]} object-cover rounded-2xl mb-4 shadow-xl`}
         />
      ) : (
        // Fallback icon for custom name but no image
        <div className={`${iconSizes[size]} bg-gradient-purple rounded-2xl flex items-center justify-center mb-4 shadow-xl`}>
          <span className="font-bold text-white font-sans uppercase tracking-tighter">
            {settings?.shop_name?.substring(0, 2) || 'KM'}
          </span>
        </div>
      )}
      <span className={`font-bold text-white font-sans tracking-tight ${textSizes[size]}`}>
        {settings?.shop_name}
      </span>
    </div>
  );

  // Logic: Kalau belum login (settings null) ATAU belum premium -> Tampilkan Default
  if (!settings || !settings.is_premium) {
    return <DefaultLogo />;
  }

  return <CustomLogo />;
};
