const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      const userId = req.user.id;
      const today = moment().format('YYYY-MM-DD');
      
      // Get basic user stats (simplified for now)
      const stats = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0
      };

      res.render('dashboard', {
        stats,
        todayTasks: [],
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers: [],
        moment,
        error: null
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      res.render('dashboard', {
        stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        todayTasks: [],
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers: [],
        moment,
        error: 'Failed to load dashboard data'
      });
    }
  }
};

module.exports = dashboardController;