const { supabase } = require('../lib/supabaseClient');

const authController = {
  getLogin: (req, res) => {
    if (req.cookies.access_token) {
      return res.redirect('/dashboard');
    }
    res.render('login', { error: null, success: null });
  },

  postLogin: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.render('login', { error: error.message, success: null });
      }

      res.cookie('access_token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      res.redirect('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      res.render('login', { error: 'Login failed', success: null });
    }
  },

  postLogout: (req, res) => {
    res.clearCookie('access_token');
    res.redirect('/auth/login');
  }
};

module.exports = authController;