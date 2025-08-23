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
  }
};

module.exports = taskController;