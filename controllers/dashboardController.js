const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const dashboardController = {
  getDashboard: async (req, res) => {
    try {
      const userId = req.user.id;
      const today = moment().format('YYYY-MM-DD');
      const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
      const nextWeek = moment().add(7, 'days').format('YYYY-MM-DD');
      
      // Get task statistics
      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);

      const stats = {
        pending: allTasks?.filter(t => t.status === 'pending').length || 0,
        in_progress: allTasks?.filter(t => t.status === 'in_progress').length || 0,
        completed: allTasks?.filter(t => t.status === 'completed').length || 0,
        overdue: allTasks?.filter(t => t.due_date && moment(t.due_date).isBefore(today) && t.status !== 'completed').length || 0
      };

      // Get today's tasks - Fixed foreign key syntax
      const { data: todayTasks } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .eq('due_date', today)
        .order('created_at', { ascending: false });

      // Get upcoming tasks (next 7 days) - Fixed foreign key syntax
      const { data: upcomingTasks } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .gte('due_date', tomorrow)
        .lte('due_date', nextWeek)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(10);

      // Get today's schedule - Simplified to avoid foreign key issues
      const { data: todaySchedule } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('start_time', { ascending: true });

      // Get active team members
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, team, is_online')
        .eq('is_active', true)
        .neq('id', userId)
        .order('full_name');

      res.render('dashboard', {
        stats,
        todayTasks: todayTasks || [],
        upcomingTasks: upcomingTasks || [],
        todaySchedule: todaySchedule || [],
        teamMembers: teamMembers || [],
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
  },

  getTasks: async (req, res) => {
    try {
      const userId = req.user.id;
      const { status = 'all', priority = 'all', assigned = 'all' } = req.query;
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `);

      // Apply filters
      if (status !== 'all') {
        query = query.eq('status', status);
      }
      
      if (priority !== 'all') {
        query = query.eq('priority', priority);
      }
      
      if (assigned === 'me') {
        query = query.eq('assigned_to', userId);
      } else if (assigned === 'created') {
        query = query.eq('created_by', userId);
      } else if (assigned === 'all') {
        query = query.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
      }

      const { data: tasks, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      res.render('tasks', {
        tasks: tasks || [],
        filters: { status, priority, assigned },
        moment,
        error: null
      });

    } catch (error) {
      console.error('Get tasks error:', error);
      res.render('tasks', {
        tasks: [],
        filters: { status: 'all', priority: 'all', assigned: 'all' },
        moment,
        error: 'Failed to load tasks'
      });
    }
  },

  getTaskDetails: async (req, res) => {
    try {
      const taskId = req.params.id;

      // Get task with related data
      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;

      // Get team members for assignment
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      // Format the data
      task.assigned_to_name = task.assigned_to_profile?.full_name || null;
      task.created_by_name = task.created_by_profile?.full_name || 'Unknown';

      res.render('task-details', {
        task,
        teamMembers: teamMembers || [],
        moment
      });

    } catch (error) {
      console.error('Get task details error:', error);
      res.status(404).render('error', { error: 'Task not found' });
    }
  },

  postCompleteTask: async (req, res) => {
    try {
      const taskId = req.params.id;

      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      res.json({ success: true, message: 'Task marked as completed' });

    } catch (error) {
      console.error('Complete task error:', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  },

  postStatusUpdate: async (req, res) => {
    try {
      const userId = req.user.id;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const { error } = await supabase
        .from('status_updates')
        .insert({
          user_id: userId,
          message: message.trim(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      res.json({ success: true, message: 'Status updated successfully' });

    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
};

module.exports = dashboardController;