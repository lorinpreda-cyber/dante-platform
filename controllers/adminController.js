const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const adminController = {
  getDashboard: async (req, res) => {
    try {
      // Get pending events that need approval
      const { data: pendingEvents } = await supabase
        .from('personal_events')
        .select(`
          *,
          user_profile:profiles!personal_events_user_id_fkey(full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Get all team members
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        pendingEvents: pendingEvents || [],
        teamMembers: teamMembers || [],
        moment,
        error: null
      });

    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        pendingEvents: [],
        teamMembers: [],
        moment,
        error: 'Failed to load admin data'
      });
    }
  },

  postApproveEvent: async (req, res) => {
    try {
      const eventId = req.params.id;
      const { action } = req.body; // 'approve' or 'deny'

      const status = action === 'approve' ? 'approved' : 'denied';
      
      await supabase
        .from('personal_events')
        .update({
          status,
          approved_by: req.user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', eventId);

      res.json({ 
        success: true, 
        message: `Event ${status} successfully` 
      });

    } catch (error) {
      console.error('Approve event error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update event status' 
      });
    }
  }
};

module.exports = adminController;