import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CashTransaction {
  id: string;
  type: 'Addition' | 'Deduction';
  description: string;
  code?: string;
  amount: number;
  date: string;
  timestamp: string;
  running_balance: number;
  entity_id?: string;
  reference_id?: string;
  created_by: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  od_limit: number;
}
