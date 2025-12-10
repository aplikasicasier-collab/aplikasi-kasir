-- =====================================================
-- KATEGORI & SUPPLIER - Database Schema Migration
-- Tables: categories, suppliers
-- =====================================================

-- Buat tabel categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat tabel suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEX untuk performa query
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS pada semua tabel
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.categories;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.suppliers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.suppliers;

-- Policies untuk categories
CREATE POLICY "Enable read access for all users" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.categories
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.categories
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.categories
    FOR DELETE USING (auth.role() = 'authenticated');

-- Policies untuk suppliers
CREATE POLICY "Enable read access for all users" ON public.suppliers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.suppliers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.suppliers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.suppliers
    FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- Seed Data (Data Awal)
-- =====================================================

INSERT INTO public.categories (name, description) VALUES
    ('Makanan', 'Produk makanan dan snack'),
    ('Minuman', 'Produk minuman'),
    ('Rokok', 'Produk rokok dan tembakau'),
    ('Kebutuhan Rumah', 'Produk kebutuhan rumah tangga'),
    ('Lainnya', 'Produk lainnya')
ON CONFLICT DO NOTHING;

INSERT INTO public.suppliers (name, contact_person, phone, email) VALUES
    ('PT Indofood', 'Budi Santoso', '021-12345678', 'supplier@indofood.com'),
    ('PT Unilever', 'Siti Rahayu', '021-87654321', 'supplier@unilever.com'),
    ('Distributor Lokal', 'Ahmad', '08123456789', 'ahmad@distributor.com')
ON CONFLICT DO NOTHING;
