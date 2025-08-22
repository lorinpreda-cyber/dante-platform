const { supabase } = require('../lib/supabaseClient');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;
    
    if (!token) {
      return res.redirect('/auth/login');
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Auth error:', error?.message);
      res.clearCookie('access_token');
      return res.redirect('/auth/login');
    }

    // Try to get user profile with error handling
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, team:teams(*)')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single

      if (profileError) {
        console.error('Profile fetch error:', profileError.message);
        // Create a basic profile object if database fails
        profile = {
          id: user.id,
          email: user.email,
          full_name: user.email,
          role: 'member',
          team: null,
          is_active: true
        };
      } else if (!profileData) {
        // Profile doesn't exist, create basic one
        console.log('No profile found, creating basic profile');
        profile = {
          id: user.id,
          email: user.email,
          full_name: user.email,
          role: 'member',
          team: null,
          is_active: true
        };
      } else {
        profile = profileData;
      }
    } catch (dbError) {
      console.error('Database connection error:', dbError.message);
      // Fallback profile
      profile = {
        id: user.id,
        email: user.email,
        full_name: user.email,
        role: 'member',
        team: null,
        is_active: true
      };
    }

    // Set user data in request
    req.user = user;
    req.profile = profile;
    
    // Set global template variables
    res.locals.user = user;
    res.locals.profile = profile;
    res.locals.isAdmin = profile.role === 'admin';
    res.locals.currentPath = req.path;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.clearCookie('access_token');
    res.redirect('/auth/login');
  }
};

module.exports = authMiddleware;