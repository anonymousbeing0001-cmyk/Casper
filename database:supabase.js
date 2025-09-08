const { createClient } = require('@supabase/supabase-js');

let supabase;

function initSupabase() {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    return true;
  } catch (error) {
    console.error('Supabase initialization error:', error);
    return false;
  }
}

async function storeInSupabase(data) {
  if (!supabase) return false;
  
  try {
    const { error } = await supabase
      .from('memories')
      .insert([data]);
    
    return !error;
  } catch (error) {
    console.error('Supabase storage error:', error);
    return false;
  }
}

module.exports = {
  initSupabase,
  storeInSupabase
};