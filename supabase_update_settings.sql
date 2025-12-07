-- Tambahkan kolom baru ke tabel settings untuk pengaturan struk dan pajak
-- Jalankan script ini di Supabase SQL Editor

ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Terima Kasih Kunjungan Anda',
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0, -- Persentase pajak (misal 11.0 untuk 11%)
ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(5, 2) DEFAULT 0; -- Persentase service charge

-- Kolom untuk ukuran kertas struk (opsional, default 58mm)
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS receipt_paper_size TEXT DEFAULT '58mm'; 
