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
      res.clearCookie('access_token');
      return res.redirect('/auth/login');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, team:teams(*)')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.redirect('/auth/login');
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
    console.error('Auth middleware error:', error);
    res.clearCookie('access_token');
    res.redirect('/auth/login');
  }
};

module.exports = authMiddleware;