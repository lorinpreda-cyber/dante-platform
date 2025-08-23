const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      const userId = req.user.id;
      const today = moment().format('YYYY-MM-DD');
      
      // Get today's tasks - fix the query
      const { data: todayTasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *, 
          created_by_profile:profiles!tasks_created_by_fkey(full_name),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)
        `)
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get ALL tasks for statistics - fix this query
      const { data: allUserTasks, error: allTasksError } = await supabase
        .from('tasks')
        .select('status')
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`);

      // Calculate statistics from all tasks
      let stats = { pending: 0, in_progress: 0, completed: 0, overdue: 0 };
      if (!allTasksError && allUserTasks) {
        stats = allUserTasks.reduce((acc, task) => {
          if (task.status === 'pending') acc.pending++;
          else if (task.status === 'in_progress') acc.in_progress++;
          else if (task.status === 'completed') acc.completed++;
          else if (task.status === 'overdue') acc.overdue++;
          return acc;
        }, { pending: 0, in_progress: 0, completed: 0, overdue: 0 });
      }

      // Get upcoming deadlines
      const { data: upcomingTasks, error: upcomingError } = await supabase
        .from('tasks')
        .select(`
          *, 
          created_by_profile:profiles!tasks_created_by_fkey(full_name),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)
        `)
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .not('status', 'eq', 'completed')
        .not('due_date', 'is', null)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      console.log('Dashboard Debug:', {
        userId,
        today,
        todayTasksCount: todayTasks?.length || 0,
        allTasksCount: allUserTasks?.length || 0,
        stats,
        todayTasksError: tasksError?.message,
        allTasksError: allTasksError?.message
      });

      res.render('dashboard', {
        todayTasks: todayTasks || [],
        upcomingTasks: upcomingTasks || [],
        todaySchedule: [],
        teamMembers: [],
        stats,
        moment,
        error: tasksError?.message || allTasksError?.message
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      res.render('dashboard', {
        todayTasks: [],
        upcomingTasks: [],
        todaySchedule: [],
        teamMembers: [],
        stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
        moment,
        error: 'Failed to load dashboard data'
      });
    }
  }
};

module.exports = dashboardController;