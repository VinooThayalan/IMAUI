/*
  # Update Industry Types with Proper GICS Industry Group Names

  ## Summary
  Updates all existing industry_types entries to use official GICS (Global Industry
  Classification Standard) Industry Group names. Also inserts additional standard
  GICS Industry Groups that are relevant for a comprehensive stock portfolio.

  ## Modified Rows (existing industry_id entries updated)
  - IND001 Manufacturing       -> Capital Goods
  - IND002 Business Services   -> Commercial & Professional Services
  - IND003 Finance & Banking   -> Financial Services
  - IND004 Banking & Finance   -> Banks
  - IND005 Telecommunications  -> Telecommunication Services
  - IND007 Food & Beverage     -> Food, Beverage & Tobacco
  - IND008 Healthcare          -> Health Care Equipment & Services
  - IND009 Energy & Power      -> Energy
  - IND010 Retail & Consumer   -> Consumer Discretionary Distribution & Retail
  - IND011 Technology          -> Software & Services
  - IND013 Consumer Goods      -> Consumer Durables & Apparel

  ## New Rows Added
  - IND012 Insurance
  - IND014 Real Estate
  - IND015 Pharmaceuticals, Biotechnology & Life Sciences
  - IND016 Transportation
  - IND017 Materials
  - IND018 Media & Entertainment
  - IND019 Utilities
  - IND020 Household & Personal Products
  - IND021 Technology Hardware & Equipment
  - IND022 Semiconductors & Semiconductor Equipment
*/

UPDATE industry_types SET industry_name = 'Capital Goods'                                    WHERE industry_id = 'IND001';
UPDATE industry_types SET industry_name = 'Commercial & Professional Services'               WHERE industry_id = 'IND002';
UPDATE industry_types SET industry_name = 'Financial Services'                               WHERE industry_id = 'IND003';
UPDATE industry_types SET industry_name = 'Banks'                                            WHERE industry_id = 'IND004';
UPDATE industry_types SET industry_name = 'Telecommunication Services'                       WHERE industry_id = 'IND005';
UPDATE industry_types SET industry_name = 'Food, Beverage & Tobacco'                         WHERE industry_id = 'IND007';
UPDATE industry_types SET industry_name = 'Health Care Equipment & Services'                 WHERE industry_id = 'IND008';
UPDATE industry_types SET industry_name = 'Energy'                                           WHERE industry_id = 'IND009';
UPDATE industry_types SET industry_name = 'Consumer Discretionary Distribution & Retail'    WHERE industry_id = 'IND010';
UPDATE industry_types SET industry_name = 'Software & Services'                              WHERE industry_id = 'IND011';
UPDATE industry_types SET industry_name = 'Consumer Durables & Apparel'                      WHERE industry_id = 'IND013';

INSERT INTO industry_types (industry_id, industry_name, is_active) VALUES
  ('IND012', 'Insurance',                                        true),
  ('IND014', 'Real Estate',                                      true),
  ('IND015', 'Pharmaceuticals, Biotechnology & Life Sciences',   true),
  ('IND016', 'Transportation',                                   true),
  ('IND017', 'Materials',                                        true),
  ('IND018', 'Media & Entertainment',                            true),
  ('IND019', 'Utilities',                                        true),
  ('IND020', 'Household & Personal Products',                    true),
  ('IND021', 'Technology Hardware & Equipment',                  true),
  ('IND022', 'Semiconductors & Semiconductor Equipment',         true)
ON CONFLICT (industry_id) DO NOTHING;
