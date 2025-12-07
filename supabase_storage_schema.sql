-- Script untuk membuat Storage Buckets dan Policy di Supabase
-- Jalankan script ini di SQL Editor Supabase

-- 1. Buat bucket 'logos' untuk logo toko (jika belum ada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Buat bucket 'products' untuk foto produk (jika belum ada)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;


-- POLICY UNTUK BUCKET 'logos'
-- Hapus policy lama agar idempotent
DROP POLICY IF EXISTS "Logos are public" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their logos" ON storage.objects;

-- Buat policy baru untuk logos
-- Semua orang bisa melihat logo
CREATE POLICY "Logos are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- User login bisa upload logo
CREATE POLICY "Authenticated users can upload logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos' AND 
    auth.role() = 'authenticated'
  );

-- User login bisa update/delete logo mereka sendiri (opsional, biasanya dicek by name/path = user_id)
-- Sederhananya: user login boleh update/delete di bucket logos
CREATE POLICY "Authenticated users can update logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos' AND 
    auth.role() = 'authenticated'
  );


-- POLICY UNTUK BUCKET 'products'
-- Hapus policy lama
DROP POLICY IF EXISTS "Products are public" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON storage.objects;

-- Buat policy baru untuk products
-- Semua orang bisa melihat foto produk
CREATE POLICY "Products are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

-- User login bisa upload foto produk
CREATE POLICY "Authenticated users can upload products" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products' AND 
    auth.role() = 'authenticated'
  );

-- User login bisa update foto produk
CREATE POLICY "Authenticated users can update products" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products' AND 
    auth.role() = 'authenticated'
  );

-- User login bisa delete foto produk
CREATE POLICY "Authenticated users can delete products" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products' AND 
    auth.role() = 'authenticated'
  );
