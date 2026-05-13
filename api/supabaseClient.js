const { createClient } = require('@supabase/supabase-js');

// Vercel sometimes doesn't prefix backend vars with NEXT_PUBLIC
// Check both standard and prefixed versions for safety
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Supabase environment variables are missing.");
  // We use a dummy client or null to prevent the entire Node process from crashing on boot
  module.exports = { supabase: null, error: "Missing Env Vars" };
} else {
  const supabase = createClient(supabaseUrl, supabaseKey);
  module.exports = { supabase };
}
