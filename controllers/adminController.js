const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const adminController = {
  getDashboard: async (req, res) => {
    try {
      // Get pending events - FIXED: Removed the problematic join
      const { data: pendingEvents, error } = await supabase
        .from('personal_events')
        .select('*')  // Removed the join to profiles
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('Pending events query error:', error);
      console.log('Pending events found:', pendingEvents);

      // If we have pending events, get user details separately
      let eventsWithUsers = [];
      if (pendingEvents && pendingEvents.length > 0) {
        for (const event of pendingEvents) {
          // Get user profile for each event
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.user_id)
            .single();
          
          eventsWithUsers.push({
            ...event,
            user_profile: userProfile || { full_name: 'Unknown', email: 'Unknown' }
          });
        }
      }

      // Get all team members
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        pendingEvents: eventsWithUsers || [],
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
      const { action } = req.body;

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