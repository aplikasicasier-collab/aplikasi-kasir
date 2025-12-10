-- =====================================================
-- BARCODE SCANNER & STOCK OPNAME - Database Schema Migration
-- Tables: stock_opnames, stock_opname_items, stock_adjustments
-- Alters: products (ensure barcode column exists)
-- Requirements: 3.1, 5.1, 5.4
-- =====================================================

-- =====================================================
-- ENSURE BARCODE COLUMN EXISTS ON PRODUCTS
-- The barcode column should already exist from supabase_schema.sql
-- This is a safety check
-- Requirements: 3.1
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'products' 
                   AND column_name = 'barcode') THEN
        ALTER TABLE public.products ADD COLUMN barcode TEXT;
    END IF;
END $$;

-- Ensure unique constraint on barcode
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
    END IF;
END $$;

-- =====================================================
-- STOCK OPNAMES TABLE
-- Records stock opname/inventory count sessions
-- Requirements: 5.1, 5.5
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_opnames (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opname_number TEXT NOT NULL UNIQUE,
    outlet_id UUID REFERENCES public.outlets(id),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- STOCK OPNAME ITEMS TABLE
-- Individual items scanned during stock opname
-- Requirements: 5.2, 5.3
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_opname_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opname_id UUID REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    system_stock INTEGER NOT NULL,
    actual_stock INTEGER NOT NULL,
    discrepancy INTEGER GENERATED ALWAYS AS (actual_stock - system_stock) STORED,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(opname_id, product_id)
);

-- =====================================================
-- STOCK ADJUSTMENTS TABLE
-- Records stock adjustments from opname results
-- Requirements: 5.4
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opname_id UUID REFERENCES public.stock_opnames(id),
    product_id UUID REFERENCES public.products(id),
    outlet_id UUID REFERENCES public.outlets(id),
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    adjustment INTEGER NOT NULL,
    reason TEXT DEFAULT 'stock_opname',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEXES for query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stock_opnames_opname_number ON public.stock_opnames(opname_number);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_outlet_id ON public.stock_opnames(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_status ON public.stock_opnames(status);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_created_by ON public.stock_opnames(created_by);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_created_at ON public.stock_opnames(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname_id ON public.stock_opname_items(opname_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_product_id ON public.stock_opname_items(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_opname_id ON public.stock_adjustments(opname_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON public.stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_outlet_id ON public.stock_adjustments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON public.stock_adjustments(created_at);

-- Index on products.barcode for fast lookup
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STOCK OPNAMES POLICIES
-- Requirements: 5.1 - Staff can perform stock opname
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view stock opnames" ON public.stock_opnames;
DROP POLICY IF EXISTS "Managers and admins can manage stock opnames" ON public.stock_opnames;
DROP POLICY IF EXISTS "Staff can create stock opnames" ON public.stock_opnames;
DROP POLICY IF EXISTS "Staff can update own stock opnames" ON public.stock_opnames;

-- All authenticated users can view stock opnames
CREATE POLICY "Authenticated users can view stock opnames" ON public.stock_opnames
    FOR SELECT USING (auth.role() = 'authenticated');

-- Managers and admins can manage all stock opnames
CREATE POLICY "Managers and admins can manage stock opnames" ON public.stock_opnames
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Staff can create stock opnames
CREATE POLICY "Staff can create stock opnames" ON public.stock_opnames
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Staff can update their own in-progress stock opnames
CREATE POLICY "Staff can update own stock opnames" ON public.stock_opnames
    FOR UPDATE USING (
        created_by = auth.uid() AND status = 'in_progress'
    );

-- =====================================================
-- STOCK OPNAME ITEMS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view opname items" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Managers and admins can manage opname items" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Staff can manage opname items for own opnames" ON public.stock_opname_items;

-- All authenticated users can view opname items
CREATE POLICY "Authenticated users can view opname items" ON public.stock_opname_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- Managers and admins can manage all opname items
CREATE POLICY "Managers and admins can manage opname items" ON public.stock_opname_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Staff can insert opname items for their own in-progress opnames
CREATE POLICY "Staff can insert opname items" ON public.stock_opname_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.stock_opnames so
            WHERE so.id = opname_id 
            AND so.created_by = auth.uid() 
            AND so.status = 'in_progress'
        )
    );

-- Staff can update opname items for their own in-progress opnames
CREATE POLICY "Staff can update opname items" ON public.stock_opname_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.stock_opnames so
            WHERE so.id = opname_id 
            AND so.created_by = auth.uid() 
            AND so.status = 'in_progress'
        )
    );

-- Staff can delete opname items for their own in-progress opnames
CREATE POLICY "Staff can delete opname items" ON public.stock_opname_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.stock_opnames so
            WHERE so.id = opname_id 
            AND so.created_by = auth.uid() 
            AND so.status = 'in_progress'
        )
    );

-- =====================================================
-- STOCK ADJUSTMENTS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Managers and admins can manage stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "System can insert stock adjustments" ON public.stock_adjustments;

-- All authenticated users can view stock adjustments
CREATE POLICY "Authenticated users can view stock adjustments" ON public.stock_adjustments
    FOR SELECT USING (auth.role() = 'authenticated');

-- Managers and admins can manage all stock adjustments
CREATE POLICY "Managers and admins can manage stock adjustments" ON public.stock_adjustments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Authenticated users can insert stock adjustments (created during opname completion)
CREATE POLICY "Authenticated can insert stock adjustments" ON public.stock_adjustments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- TRIGGERS for auto-update updated_at
-- =====================================================

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock_opnames
DROP TRIGGER IF EXISTS update_stock_opnames_updated_at ON public.stock_opnames;
CREATE TRIGGER update_stock_opnames_updated_at
    BEFORE UPDATE ON public.stock_opnames
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: Generate unique opname number
-- Format: OPN-YYYYMMDD-XXXX
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_opname_number()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    today_date := to_char(NOW(), 'YYYYMMDD');
    
    -- Get the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(opname_number FROM 14 FOR 4) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM public.stock_opnames
    WHERE opname_number LIKE 'OPN-' || today_date || '-%';
    
    new_number := 'OPN-' || today_date || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Complete stock opname and create adjustments
-- Updates product stock and creates adjustment records
-- Requirements: 5.4
-- =====================================================

CREATE OR REPLACE FUNCTION public.complete_stock_opname(p_opname_id UUID)
RETURNS VOID AS $$
DECLARE
    v_opname RECORD;
    v_item RECORD;
BEGIN
    -- Get the opname record
    SELECT * INTO v_opname FROM public.stock_opnames WHERE id = p_opname_id;
    
    IF v_opname IS NULL THEN
        RAISE EXCEPTION 'Stock opname not found';
    END IF;
    
    IF v_opname.status != 'in_progress' THEN
        RAISE EXCEPTION 'Stock opname is not in progress';
    END IF;
    
    -- Process each item with discrepancy
    FOR v_item IN 
        SELECT soi.*, p.stock_quantity as current_stock
        FROM public.stock_opname_items soi
        JOIN public.products p ON p.id = soi.product_id
        WHERE soi.opname_id = p_opname_id
        AND soi.discrepancy != 0
    LOOP
        -- Create stock adjustment record
        INSERT INTO public.stock_adjustments (
            opname_id, product_id, outlet_id, previous_stock, 
            new_stock, adjustment, reason, created_by
        ) VALUES (
            p_opname_id, v_item.product_id, v_opname.outlet_id,
            v_item.system_stock, v_item.actual_stock, 
            v_item.discrepancy, 'stock_opname', v_opname.created_by
        );
        
        -- Update product stock
        UPDATE public.products 
        SET stock_quantity = v_item.actual_stock,
            updated_at = NOW()
        WHERE id = v_item.product_id;
        
        -- Update outlet_stock if outlet_id is specified
        IF v_opname.outlet_id IS NOT NULL THEN
            UPDATE public.outlet_stock
            SET quantity = v_item.actual_stock,
                updated_at = NOW()
            WHERE outlet_id = v_opname.outlet_id 
            AND product_id = v_item.product_id;
        END IF;
    END LOOP;
    
    -- Mark opname as completed
    UPDATE public.stock_opnames
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_opname_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Cancel stock opname
-- =====================================================

CREATE OR REPLACE FUNCTION public.cancel_stock_opname(p_opname_id UUID)
RETURNS VOID AS $$
DECLARE
    v_opname RECORD;
BEGIN
    -- Get the opname record
    SELECT * INTO v_opname FROM public.stock_opnames WHERE id = p_opname_id;
    
    IF v_opname IS NULL THEN
        RAISE EXCEPTION 'Stock opname not found';
    END IF;
    
    IF v_opname.status != 'in_progress' THEN
        RAISE EXCEPTION 'Stock opname is not in progress';
    END IF;
    
    -- Mark opname as cancelled
    UPDATE public.stock_opnames
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_opname_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

