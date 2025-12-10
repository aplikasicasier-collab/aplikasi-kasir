-- =====================================================
-- AUDIT LOG - Database Schema Migration
-- Tables: audit_logs, audit_alerts, audit_settings
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.4
-- =====================================================

-- =====================================================
-- AUDIT LOGS TABLE
-- Records all data changes and business events
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'create', 'update', 'delete', 
        'login', 'logout', 
        'transaction', 'refund', 
        'stock_adjustment', 'price_change', 'role_change'
    )),
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'product', 'transaction', 'user', 'supplier', 'category',
        'purchase_order', 'return', 'discount', 'promo', 'outlet'
    )),
    entity_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address TEXT,
    user_agent TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- AUDIT ALERTS TABLE
-- Stores suspicious activity alerts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'failed_login', 'bulk_delete', 'unusual_transaction', 'unauthorized_access'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- AUDIT SETTINGS TABLE
-- Stores retention and archive configuration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    retention_days INTEGER NOT NULL DEFAULT 90,
    archive_enabled BOOLEAN DEFAULT false,
    archive_location TEXT,
    last_cleanup_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEXES for query performance
-- =====================================================

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outlet_id ON public.audit_logs(outlet_id);

-- Audit alerts indexes
CREATE INDEX IF NOT EXISTS idx_audit_alerts_created_at ON public.audit_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_user_id ON public.audit_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_alert_type ON public.audit_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_severity ON public.audit_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_is_resolved ON public.audit_alerts(is_resolved);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit alerts" ON public.audit_alerts;
DROP POLICY IF EXISTS "Admins can manage audit alerts" ON public.audit_alerts;
DROP POLICY IF EXISTS "Authenticated can insert audit alerts" ON public.audit_alerts;
DROP POLICY IF EXISTS "Admins can update audit alerts" ON public.audit_alerts;
DROP POLICY IF EXISTS "Admins can view audit settings" ON public.audit_settings;
DROP POLICY IF EXISTS "Admins can manage audit settings" ON public.audit_settings;
DROP POLICY IF EXISTS "Admins can insert audit settings" ON public.audit_settings;
DROP POLICY IF EXISTS "Admins can update audit settings" ON public.audit_settings;


-- =====================================================
-- AUDIT LOGS POLICIES (Admin only for viewing)
-- =====================================================

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Authenticated users can insert audit logs (for logging from application)
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- AUDIT ALERTS POLICIES (Admin only)
-- =====================================================

-- Only admins can view audit alerts
CREATE POLICY "Admins can view audit alerts" ON public.audit_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Authenticated users can insert alerts (for system-generated alerts)
CREATE POLICY "Authenticated can insert audit alerts" ON public.audit_alerts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only admins can update alerts (for resolving)
CREATE POLICY "Admins can update audit alerts" ON public.audit_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- AUDIT SETTINGS POLICIES (Admin only)
-- =====================================================

-- Only admins can view audit settings
CREATE POLICY "Admins can view audit settings" ON public.audit_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can insert audit settings
CREATE POLICY "Admins can insert audit settings" ON public.audit_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can update audit settings
CREATE POLICY "Admins can update audit settings" ON public.audit_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );


-- =====================================================
-- FUNCTION: Auto-update updated_at timestamp for audit_settings
-- =====================================================

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_audit_settings_updated ON public.audit_settings;

CREATE TRIGGER on_audit_settings_updated
    BEFORE UPDATE ON public.audit_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- FUNCTION: Create audit log entry
-- Used by application to create audit logs
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_event_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_values JSONB,
    p_new_values JSONB,
    p_changed_fields TEXT[],
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_summary TEXT DEFAULT NULL,
    p_outlet_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        event_type,
        entity_type,
        entity_id,
        user_id,
        outlet_id,
        old_values,
        new_values,
        changed_fields,
        ip_address,
        user_agent,
        summary
    ) VALUES (
        p_event_type,
        p_entity_type,
        p_entity_id,
        auth.uid(),
        p_outlet_id,
        p_old_values,
        p_new_values,
        p_changed_fields,
        p_ip_address,
        p_user_agent,
        p_summary
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FUNCTION: Create audit alert
-- Used by application to create security alerts
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_audit_alert(
    p_alert_type TEXT,
    p_severity TEXT,
    p_user_id UUID,
    p_description TEXT,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO public.audit_alerts (
        alert_type,
        severity,
        user_id,
        description,
        metadata
    ) VALUES (
        p_alert_type,
        p_severity,
        p_user_id,
        p_description,
        p_metadata
    ) RETURNING id INTO v_alert_id;
    
    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Resolve audit alert
-- Used by admins to mark alerts as resolved
-- =====================================================

CREATE OR REPLACE FUNCTION public.resolve_audit_alert(
    p_alert_id UUID,
    p_resolution_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.audit_alerts
    SET 
        is_resolved = true,
        resolved_by = auth.uid(),
        resolved_at = timezone('utc'::text, now()),
        resolution_notes = p_resolution_notes
    WHERE id = p_alert_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FUNCTION: Delete old audit logs (retention cleanup)
-- Used by scheduled job or manual cleanup
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
    p_retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.audit_logs
    WHERE created_at < (NOW() - (p_retention_days || ' days')::INTERVAL);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Update last cleanup timestamp in settings
    UPDATE public.audit_settings
    SET last_cleanup_at = timezone('utc'::text, now())
    WHERE id = (SELECT id FROM public.audit_settings LIMIT 1);
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get storage statistics for audit logs
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_audit_storage_stats()
RETURNS TABLE (
    total_logs BIGINT,
    oldest_log_date TIMESTAMP WITH TIME ZONE,
    newest_log_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_logs,
        MIN(created_at) as oldest_log_date,
        MAX(created_at) as newest_log_date
    FROM public.audit_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DATA: Create default audit settings
-- =====================================================

INSERT INTO public.audit_settings (retention_days, archive_enabled)
VALUES (90, false)
ON CONFLICT DO NOTHING;
