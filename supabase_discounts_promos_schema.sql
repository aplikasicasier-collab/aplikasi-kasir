-- =====================================================
-- DISKON & PROMO - Database Schema Migration
-- Tables: discounts, promos, promo_products
-- Requirements: 1.1, 2.1, 4.5
-- =====================================================

-- =====================================================
-- DISCOUNTS TABLE
-- Individual product discounts (percentage or nominal)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'nominal')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique constraint: only one active discount per product
-- Using partial unique index for active discounts only
CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_product_active 
    ON public.discounts(product_id) 
    WHERE is_active = true;

-- =====================================================
-- PROMOS TABLE
-- Promotional campaigns with date periods
-- =====================================================

CREATE TABLE IF NOT EXISTS public.promos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'nominal')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    min_purchase NUMERIC(12, 2) CHECK (min_purchase IS NULL OR min_purchase >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- =====================================================
-- PROMO_PRODUCTS TABLE
-- Junction table for promo-product relationships
-- =====================================================

CREATE TABLE IF NOT EXISTS public.promo_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    promo_id UUID REFERENCES public.promos(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promo_id, product_id)
);


-- =====================================================
-- ALTER TRANSACTION_ITEMS TABLE
-- Add discount tracking columns
-- Requirements: 4.5
-- =====================================================

ALTER TABLE public.transaction_items 
    ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);

ALTER TABLE public.transaction_items 
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE public.transaction_items 
    ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discounts(id) ON DELETE SET NULL;

ALTER TABLE public.transaction_items 
    ADD COLUMN IF NOT EXISTS promo_id UUID REFERENCES public.promos(id) ON DELETE SET NULL;

-- =====================================================
-- INDEXES for query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_discounts_product_id ON public.discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON public.discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_type ON public.discounts(discount_type);

CREATE INDEX IF NOT EXISTS idx_promos_is_active ON public.promos(is_active);
CREATE INDEX IF NOT EXISTS idx_promos_start_date ON public.promos(start_date);
CREATE INDEX IF NOT EXISTS idx_promos_end_date ON public.promos(end_date);
CREATE INDEX IF NOT EXISTS idx_promos_dates ON public.promos(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_promo_products_promo_id ON public.promo_products(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_products_product_id ON public.promo_products(product_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_discount_id ON public.transaction_items(discount_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_promo_id ON public.transaction_items(promo_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view discounts" ON public.discounts;
DROP POLICY IF EXISTS "Managers and admins can insert discounts" ON public.discounts;
DROP POLICY IF EXISTS "Managers and admins can update discounts" ON public.discounts;
DROP POLICY IF EXISTS "Managers and admins can delete discounts" ON public.discounts;

DROP POLICY IF EXISTS "Authenticated users can view promos" ON public.promos;
DROP POLICY IF EXISTS "Managers and admins can insert promos" ON public.promos;
DROP POLICY IF EXISTS "Managers and admins can update promos" ON public.promos;
DROP POLICY IF EXISTS "Managers and admins can delete promos" ON public.promos;

DROP POLICY IF EXISTS "Authenticated users can view promo_products" ON public.promo_products;
DROP POLICY IF EXISTS "Managers and admins can insert promo_products" ON public.promo_products;
DROP POLICY IF EXISTS "Managers and admins can delete promo_products" ON public.promo_products;

-- =====================================================
-- DISCOUNTS POLICIES
-- =====================================================

-- All authenticated users can view discounts (needed for kasir checkout)
CREATE POLICY "Authenticated users can view discounts" ON public.discounts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only managers and admins can create discounts
CREATE POLICY "Managers and admins can insert discounts" ON public.discounts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Only managers and admins can update discounts
CREATE POLICY "Managers and admins can update discounts" ON public.discounts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Only managers and admins can delete discounts
CREATE POLICY "Managers and admins can delete discounts" ON public.discounts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- PROMOS POLICIES
-- =====================================================

-- All authenticated users can view promos (needed for kasir checkout)
CREATE POLICY "Authenticated users can view promos" ON public.promos
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only managers and admins can create promos
CREATE POLICY "Managers and admins can insert promos" ON public.promos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Only managers and admins can update promos
CREATE POLICY "Managers and admins can update promos" ON public.promos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Only managers and admins can delete promos
CREATE POLICY "Managers and admins can delete promos" ON public.promos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- PROMO_PRODUCTS POLICIES
-- =====================================================

-- All authenticated users can view promo_products (needed for kasir checkout)
CREATE POLICY "Authenticated users can view promo_products" ON public.promo_products
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only managers and admins can add products to promos
CREATE POLICY "Managers and admins can insert promo_products" ON public.promo_products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Only managers and admins can remove products from promos
CREATE POLICY "Managers and admins can delete promo_products" ON public.promo_products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );


-- =====================================================
-- TRIGGERS: Auto-update updated_at timestamp
-- =====================================================

-- Trigger for discounts table
DROP TRIGGER IF EXISTS on_discounts_updated ON public.discounts;

CREATE TRIGGER on_discounts_updated
    BEFORE UPDATE ON public.discounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for promos table
DROP TRIGGER IF EXISTS on_promos_updated ON public.promos;

CREATE TRIGGER on_promos_updated
    BEFORE UPDATE ON public.promos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- HELPER FUNCTION: Check if promo is currently active
-- Returns true if promo is active and within date range
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_promo_currently_active(promo_row public.promos)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN promo_row.is_active = true 
        AND NOW() >= promo_row.start_date 
        AND NOW() <= promo_row.end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- VIEW: Active discounts with product info
-- =====================================================

CREATE OR REPLACE VIEW public.active_discounts_view AS
SELECT 
    d.id,
    d.product_id,
    p.name AS product_name,
    p.price AS product_price,
    d.discount_type,
    d.discount_value,
    d.is_active,
    d.created_at,
    d.updated_at
FROM public.discounts d
JOIN public.products p ON d.product_id = p.id
WHERE d.is_active = true;

-- =====================================================
-- VIEW: Active promos with product count
-- =====================================================

CREATE OR REPLACE VIEW public.active_promos_view AS
SELECT 
    pr.id,
    pr.name,
    pr.description,
    pr.start_date,
    pr.end_date,
    pr.discount_type,
    pr.discount_value,
    pr.min_purchase,
    pr.is_active,
    pr.created_at,
    pr.updated_at,
    COUNT(pp.product_id) AS product_count,
    CASE 
        WHEN pr.is_active = false THEN 'inactive'
        WHEN NOW() < pr.start_date THEN 'upcoming'
        WHEN NOW() > pr.end_date THEN 'expired'
        ELSE 'active'
    END AS status
FROM public.promos pr
LEFT JOIN public.promo_products pp ON pr.id = pp.promo_id
GROUP BY pr.id;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================

COMMENT ON TABLE public.discounts IS 'Individual product discounts (percentage or nominal)';
COMMENT ON TABLE public.promos IS 'Promotional campaigns with date periods';
COMMENT ON TABLE public.promo_products IS 'Junction table linking promos to products';

COMMENT ON COLUMN public.discounts.discount_type IS 'Type of discount: percentage or nominal';
COMMENT ON COLUMN public.discounts.discount_value IS 'Discount value (percentage 1-100 or nominal amount)';
COMMENT ON COLUMN public.discounts.is_active IS 'Whether the discount is currently active';

COMMENT ON COLUMN public.promos.min_purchase IS 'Minimum purchase amount required to apply promo (optional)';
COMMENT ON COLUMN public.promos.start_date IS 'Start date/time when promo becomes active';
COMMENT ON COLUMN public.promos.end_date IS 'End date/time when promo expires';

COMMENT ON COLUMN public.transaction_items.original_price IS 'Original price before discount';
COMMENT ON COLUMN public.transaction_items.discount_amount IS 'Amount of discount applied';
COMMENT ON COLUMN public.transaction_items.discount_id IS 'Reference to applied product discount';
COMMENT ON COLUMN public.transaction_items.promo_id IS 'Reference to applied promo';
