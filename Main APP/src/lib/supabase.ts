import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dlzlkqdsyweznkyyvanv.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsemxrcWRzeXdlem5reXl2YW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODQ2NDAsImV4cCI6MjA5MTU2MDY0MH0.xD8GX8W1xPz0sjOyF31aikasWVFQyNrQoJVOOOIGKbk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface DoctorEntry {
  address: string;
  name: string;
  specialty: string | null;
  created_at: string;
}

export async function getDoctorByAddress(address: string): Promise<DoctorEntry | null> {
  const { data } = await supabase
    .from('doctors')
    .select('*')
    .eq('address', address)
    .maybeSingle();
  return data;
}

export async function registerDoctor(
  address: string,
  name: string,
  specialty?: string
): Promise<DoctorEntry | null> {
  const { data } = await supabase
    .from('doctors')
    .upsert({ address, name, specialty: specialty || null }, { onConflict: 'address' })
    .select()
    .single();
  return data;
}

export async function searchDoctors(query: string): Promise<DoctorEntry[]> {
  if (!query || query.length < 2) return [];
  const { data } = await supabase
    .from('doctors')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(8);
  return data || [];
}

export async function getAllDoctors(): Promise<DoctorEntry[]> {
  const { data } = await supabase
    .from('doctors')
    .select('*')
    .order('name');
  return data || [];
}
