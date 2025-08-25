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

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (search && search.trim()) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: tasks } = await query;
      
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      res.render('tasks', {
        title: 'Tasks',
        tasks: tasks || [],
        teamMembers: teamMembers || [],
        filters: { status, search },
        moment,
        error: null
      });

    } catch (error) {
      console.error('Get tasks error:', error);
      res.render('tasks', {
        title: 'Tasks',
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
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      res.render('create-task', {
        title: 'Create Task',
        teamMembers: teamMembers || [],
        error: null
      });

    } catch (error) {
      res.render('create-task', {
        title: 'Create Task',
        teamMembers: [],
        error: 'Failed to load form'
      });
    }
  },

  postCreateTask: async (req, res) => {
    try {
      const { title, description, assigned_to, due_date, priority } = req.body;

      const { data: newTask } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          created_by: req.user.id,
          assigned_to: assigned_to || null,
          due_date: due_date || null,
          priority: priority || 'medium'
        })
        .select()
        .single();

      res.redirect(`/tasks/${newTask.id}`);

    } catch (error) {
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      res.render('create-task', {
        title: 'Create Task',
        teamMembers: teamMembers || [],
        error: 'Failed to create task'
      });
    }
  },

  getTaskDetails: async (req, res) => {
    try {
      const taskId = req.params.id;

      const { data: task } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!tasks_created_by_fkey(full_name, email),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name, email)
        `)
        .eq('id', taskId)
        .single();

      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      res.render('task-details', {
        title: 'Task Details',
        task,
        teamMembers: teamMembers || [],
        moment
      });

    } catch (error) {
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

      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      res.json({ success: true, message: 'Task updated successfully' });

    } catch (error) {
      res.status(500).json({ error: 'Failed to update task' });
    }
  },

  postCompleteTask: async (req, res) => {
    try {
      const taskId = req.params.id;

      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      res.json({ success: true, message: 'Task marked as completed' });

    } catch (error) {
      res.status(500).json({ error: 'Failed to complete task' });
    }
  },

  postAssignTask: async (req, res) => {
    try {
      const taskId = req.params.id;
      const { assigned_to } = req.body;

      await supabase
        .from('tasks')
        .update({ assigned_to })
        .eq('id', taskId);

      res.json({ success: true, message: 'Task reassigned successfully' });

    } catch (error) {
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

      await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: req.user.id,
          content: content.trim()
        });

      res.json({ success: true, message: 'Comment added successfully' });

    } catch (error) {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  },

  // ROUTINE METHODS
  getMyRoutine: async (req, res) => {
    try {
      const userId = req.user.id;
      
      const { data: routineTasks } = await supabase
        .from('routine_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      res.render('my-routine', {
        title: 'My Routine',
        routineTasks: routineTasks || [],
        moment,
        error: null
      });

    } catch (error) {
      res.render('my-routine', {
        title: 'My Routine',
        routineTasks: [],
        moment,
        error: 'Failed to load routine tasks'
      });
    }
  },

  getCreateRoutine: async (req, res) => {
    res.render('create-routine', {
      title: 'Create Routine',
      error: null
    });
  },

  postCreateRoutine: async (req, res) => {
    try {
      const {
        title,
        description,
        start_time,
        end_time,
        repetition_type,
        weekly_days,
        specific_date
      } = req.body;

      let processedWeeklyDays = null;
      if (repetition_type === 'weekly' && weekly_days) {
        processedWeeklyDays = Array.isArray(weekly_days) 
          ? weekly_days.map(day => parseInt(day)) 
          : [parseInt(weekly_days)];
      }

      await supabase
        .from('routine_tasks')
        .insert({
          user_id: req.user.id,
          title: title.trim(),
          description: description ? description.trim() : null,
          start_time,
          end_time,
          repetition_type,
          weekly_days: processedWeeklyDays,
          specific_date: repetition_type === 'single' ? specific_date : null,
          timezone: 'Europe/Bucharest',
          is_active: true
        });

      res.redirect('/tasks/my-routine');

    } catch (error) {
      res.render('create-routine', {
        title: 'Create Routine',
        error: 'Failed to create routine task'
      });
    }
  },

  getRoutineDetails: async (req, res) => {
    try {
      const routineId = req.params.id;

      const { data: routine } = await supabase
        .from('routine_tasks')
        .select('*')
        .eq('id', routineId)
        .eq('user_id', req.user.id)
        .single();

      res.render('routine-details', {
        title: 'Routine Details',
        routine,
        moment,
        weekDayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      });

    } catch (error) {
      res.redirect('/tasks/my-routine?error=Routine not found');
    }
  },

  postUpdateRoutine: async (req, res) => {
    try {
      const routineId = req.params.id;
      const updates = {};

      ['title', 'description', 'start_time', 'end_time', 'repetition_type'].forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field] || null;
        }
      });

      updates.updated_at = new Date().toISOString();

      await supabase
        .from('routine_tasks')
        .update(updates)
        .eq('id', routineId)
        .eq('user_id', req.user.id);

      res.json({ success: true, message: 'Routine task updated successfully' });

    } catch (error) {
      res.status(500).json({ error: 'Failed to update routine task' });
    }
  },

  deleteRoutine: async (req, res) => {
    try {
      const routineId = req.params.id;

      await supabase
        .from('routine_tasks')
        .update({ is_active: false })
        .eq('id', routineId)
        .eq('user_id', req.user.id);

      res.json({ success: true, message: 'Routine task deleted successfully' });

    } catch (error) {
      res.status(500).json({ error: 'Failed to delete routine task' });
    }
  },

  getTeamRoutines: async (req, res) => {
    try {
      const { date } = req.query;
      const selectedDate = date || moment().format('YYYY-MM-DD');
      const dayOfWeek = moment(selectedDate).day();
      
      const { data: allRoutines } = await supabase
        .from('routine_tasks')
        .select(`
          *,
          profiles!user_id(full_name)
        `)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      const applicableRoutines = (allRoutines || []).filter(routine => {
        if (routine.repetition_type === 'daily') {
          return true;
        } else if (routine.repetition_type === 'weekly') {
          return routine.weekly_days && routine.weekly_days.includes(dayOfWeek);
        } else if (routine.repetition_type === 'single') {
          return routine.specific_date === selectedDate;
        }
        return false;
      });

      const routinesWithProfiles = applicableRoutines.map(routine => ({
        ...routine,
        user_profile: routine.profiles ? { full_name: routine.profiles.full_name } : { full_name: 'Unknown User' }
      }));

      res.render('team-routines', {
        title: 'Team Routines',
        routines: routinesWithProfiles,
        selectedDate,
        moment,
        dayOfWeek,
        error: null
      });

    } catch (error) {
      res.render('team-routines', {
        title: 'Team Routines',
        routines: [],
        selectedDate: moment().format('YYYY-MM-DD'),
        moment,
        dayOfWeek: moment().day(),
        error: 'Failed to load team routines'
      });
    }
  }
};

module.exports = taskController;