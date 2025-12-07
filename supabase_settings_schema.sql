-- Buat tabel profiles (user profile) jika belum ada, atau tambahkan kolom
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT DEFAULT 'cashier',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Buat tabel settings (pengaturan toko)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE, -- 1 user (admin) punya 1 setting toko
    shop_name TEXT DEFAULT 'KasirMax',
    shop_logo_url TEXT, -- URL gambar custom, null = default KM
    is_premium BOOLEAN DEFAULT false,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS untuk settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada agar tidak error "already exists"
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.settings;
DROP POLICY IF EXISTS "Enable update for owners" ON public.settings;

-- Buat ulang policy
CREATE POLICY "Enable read for authenticated users" ON public.settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for owners" ON public.settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Trigger untuk membuat entry settings default saat user baru mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.settings (user_id, shop_name, is_premium)
  VALUES (new.id, 'KasirMax', false)
  ON CONFLICT (user_id) DO NOTHING; -- Hindari error jika settings sudah ada
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger profile creation (jika belum ada)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'admin')
  ON CONFLICT (id) DO NOTHING; -- Hindari error jika profil sudah ada
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_settings();

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_profile();
