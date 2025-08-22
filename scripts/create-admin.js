// Load environment variables FIRST
require('dotenv').config();

const { supabaseAdmin } = require('../lib/supabaseClient');

async function createAdmin() {
  try {
    console.log('Creating admin user...');
    
    // Create admin user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'lorin.preda@konecta.com',
      password: 'AdminPass123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Lorin Preda'
      }
    });

    if (authError) {
      console.error('Error creating admin user:', authError.message);
      return;
    }

    console.log('✓ Admin user created successfully!');
    console.log('Email: lorin.preda@konecta.com');
    console.log('Password: AdminPass123!');
    console.log('User ID:', authUser.user.id);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createAdmin();