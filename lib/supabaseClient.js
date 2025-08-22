// Load environment variables FIRST
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug logging (remove this later)
console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('Anon Key:', supabaseAnonKey ? 'Set' : 'Missing');
console.log('Service Key:', supabaseServiceRoleKey ? 'Set' : 'Missing');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is missing from environment variables');
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is missing from environment variables');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from environment variables');
}

// Client for authenticated requests (uses RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for service operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase, supabaseAdmin };