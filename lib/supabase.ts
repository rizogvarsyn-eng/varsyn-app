import { createClient } from '@supabase/supabase-js';

// --- JANGAN LUPA HAPUS INI NANTI PAS MAU DEPLOY ---
// Paste URL Project Supabase lu di dalam tanda kutip di bawah:
const supabaseUrl = "https://tgolvhoiuwuggqbnqals.supabase.co"; 

// Paste Anon Key (yang panjang) di dalam tanda kutip di bawah:
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2x2aG9pdXd1Z2dxYm5xYWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTAzNzUsImV4cCI6MjA4MzAyNjM3NX0.IMq0AtriZFwiKUKKffr5zVkPu3T_rAh_MXf_JunVtI4"; 

// Cek di terminal apakah kebaca
console.log("Cek URL:", supabaseUrl); 

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Kunci masih kosong bos!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);