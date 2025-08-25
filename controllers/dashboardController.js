const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.redirect('/auth/login');
      }

      const today = moment().format('YYYY-MM-DD');
      
      // Get basic task statistics
      let stats = { pending: 0, in_progress: 0, completed: 0, overdue: 0 };
      
      try {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('status, due_date')
          .or(`created_by.eq.${userId},assigned_to.eq.${userId}`);

        if (tasks) {
          stats = {
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            overdue: tasks.filter(t => t.due_date && moment(t.due_date).isBefore(today) && t.status !== 'completed').length
          };
        }
      } catch (error) {
        console.error('Stats error:', error);
      }

      // Get today's tasks
      let todayTasks = [];
      try {
        const { data: todayTasksData } = await supabase
          .from('tasks')
          .select(`
            *,
            assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
            created_by_profile:profiles!tasks_created_by_fkey(full_name)
          `)
          .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
          .eq('due_date', today)
          .order('created_at', { ascending: false });
        
        todayTasks = todayTasksData || [];
      } catch (error) {
        console.error('Today tasks error:', error);
      }

      // Get team members
      let teamMembers = [];
      try {
        const { data: teamData } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_online')
          .eq('is_active', true)
          .neq('id', userId)
          .order('full_name');
        
        teamMembers = teamData || [];
      } catch (error) {
        console.error('Team members error:', error);
      }

      res.render('dashboard', {
        title: 'Dashboard',
        stats,
        todayTasks,
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers,
        moment,
        error: null
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      res.render('dashboard', {
        title: 'Dashboard',
        stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        todayTasks: [],
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers: [],
        moment,
        error: 'Failed to load dashboard'
      });
    }
  }
};

module.exports = dashboardController;