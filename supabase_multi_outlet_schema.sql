-- =====================================================
-- MULTI-OUTLET - Database Schema Migration
-- Tables: outlets, user_outlets, outlet_stock, stock_transfers, stock_transfer_items
-- Alters: transactions, stock_movements, purchase_orders (add outlet_id)
-- Requirements: 1.1, 2.1, 3.1, 4.1, 5.1
-- =====================================================

-- =====================================================
-- OUTLETS TABLE
-- Stores outlet/branch information
-- Requirements: 1.1, 1.2
-- =====================================================

CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- USER_OUTLETS TABLE
-- Junction table for user-outlet assignments
-- Requirements: 2.1, 7.1
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, outlet_id)
);

-- =====================================================
-- OUTLET_STOCK TABLE
-- Stock per outlet per product
-- Requirements: 3.1
-- =====================================================

CREATE TABLE IF NOT EXISTS public.outlet_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(outlet_id, product_id)
);


-- =====================================================
-- STOCK_TRANSFERS TABLE
-- Records stock transfers between outlets
-- Requirements: 4.1
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transfer_number TEXT NOT NULL UNIQUE,
    source_outlet_id UUID REFERENCES public.outlets(id),
    destination_outlet_id UUID REFERENCES public.outlets(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- STOCK_TRANSFER_ITEMS TABLE
-- Items in a stock transfer
-- Requirements: 4.1
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transfer_id UUID REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ALTER EXISTING TABLES - Add outlet_id column
-- Requirements: 5.1
-- =====================================================

-- Add outlet_id to transactions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'transactions' 
                   AND column_name = 'outlet_id') THEN
        ALTER TABLE public.transactions ADD COLUMN outlet_id UUID REFERENCES public.outlets(id);
    END IF;
END $$;

-- Add outlet_id to stock_movements table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stock_movements' 
                   AND column_name = 'outlet_id') THEN
        ALTER TABLE public.stock_movements ADD COLUMN outlet_id UUID REFERENCES public.outlets(id);
    END IF;
END $$;

-- Add outlet_id to purchase_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'purchase_orders' 
                   AND column_name = 'outlet_id') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN outlet_id UUID REFERENCES public.outlets(id);
    END IF;
END $$;


-- =====================================================
-- INDEXES for query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_outlets_code ON public.outlets(code);
CREATE INDEX IF NOT EXISTS idx_outlets_is_active ON public.outlets(is_active);
CREATE INDEX IF NOT EXISTS idx_outlets_name ON public.outlets(name);

CREATE INDEX IF NOT EXISTS idx_user_outlets_user_id ON public.user_outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet_id ON public.user_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_is_default ON public.user_outlets(is_default);

CREATE INDEX IF NOT EXISTS idx_outlet_stock_outlet_id ON public.outlet_stock(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_stock_product_id ON public.outlet_stock(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_transfer_number ON public.stock_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_outlet ON public.stock_transfers(source_outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest_outlet ON public.stock_transfers(destination_outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at ON public.stock_transfers(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product_id ON public.stock_transfer_items(product_id);

-- Indexes for outlet_id on altered tables
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON public.transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet_id ON public.stock_movements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_outlet_id ON public.purchase_orders(outlet_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- OUTLETS POLICIES
-- Requirements: 2.5 - Admin can access all outlets
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage outlets" ON public.outlets;
DROP POLICY IF EXISTS "Users can view assigned outlets" ON public.outlets;

-- Admins can do everything with outlets
CREATE POLICY "Admins can manage outlets" ON public.outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view outlets they're assigned to
CREATE POLICY "Users can view assigned outlets" ON public.outlets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() AND outlet_id = outlets.id
        )
    );


-- =====================================================
-- USER_OUTLETS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage user outlets" ON public.user_outlets;
DROP POLICY IF EXISTS "Users can view own outlet assignments" ON public.user_outlets;

-- Admins can manage all user-outlet assignments
CREATE POLICY "Admins can manage user outlets" ON public.user_outlets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own outlet assignments
CREATE POLICY "Users can view own outlet assignments" ON public.user_outlets
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- OUTLET_STOCK POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage outlet stock" ON public.outlet_stock;
DROP POLICY IF EXISTS "Users can view assigned outlet stock" ON public.outlet_stock;
DROP POLICY IF EXISTS "Users can update assigned outlet stock" ON public.outlet_stock;

-- Admins can manage all outlet stock
CREATE POLICY "Admins can manage outlet stock" ON public.outlet_stock
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view stock for their assigned outlets
CREATE POLICY "Users can view assigned outlet stock" ON public.outlet_stock
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() AND outlet_id = outlet_stock.outlet_id
        )
    );

-- Users can update stock for their assigned outlets
CREATE POLICY "Users can update assigned outlet stock" ON public.outlet_stock
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() AND outlet_id = outlet_stock.outlet_id
        )
    );

-- Users can insert stock for their assigned outlets
CREATE POLICY "Users can insert assigned outlet stock" ON public.outlet_stock
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() AND outlet_id = outlet_stock.outlet_id
        )
    );


-- =====================================================
-- STOCK_TRANSFERS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage stock transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users can view transfers for assigned outlets" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users can create transfers from assigned outlets" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users can update transfers for assigned outlets" ON public.stock_transfers;

-- Admins can manage all stock transfers
CREATE POLICY "Admins can manage stock transfers" ON public.stock_transfers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view transfers involving their assigned outlets
CREATE POLICY "Users can view transfers for assigned outlets" ON public.stock_transfers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() 
            AND (outlet_id = stock_transfers.source_outlet_id OR outlet_id = stock_transfers.destination_outlet_id)
        )
    );

-- Users can create transfers from their assigned outlets
CREATE POLICY "Users can create transfers from assigned outlets" ON public.stock_transfers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() AND outlet_id = stock_transfers.source_outlet_id
        )
    );

-- Users can update transfers for their assigned outlets
CREATE POLICY "Users can update transfers for assigned outlets" ON public.stock_transfers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_outlets 
            WHERE user_id = auth.uid() 
            AND (outlet_id = stock_transfers.source_outlet_id OR outlet_id = stock_transfers.destination_outlet_id)
        )
    );

-- =====================================================
-- STOCK_TRANSFER_ITEMS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage transfer items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Users can view transfer items for assigned outlets" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Users can insert transfer items" ON public.stock_transfer_items;

-- Admins can manage all transfer items
CREATE POLICY "Admins can manage transfer items" ON public.stock_transfer_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view transfer items for transfers they can access
CREATE POLICY "Users can view transfer items for assigned outlets" ON public.stock_transfer_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.stock_transfers st
            JOIN public.user_outlets uo ON uo.user_id = auth.uid()
            WHERE st.id = stock_transfer_items.transfer_id
            AND (uo.outlet_id = st.source_outlet_id OR uo.outlet_id = st.destination_outlet_id)
        )
    );

-- Users can insert transfer items for transfers they created
CREATE POLICY "Users can insert transfer items" ON public.stock_transfer_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.stock_transfers st
            JOIN public.user_outlets uo ON uo.user_id = auth.uid()
            WHERE st.id = stock_transfer_items.transfer_id
            AND uo.outlet_id = st.source_outlet_id
        )
    );


-- =====================================================
-- TRIGGERS for auto-update updated_at
-- =====================================================

-- Trigger for outlets
DROP TRIGGER IF EXISTS update_outlets_updated_at ON public.outlets;
CREATE TRIGGER update_outlets_updated_at
    BEFORE UPDATE ON public.outlets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for outlet_stock
DROP TRIGGER IF EXISTS update_outlet_stock_updated_at ON public.outlet_stock;
CREATE TRIGGER update_outlet_stock_updated_at
    BEFORE UPDATE ON public.outlet_stock
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for stock_transfers
DROP TRIGGER IF EXISTS update_stock_transfers_updated_at ON public.stock_transfers;
CREATE TRIGGER update_stock_transfers_updated_at
    BEFORE UPDATE ON public.stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: Ensure only one default outlet per user
-- Requirements: 7.1
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_single_default_outlet()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this outlet as default, unset other defaults for this user
    IF NEW.is_default = true THEN
        UPDATE public.user_outlets 
        SET is_default = false 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id 
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single default outlet
DROP TRIGGER IF EXISTS ensure_single_default_outlet_trigger ON public.user_outlets;
CREATE TRIGGER ensure_single_default_outlet_trigger
    BEFORE INSERT OR UPDATE ON public.user_outlets
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION public.ensure_single_default_outlet();

-- =====================================================
-- FUNCTION: Initialize product stock for all outlets
-- Requirements: 3.3
-- =====================================================

CREATE OR REPLACE FUNCTION public.initialize_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert zero stock for all active outlets when a new product is created
    INSERT INTO public.outlet_stock (outlet_id, product_id, quantity)
    SELECT o.id, NEW.id, 0
    FROM public.outlets o
    WHERE o.is_active = true
    ON CONFLICT (outlet_id, product_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to initialize stock when product is created
DROP TRIGGER IF EXISTS initialize_product_stock_trigger ON public.products;
CREATE TRIGGER initialize_product_stock_trigger
    AFTER INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_product_stock();

-- =====================================================
-- FUNCTION: Initialize stock for new outlet
-- When a new outlet is created, initialize stock for all products
-- =====================================================

CREATE OR REPLACE FUNCTION public.initialize_outlet_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert zero stock for all products when a new outlet is created
    INSERT INTO public.outlet_stock (outlet_id, product_id, quantity)
    SELECT NEW.id, p.id, 0
    FROM public.products p
    WHERE p.is_active = true
    ON CONFLICT (outlet_id, product_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to initialize stock when outlet is created
DROP TRIGGER IF EXISTS initialize_outlet_stock_trigger ON public.outlets;
CREATE TRIGGER initialize_outlet_stock_trigger
    AFTER INSERT ON public.outlets
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_outlet_stock();


-- =====================================================
-- FUNCTION: Generate unique transfer number
-- Format: TRF-YYYYMMDD-XXXX
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_transfer_number()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    today_date := to_char(NOW(), 'YYYYMMDD');
    
    -- Get the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(transfer_number FROM 14 FOR 4) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM public.stock_transfers
    WHERE transfer_number LIKE 'TRF-' || today_date || '-%';
    
    new_number := 'TRF-' || today_date || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA: Create initial outlet (Outlet Utama)
-- =====================================================

INSERT INTO public.outlets (code, name, address, phone, email, is_active)
VALUES ('OUT-0001', 'Outlet Utama', 'Jl. Utama No. 1', '021-1234567', 'utama@toko.com', true)
ON CONFLICT (code) DO NOTHING;

-- Initialize stock for existing products in the new outlet
INSERT INTO public.outlet_stock (outlet_id, product_id, quantity)
SELECT o.id, p.id, p.stock_quantity
FROM public.outlets o
CROSS JOIN public.products p
WHERE o.code = 'OUT-0001'
ON CONFLICT (outlet_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- =====================================================
-- MIGRATION: Set outlet_id for existing transactions
-- Assign existing transactions to Outlet Utama
-- =====================================================

UPDATE public.transactions 
SET outlet_id = (SELECT id FROM public.outlets WHERE code = 'OUT-0001' LIMIT 1)
WHERE outlet_id IS NULL;

-- =====================================================
-- MIGRATION: Set outlet_id for existing stock_movements
-- Assign existing stock movements to Outlet Utama
-- =====================================================

UPDATE public.stock_movements 
SET outlet_id = (SELECT id FROM public.outlets WHERE code = 'OUT-0001' LIMIT 1)
WHERE outlet_id IS NULL;

-- =====================================================
-- MIGRATION: Set outlet_id for existing purchase_orders
-- Assign existing purchase orders to Outlet Utama
-- =====================================================

UPDATE public.purchase_orders 
SET outlet_id = (SELECT id FROM public.outlets WHERE code = 'OUT-0001' LIMIT 1)
WHERE outlet_id IS NULL;
