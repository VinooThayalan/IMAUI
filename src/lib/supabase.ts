import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Bearer token for calls to our own edge functions. The functions verify the
 * signed-in user, so the publishable anon key is not an acceptable substitute.
 */
export async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

export interface CashTransaction {
  id: string;
  type: 'Addition' | 'Deduction';
  description: string;
  code?: string;
  amount: number;
  date: string;
  timestamp: string;
  running_balance: number;
  on_hold_amount: number;
  entity_id?: string;
  bank_id?: string;
  reference_id?: string;
  created_by: string;
  notes?: string;
  source?: string;
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
