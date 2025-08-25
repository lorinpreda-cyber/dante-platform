const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      console.log('Dashboard request for user:', req.user?.id);
      
      const userId = req.user?.id;
      if (!userId) {
        console.error('No user ID found in request');
        return res.redirect('/auth/login');
      }

      const today = moment().format('YYYY-MM-DD');
      
      // Initialize with default values
      let stats = { pending: 0, in_progress: 0, completed: 0, overdue: 0 };
      let todayTasks = [];
      let upcomingTasks = [];
      let todaySchedule = [];
      let teamMembers = [];

      try {
        // Get basic task statistics
        const { data: allTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('status, due_date')
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);

        if (tasksError) {
          console.error('Tasks query error:', tasksError.message);
        } else if (allTasks) {
          stats = {
            pending: allTasks.filter(t => t.status === 'pending').length || 0,
            in_progress: allTasks.filter(t => t.status === 'in_progress').length || 0,
            completed: allTasks.filter(t => t.status === 'completed').length || 0,
            overdue: allTasks.filter(t => t.due_date && moment(t.due_date).isBefore(today) && t.status !== 'completed').length || 0
          };
        }
      } catch (error) {
        console.error('Error getting task stats:', error.message);
      }

      try {
        // Get today's tasks with profile joins
        const { data: todayTasksData, error: todayError } = await supabase
          .from('tasks')
          .select(`
            *,
            assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
            created_by_profile:profiles!tasks_created_by_fkey(full_name)
          `)
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
          .eq('due_date', today)
          .order('created_at', { ascending: false });

        if (todayError) {
          console.error('Today tasks query error:', todayError.message);
        } else {
          todayTasks = todayTasksData || [];
        }
      } catch (error) {
        console.error('Error getting today tasks:', error.message);
      }

      try {
        // Get team members
        const { data: teamData, error: teamError } = await supabase
          .from('profiles')
          .select('id, full_name, team')
          .eq('is_active', true)
          .neq('id', userId)
          .order('full_name');

        if (teamError) {
          console.error('Team query error:', teamError.message);
        } else {
          teamMembers = teamData || [];
        }
      } catch (error) {
        console.error('Error getting team members:', error.message);
      }

      try {
        // Get today's schedule from user_schedules table
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('user_schedules')
          .select(`
            *,
            shift_templates(name, start_time, end_time)
          `)
          .eq('user_id', userId)
          .eq('date', today)
          .order('start_time', { ascending: true });

        if (scheduleError) {
          console.error('Schedule query error:', scheduleError.message);
        } else {
          todaySchedule = scheduleData || [];
        }
      } catch (error) {
        console.error('Error getting schedule:', error.message);
      }

      console.log('Rendering dashboard with data:', {
        stats,
        todayTasksCount: todayTasks.length,
        teamMembersCount: teamMembers.length,
        scheduleCount: todaySchedule.length
      });

      res.render('dashboard', {
        title: 'Dashboard',
        stats,
        todayTasks,
        upcomingTasks,
        todaySchedule,
        teamMembers,
        moment,
        error: null
      });

    } catch (error) {
      console.error('Dashboard controller error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Fallback render with error message
      res.render('dashboard', {
        title: 'Dashboard',
        stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        todayTasks: [],
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers: [],
        moment,
        error: 'Dashboard failed to load: ' + error.message
      });
    }
  }
};

module.exports = dashboardController;