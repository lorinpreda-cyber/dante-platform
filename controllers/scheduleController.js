const { supabase } = require('../lib/supabaseClient');
const moment = require('moment');

const scheduleController = {
  getSchedule: async (req, res) => {
    try {
      const userId = req.user.id;
      const today = moment().format('YYYY-MM-DD');
      
      // Get today's events - FIXED: using user_id instead of created_by
      const { data: todaysEvents } = await supabase
        .from('personal_events')
        .select(`
          *,
          approved_by_profile:profiles!personal_events_approved_by_fkey(full_name)
        `)
        .eq('user_id', userId)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('start_time', { ascending: true });

      // Get upcoming events (next 7 days)
      const nextWeek = moment().add(7, 'days').format('YYYY-MM-DD');
      const { data: upcomingEvents } = await supabase
        .from('personal_events')
        .select(`
          *,
          approved_by_profile:profiles!personal_events_approved_by_fkey(full_name)
        `)
        .eq('user_id', userId)
        .gt('start_date', today)
        .lte('start_date', nextWeek)
        .order('start_date', { ascending: true });

      // Get pending events that need approval
      const { data: pendingEvents } = await supabase
        .from('personal_events')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      res.render('schedule', {
        title: 'Schedule',
        todaysEvents: todaysEvents || [],
        upcomingEvents: upcomingEvents || [],
        pendingEvents: pendingEvents || [],
        moment,
        error: null
      });

    } catch (error) {
      console.error('Schedule error:', error);
      res.render('schedule', {
        title: 'Schedule',
        todaysEvents: [],
        upcomingEvents: [],
        pendingEvents: [],
        moment,
        error: 'Failed to load schedule'
      });
    }
  },

getMyEvents: async (req, res) => {
  console.log('*** getMyEvents function called ***');
  console.log('User ID:', req.user.id);
  
  try {
    const userId = req.user.id;
    
    // Get ALL events first to debug
    const { data: allEvents, error: allError } = await supabase
      .from('personal_events')
      .select('*');
    
    console.log('All events in DB:', allEvents);
    console.log('All events error:', allError);
    
    // Get user-specific events
    const { data: events, error } = await supabase
      .from('personal_events')
      .select('*')
      .eq('user_id', userId);

    console.log('User events:', events);
    console.log('User events error:', error);
    console.log('Events array length:', events ? events.length : 0);

    res.render('my-events', {
      title: 'My Events',
      events: events || [],
      moment: require('moment'),
      error: null
    });

  } catch (error) {
    console.error('My events error:', error);
    res.render('my-events', {
      title: 'My Events',
      events: [],
      moment: require('moment'),
      error: 'Failed to load events'
    });
  }
},

  postCreateEvent: async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        title,
        eventType,
        startDate,
        endDate,
        isAllDay,
        startTime,
        endTime,
        description
      } = req.body;

      // FIXED: using user_id instead of created_by and matching your table schema
      const { data, error } = await supabase
        .from('personal_events')
        .insert({
          user_id: userId, // FIXED: changed from created_by to user_id
          title: title.trim(),
          event_type: eventType,
          start_date: startDate,
          end_date: endDate,
          is_all_day: isAllDay,
          start_time: !isAllDay && startTime ? startTime : null,
          end_time: !isAllDay && endTime ? endTime : null,
          description: description ? description.trim() : null,
          status: 'pending'
        });

      if (error) {
        console.error('Database insert error:', error);
        return res.status(500).json({ success: false, message: `Database error: ${error.message}` });
      }

      console.log('Event created successfully:', data);
      res.json({ success: true, message: 'Event created successfully' });

    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ success: false, message: 'Failed to create event' });
    }
  },

  putUpdateEvent: async (req, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;
      
      const {
        title,
        eventType,
        startDate,
        endDate,
        isAllDay,
        startTime,
        endTime,
        description
      } = req.body;

      const { error } = await supabase
        .from('personal_events')
        .update({
          title: title.trim(),
          event_type: eventType,
          start_date: startDate,
          end_date: endDate,
          is_all_day: isAllDay,
          start_time: !isAllDay && startTime ? startTime : null,
          end_time: !isAllDay && endTime ? endTime : null,
          description: description ? description.trim() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .eq('user_id', userId); // FIXED: using user_id instead of created_by

      if (error) {
        console.error('Update error:', error);
        return res.status(500).json({ success: false, message: error.message });
      }

      res.json({ success: true, message: 'Event updated successfully' });

    } catch (error) {
      console.error('Update event error:', error);
      res.status(500).json({ success: false, message: 'Failed to update event' });
    }
  },

  deleteEvent: async (req, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user.id;

      const { error } = await supabase
        .from('personal_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId); // FIXED: using user_id instead of created_by

      if (error) {
        console.error('Delete error:', error);
        return res.status(500).json({ success: false, message: error.message });
      }

      res.json({ success: true, message: 'Event deleted successfully' });

    } catch (error) {
      console.error('Delete event error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
  }
};

module.exports = scheduleController;