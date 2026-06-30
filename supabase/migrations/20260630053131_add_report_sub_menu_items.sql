-- Insert individual report sub-items into menu_items
-- These appear under section "Reports" in the Menu Access UI
-- Using sort_order 250-258 to group after the parent 'reports' item (25)

INSERT INTO menu_items (menu_name, label, section, sort_order, is_active) VALUES
  ('reports.share-holdings',   'Share Holdings Report',   'Reports', 250, true),
  ('reports.portfolio',        'Portfolio Holdings Report','Reports', 251, true),
  ('reports.cashbook',         'Cash Book Report',        'Reports', 252, true),
  ('reports.analytics',        'Share Analytics Report',  'Reports', 253, true),
  ('reports.dividends',        'Dividends Report',        'Reports', 254, true),
  ('reports.scrip',            'Scrip Entries Report',    'Reports', 255, true),
  ('reports.sector-wise',      'Sector-wise Report',      'Reports', 256, true),
  ('reports.contributors',     'Contributors by Share',   'Reports', 257, true)
ON CONFLICT (menu_name) DO NOTHING;
