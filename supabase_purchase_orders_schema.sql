-- =====================================================
-- PURCHASE ORDERS - Database Schema Migration
-- Tables: purchase_orders, purchase_order_items
-- Alters: suppliers (add is_active, updated_at)
-- =====================================================

-- =====================================================
-- ALTER suppliers table to add missing columns
-- =====================================================

-- Add is_active column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'suppliers' 
                   AND column_name = 'is_active') THEN
        ALTER TABLE public.suppliers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add updated_at column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'suppliers' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.suppliers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- =====================================================
-- Create purchase_orders table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    supplier_id UUID REFERENCES public.suppliers(id),
    user_id UUID REFERENCES auth.users(id),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'received', 'cancelled')),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expected_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- Create purchase_order_items table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    received_quantity INTEGER DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEX untuk performa query
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_number ON public.purchase_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON public.purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON public.purchase_order_items(product_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS pada semua tabel
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Enable read access for all users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.purchase_orders;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.purchase_order_items;

-- Policies untuk purchase_orders
CREATE POLICY "Enable read access for all users" ON public.purchase_orders
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.purchase_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.purchase_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.purchase_orders
    FOR DELETE USING (auth.role() = 'authenticated');

-- Policies untuk purchase_order_items
CREATE POLICY "Enable read access for all users" ON public.purchase_order_items
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.purchase_order_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.purchase_order_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.purchase_order_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- Trigger untuk auto-update updated_at
-- =====================================================

-- Function untuk update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger untuk purchase_orders
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger untuk suppliers (jika belum ada)
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
