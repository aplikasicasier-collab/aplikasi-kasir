import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export interface ShopSettings {
  id: string;
  user_id: string;
  shop_name: string;
  shop_logo_url?: string | null;
  is_premium: boolean;
  address?: string;
  phone?: string;
  receipt_footer?: string;
  receipt_paper_size?: string;
  tax_rate?: number;
  service_charge_rate?: number;
}

interface SettingsState {
  settings: ShopSettings | null;
  loading: boolean;
  fetchSettings: (userId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<ShopSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  fetchSettings: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // Jika belum ada settings, mungkin trigger gagal, buat manual (fallback)
        if (error.code === 'PGRST116') {
           // Insert default
           const { data: newData, error: insertError } = await supabase
             .from('settings')
             .insert([{ user_id: userId, shop_name: 'KasirMax', is_premium: false }])
             .select()
             .single();
           if (!insertError) set({ settings: newData });
        }
      } else {
        set({ settings: data });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      set({ loading: false });
    }
  },
  updateSettings: async (newSettings) => {
    const current = get().settings;
    if (!current) return;
    
    // Validasi Premium: Jika tidak premium, paksa nama 'KasirMax' dan logo null
    if (!current.is_premium) {
       // Kecuali kita sedang mengupdate status premium itu sendiri (misal oleh admin via backend, tapi di sini client side)
       // Di client side, user non-premium tidak boleh ganti nama/logo.
       if (newSettings.shop_name && newSettings.shop_name !== 'KasirMax') {
         throw new Error('Upgrade ke Premium untuk mengubah nama toko.');
       }
       if (newSettings.shop_logo_url) {
         throw new Error('Upgrade ke Premium untuk mengubah logo toko.');
       }
    }

    const { error } = await supabase
      .from('settings')
      .update(newSettings)
      .eq('id', current.id);
      
    if (!error) {
      set({ settings: { ...current, ...newSettings } });
    } else {
      throw error;
    }
  }
}));
