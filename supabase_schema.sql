-- Buat tabel products jika belum ada
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 10,
    category_id UUID,
    supplier_id UUID,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tambahkan unique constraint pada barcode agar on conflict bisa jalan (opsional tapi recommended)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
    END IF;
END $$;

-- Aktifkan RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama agar tidak duplicate
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.products;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.products;

-- Buat ulang Policy
CREATE POLICY "Enable read access for all users" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.products
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.products
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.products
    FOR DELETE USING (auth.role() = 'authenticated');

-- Seed Data (Data Awal) - Gunakan ON CONFLICT agar tidak error kalau data sudah ada
INSERT INTO public.products (name, barcode, price, stock_quantity, min_stock) VALUES
    ('Indomie Goreng', '8998866111111', 3500, 100, 20),
    ('Aqua 600ml', '8998866222222', 4000, 50, 15),
    ('Rokok Gudang Garam', '8998866333333', 25000, 30, 10),
    ('Kopi Kapal Api', '8998866444444', 2000, 80, 25),
    ('Teh Botol Sosro', '8998866555555', 5000, 60, 15)
ON CONFLICT (barcode) DO UPDATE 
SET 
    price = EXCLUDED.price,
    stock_quantity = EXCLUDED.stock_quantity;
