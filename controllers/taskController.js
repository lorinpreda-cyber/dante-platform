const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');
const momentTz = require('moment-timezone');

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

  // NEW ROUTINE METHODS - CORRECTED
getMyRoutine: async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's routine tasks with simpler query
    const { data: routineTasks, error } = await supabase
      .from('routine_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Routine tasks query error:', error);
    }

    res.render('my-routine', {
      routineTasks: routineTasks || [],
      moment: require('moment'),
      error: error?.message || null
    });

  } catch (error) {
    console.error('Get my routine error:', error);
    res.render('my-routine', {
      routineTasks: [],
      moment: require('moment'),
      error: 'Failed to load routine tasks'
    });
  }
},

getCreateRoutine: async (req, res) => {
  try {
    res.render('create-routine', {
      error: null
    });
  } catch (error) {
    console.error('Get create routine error:', error);
    res.render('create-routine', {
      error: 'Failed to load form'
    });
  }
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

    if (!title || !start_time || !end_time || !repetition_type) {
      throw new Error('Title, start time, end time, and repetition type are required');
    }

    // Validate time range
    if (start_time >= end_time) {
      throw new Error('End time must be after start time');
    }

    // Process weekly days if repetition is weekly
    let processedWeeklyDays = null;
    if (repetition_type === 'weekly' && weekly_days) {
      processedWeeklyDays = Array.isArray(weekly_days) 
        ? weekly_days.map(day => parseInt(day)) 
        : [parseInt(weekly_days)];
    }

    const routineData = {
      user_id: req.user.id,
      title: title.trim(),
      description: description ? description.trim() : null,
      start_time,
      end_time,
      repetition_type,
      weekly_days: processedWeeklyDays,
      specific_date: repetition_type === 'single' ? specific_date : null,
      timezone: 'Europe/Bucharest',
      is_active: true,
      created_at: new Date().toISOString()
    };

    const { data: newRoutine, error } = await supabase
      .from('routine_tasks')
      .insert(routineData)
      .select()
      .single();

    if (error) {
      console.error('Insert routine error:', error);
      throw error;
    }

    res.redirect('/tasks/my-routine');

  } catch (error) {
    console.error('Create routine error:', error);
    res.render('create-routine', {
      error: error.message || 'Failed to create routine task'
    });
  }
},

getRoutineDetails: async (req, res) => {
  try {
    const routineId = req.params.id;

    const { data: routine, error } = await supabase
      .from('routine_tasks')
      .select('*')
      .eq('id', routineId)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      console.error('Get routine details error:', error);
      throw error;
    }

    res.render('routine-details', {
      routine,
      moment: require('moment'),
      weekDayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    });

  } catch (error) {
    console.error('Get routine details error:', error);
    res.redirect('/tasks/my-routine?error=' + encodeURIComponent('Routine not found'));
  }
},

postUpdateRoutine: async (req, res) => {
  try {
    const routineId = req.params.id;
    const updates = {};

    ['title', 'description', 'start_time', 'end_time', 'repetition_type', 'weekly_days', 'specific_date'].forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'weekly_days' && req.body[field]) {
          updates[field] = Array.isArray(req.body[field]) 
            ? req.body[field].map(day => parseInt(day))
            : [parseInt(req.body[field])];
        } else {
          updates[field] = req.body[field] || null;
        }
      }
    });

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('routine_tasks')
      .update(updates)
      .eq('id', routineId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Routine task updated successfully' });

  } catch (error) {
    console.error('Update routine error:', error);
    res.status(500).json({ error: 'Failed to update routine task' });
  }
},

deleteRoutine: async (req, res) => {
  try {
    const routineId = req.params.id;

    const { error } = await supabase
      .from('routine_tasks')
      .update({ is_active: false })
      .eq('id', routineId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Routine task deleted successfully' });

  } catch (error) {
    console.error('Delete routine error:', error);
    res.status(500).json({ error: 'Failed to delete routine task' });
  }
},

getTeamRoutines: async (req, res) => {
  try {
    const { date } = req.query;
    const selectedDate = date || require('moment')().format('YYYY-MM-DD');
    const dayOfWeek = require('moment')(selectedDate).day();
    
    // Get all active routine tasks
    const { data: allRoutines, error } = await supabase
      .from('routine_tasks')
      .select(`
        *,
        profiles!user_id(full_name, email)
      `)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Team routines query error:', error);
    }

    // Filter routines based on repetition type and selected date
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

    // Add user profile info to each routine
    const routinesWithProfiles = applicableRoutines.map(routine => ({
      ...routine,
      user_profile: routine.profiles ? { full_name: routine.profiles.full_name } : { full_name: 'Unknown User' }
    }));

    res.render('team-routines', {
      routines: routinesWithProfiles,
      selectedDate,
      moment: require('moment'),
      dayOfWeek,
      error: error?.message || null
    });

  } catch (error) {
    console.error('Get team routines error:', error);
    res.render('team-routines', {
      routines: [],
      selectedDate: require('moment')().format('YYYY-MM-DD'),
      moment: require('moment'),
      dayOfWeek: require('moment')().day(),
      error: 'Failed to load team routines'
    });
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
  },
   checkUserAvailability: async (req, res) => {
    try {
      const { userId, date } = req.query;
      
      // Check if user has a schedule for that date
      const { data: schedule, error: scheduleError } = await supabase
        .from('user_schedules')
        .select(`
          *,
          shift_template:shift_templates(name, start_time, end_time)
        `)
        .eq('user_id', userId)
        .eq('date', date)
        .single();
      
      // Check if user has any personal events on that date
      const { data: events, error: eventsError } = await supabase
        .from('personal_events')
        .select('*')
        .eq('user_id', userId)
        .lte('start_date', date)
        .gte('end_date', date);
      
      const availability = {
        isScheduled: !!schedule,
        schedule: schedule || null,
        hasPersonalEvents: events && events.length > 0,
        events: events || [],
        warning: null
      };
      
      // Generate warning message
      if (!schedule && (!events || events.length === 0)) {
        availability.warning = 'User has no scheduled shift for this date';
      } else if (!schedule && events && events.length > 0) {
        availability.warning = `User has personal events: ${events.map(e => e.title).join(', ')}`;
      } else if (schedule && events && events.length > 0) {
        availability.warning = `User is scheduled but also has events: ${events.map(e => e.title).join(', ')}`;
      }
      
      res.json({ success: true, availability });
    } catch (error) {
      console.error('Error checking user availability:', error);
      res.status(500).json({ success: false, message: 'Error checking availability' });
    }
  }
};

module.exports = taskController;