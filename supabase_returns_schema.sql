-- =====================================================
-- RETUR/REFUND - Database Schema Migration
-- Tables: return_policies, returns, return_items
-- Alters: transaction_items (add returned_quantity), stock_movements (add 'return' type)
-- Requirements: 1.1, 3.1, 4.1
-- =====================================================

-- =====================================================
-- RETURN POLICIES TABLE
-- Stores return policy configuration
-- Requirements: 3.1, 3.3
-- =====================================================

CREATE TABLE IF NOT EXISTS public.return_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    max_return_days INTEGER NOT NULL DEFAULT 7,
    non_returnable_categories UUID[] DEFAULT '{}',
    require_receipt BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- RETURNS TABLE
-- Records return transactions
-- Requirements: 1.1, 1.5, 7.2
-- =====================================================

CREATE TABLE IF NOT EXISTS public.returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    transaction_id UUID REFERENCES public.transactions(id),
    outlet_id UUID REFERENCES public.outlets(id),
    status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'completed', 'rejected', 'cancelled')),
    total_refund NUMERIC(12, 2) NOT NULL DEFAULT 0,
    refund_method TEXT CHECK (refund_method IS NULL OR refund_method IN ('cash', 'card', 'e-wallet')),
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approval_reason TEXT,
    rejected_reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- RETURN ITEMS TABLE
-- Records individual items in a return
-- Requirements: 1.3, 1.4, 4.3, 4.4
-- =====================================================

CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE,
    transaction_item_id UUID REFERENCES public.transaction_items(id),
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    refund_amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('damaged', 'wrong_product', 'not_as_described', 'changed_mind', 'other')),
    reason_detail TEXT,
    is_damaged BOOLEAN DEFAULT false,
    is_resellable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ALTER EXISTING TABLES
-- =====================================================

-- Add returned_quantity to transaction_items table
-- Requirements: 1.4
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0;

-- Update stock_movements movement_type check to include 'return'
-- Requirements: 4.2
-- First drop existing constraint, then add new one
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
    CHECK (movement_type IN ('in', 'out', 'adjustment', 'return'));

-- =====================================================
-- INDEXES for query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_return_policies_is_active ON public.return_policies(is_active);

CREATE INDEX IF NOT EXISTS idx_returns_return_number ON public.returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_transaction_id ON public.returns(transaction_id);
CREATE INDEX IF NOT EXISTS idx_returns_outlet_id ON public.returns(outlet_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at);
CREATE INDEX IF NOT EXISTS idx_returns_created_by ON public.returns(created_by);
CREATE INDEX IF NOT EXISTS idx_returns_requires_approval ON public.returns(requires_approval);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_transaction_item_id ON public.return_items(transaction_item_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON public.return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_return_items_reason ON public.return_items(reason);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.return_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RETURN POLICIES RLS POLICIES
-- Requirements: 3.1
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view return policies" ON public.return_policies;
DROP POLICY IF EXISTS "Managers can manage return policies" ON public.return_policies;

-- All authenticated users can view return policies
CREATE POLICY "Authenticated users can view return policies" ON public.return_policies
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only managers and admins can manage return policies
CREATE POLICY "Managers can manage return policies" ON public.return_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- RETURNS RLS POLICIES
-- Requirements: 1.1, 7.2
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view returns" ON public.returns;
DROP POLICY IF EXISTS "Kasir can create returns" ON public.returns;
DROP POLICY IF EXISTS "Managers can manage returns" ON public.returns;
DROP POLICY IF EXISTS "Users can update own returns" ON public.returns;

-- All authenticated users can view returns
CREATE POLICY "Authenticated users can view returns" ON public.returns
    FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create returns
CREATE POLICY "Kasir can create returns" ON public.returns
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update returns they created (for completing/cancelling)
CREATE POLICY "Users can update own returns" ON public.returns
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Managers and admins can manage all returns
CREATE POLICY "Managers can manage returns" ON public.returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- RETURN ITEMS RLS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can view return items" ON public.return_items;
DROP POLICY IF EXISTS "Authenticated users can insert return items" ON public.return_items;
DROP POLICY IF EXISTS "Managers can manage return items" ON public.return_items;

-- All authenticated users can view return items
CREATE POLICY "Authenticated users can view return items" ON public.return_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert return items
CREATE POLICY "Authenticated users can insert return items" ON public.return_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Managers and admins can manage all return items
CREATE POLICY "Managers can manage return items" ON public.return_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- TRIGGERS for auto-update updated_at
-- =====================================================

-- Trigger for return_policies
DROP TRIGGER IF EXISTS update_return_policies_updated_at ON public.return_policies;
CREATE TRIGGER update_return_policies_updated_at
    BEFORE UPDATE ON public.return_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for returns
DROP TRIGGER IF EXISTS update_returns_updated_at ON public.returns;
CREATE TRIGGER update_returns_updated_at
    BEFORE UPDATE ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- FUNCTION: Generate unique return number
-- Format: RTN-YYYYMMDD-XXXX
-- Requirements: 1.5
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    today_date := to_char(NOW(), 'YYYYMMDD');
    
    -- Get the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(return_number FROM 14 FOR 4) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM public.returns
    WHERE return_number LIKE 'RTN-' || today_date || '-%';
    
    new_number := 'RTN-' || today_date || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA: Create default return policy
-- Requirements: 3.1
-- =====================================================

INSERT INTO public.return_policies (max_return_days, non_returnable_categories, require_receipt, is_active)
SELECT 7, '{}', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.return_policies WHERE is_active = true);
