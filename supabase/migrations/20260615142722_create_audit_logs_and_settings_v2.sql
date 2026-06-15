
-- Add audit-log to menu_items
INSERT INTO public.menu_items (menu_name, label, section, sort_order, is_active)
SELECT 'audit-log', 'Audit Trail', 'Admin', 40, true
WHERE NOT EXISTS (SELECT 1 FROM public.menu_items WHERE menu_name = 'audit-log');
