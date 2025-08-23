const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const taskController = {
  getTasks: async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, search } = req.query;
      
      let query = supabase
        .from('tasks')
        .select(`
          *, 
          created_by_profile:profiles!tasks_created_by_fkey(full_name),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)
        `)
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .order('created_at', { ascending: false });

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: tasks, error } = await query;
      
      // Get team members for filter dropdown
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      res.render('tasks', {
        tasks: tasks || [],
        teamMembers: teamMembers || [],
        filters: { status, search },
        moment,
        error: error?.message
      });

    } catch (error) {
      console.error('Get tasks error:', error);
      res.render('tasks', {
        tasks: [],
        teamMembers: [],
        filters: {},
        moment,
        error: 'Failed to load tasks'
      });
    }
  },

  getCreateTask: async (req, res) => {
    try {
      // Get team members for assignment
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, team:teams(name)')
        .eq('is_active', true)
        .order('full_name');

      res.render('create-task', {
        teamMembers: teamMembers || [],
        error: null
      });

    } catch (error) {
      console.error('Get create task error:', error);
      res.render('create-task', {
        teamMembers: [],
        error: 'Failed to load form data'
      });
    }
  },

  postCreateTask: async (req, res) => {
    try {
      const {
        title,
        description,
        assigned_to,
        due_date,
        priority
      } = req.body;

      const taskData = {
        title,
        description,
        created_by: req.user.id,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        priority: priority || 'medium'
      };

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      res.redirect(`/tasks/${newTask.id}`);

    } catch (error) {
      console.error('Create task error:', error);
      
      // Get team members again for form
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, team:teams(name)')
        .eq('is_active', true)
        .order('full_name');

      res.render('create-task', {
        teamMembers: teamMembers || [],
        error: 'Failed to create task'
      });
    }
  },

  getTaskDetails: async (req, res) => {
    try {
      const taskId = req.params.id;

      // Get task details
      const { data: task, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!tasks_created_by_fkey(full_name, email),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name, email)
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

  postUpdateTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const updates = {};

      ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to'].forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field] || null;
        }
      });

      if (updates.status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      res.json({ success: true, message: 'Task updated successfully' });

    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
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

  postAssignTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { assigned_to } = req.body;

      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to })
        .eq('id', taskId);

      if (error) throw error;

      res.json({ success: true, message: 'Task reassigned successfully' });

    } catch (error) {
      console.error('Assign task error:', error);
      res.status(500).json({ error: 'Failed to reassign task' });
    }
  },

  postAddComment: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: req.user.id,
          content: content.trim(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      res.json({ success: true, message: 'Comment added successfully' });

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  },

  // SCHEDULE ROUTES
  getSchedule: async (req, res) => {
    try {
      const userId = req.user.id;
      const { date } = req.query;
      const selectedDate = date || moment().format('YYYY-MM-DD');
      
      // Get scheduled tasks for the selected date
      const { data: scheduledTasks } = await supabase
        .from('scheduled_tasks')
        .select(`
          *,
          user_profile:profiles!scheduled_tasks_user_id_fkey(full_name, email)
        `)
        .eq('date', selectedDate)
        .order('start_time', { ascending: true });

      // Get team members for the team view
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, team')
        .eq('is_active', true)
        .order('full_name');

      res.render('schedule', {
        scheduledTasks: scheduledTasks || [],
        teamMembers: teamMembers || [],
        selectedDate,
        moment,
        error: null
      });

    } catch (error) {
      console.error('Get schedule error:', error);
      res.render('schedule', {
        scheduledTasks: [],
        teamMembers: [],
        selectedDate: moment().format('YYYY-MM-DD'),
        moment,
        error: 'Failed to load schedule'
      });
    }
  },

  postCreateScheduledTask: async (req, res) => {
    try {
      const {
        title,
        description,
        date,
        start_time,
        end_time,
        status,
        is_recurring,
        recurring_days
      } = req.body;

      if (!title || !date || !start_time || !end_time) {
        return res.status(400).json({ 
          error: 'Title, date, start time, and end time are required' 
        });
      }

      // Check for time conflicts
      const { data: conflicts } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('date', date)
        .or(`and(start_time.lte.${start_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${end_time}),and(start_time.gte.${start_time},end_time.lte.${end_time})`);

      if (conflicts && conflicts.length > 0) {
        return res.status(400).json({ 
          error: 'You have a conflicting scheduled task at this time' 
        });
      }

      const scheduledTaskData = {
        user_id: req.user.id,
        title,
        description,
        date,
        start_time,
        end_time,
        status: status || 'ongoing',
        is_recurring: is_recurring || false,
        recurring_days: recurring_days || null,
        created_at: new Date().toISOString()
      };

      const { data: newScheduledTask, error } = await supabase
        .from('scheduled_tasks')
        .insert(scheduledTaskData)
        .select()
        .single();

      if (error) throw error;

      res.json({ 
        success: true, 
        message: 'Scheduled task created successfully',
        task: newScheduledTask 
      });

    } catch (error) {
      console.error('Create scheduled task error:', error);
      res.status(500).json({ error: 'Failed to create scheduled task' });
    }
  },

  postUpdateScheduledTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const updates = {};

      ['title', 'description', 'date', 'start_time', 'end_time', 'status'].forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      updates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('scheduled_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', req.user.id); // Only allow users to update their own scheduled tasks

      if (error) throw error;

      res.json({ success: true, message: 'Scheduled task updated successfully' });

    } catch (error) {
      console.error('Update scheduled task error:', error);
      res.status(500).json({ error: 'Failed to update scheduled task' });
    }
  },

  deleteScheduledTask: async (req, res) => {
    try {
      const taskId = req.params.id;

      const { error } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', req.user.id); // Only allow users to delete their own scheduled tasks

      if (error) throw error;

      res.json({ success: true, message: 'Scheduled task deleted successfully' });

    } catch (error) {
      console.error('Delete scheduled task error:', error);
      res.status(500).json({ error: 'Failed to delete scheduled task' });
    }
  }
};

module.exports = taskController;