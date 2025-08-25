const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Set timezone for Romania
moment.tz.setDefault('Europe/Bucharest');

const scheduleController = {
    // Render advanced schedule page
    async renderAdvancedSchedule(req, res) {
        try {
            const user = req.user;
            const weekOffset = parseInt(req.query.week) || 0;
            
            // Calculate week dates
            const startOfWeek = moment().add(weekOffset, 'weeks').startOf('isoWeek');
            const endOfWeek = moment().add(weekOffset, 'weeks').endOf('isoWeek');
            
            // Get all users
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .order('full_name');
            
            if (usersError) throw usersError;
            
            // Get shift templates
            const { data: shiftTemplates, error: templatesError } = await supabase
                .from('shift_templates')
                .select('*')
                .order('name');
            
            if (templatesError) throw templatesError;
            
            // Get schedules for the week
            const { data: schedules, error: schedulesError } = await supabase
                .from('user_schedules')
                .select(`
                    *,
                    shift_template:shift_templates(*)
                `)
                .gte('date', startOfWeek.format('YYYY-MM-DD'))
                .lte('date', endOfWeek.format('YYYY-MM-DD'));
            
            if (schedulesError) throw schedulesError;
            
            // Get personal events for the week
            const { data: personalEvents, error: eventsError } = await supabase
                .from('personal_events')
                .select('*')
                .lte('start_date', endOfWeek.format('YYYY-MM-DD'))
                .gte('end_date', startOfWeek.format('YYYY-MM-DD'));
            
            if (eventsError) throw eventsError;
            
            // Create week structure
            const weekDays = [];
            for (let i = 0; i < 7; i++) {
                weekDays.push(moment(startOfWeek).add(i, 'days'));
            }
            
            // Organize data
            const scheduleMatrix = {};
            users.forEach(user => {
                scheduleMatrix[user.id] = {
                    user: user,
                    days: {}
                };
                
                weekDays.forEach(day => {
                    const dayKey = day.format('YYYY-MM-DD');
                    scheduleMatrix[user.id].days[dayKey] = {
                        date: day,
                        schedule: schedules.find(s => s.user_id === user.id && s.date === dayKey),
                        events: personalEvents.filter(e => 
                            e.user_id === user.id && 
                            dayKey >= e.start_date && 
                            dayKey <= e.end_date
                        )
                    };
                });
            });
            
            res.render('advanced-schedule', {
                title: 'Advanced Schedule',
                user: user,
                scheduleMatrix: scheduleMatrix,
                weekDays: weekDays,
                shiftTemplates: shiftTemplates,
                weekOffset: weekOffset,
                currentWeek: weekOffset === 0,
                moment: moment
            });
            
        } catch (error) {
            console.error('Error rendering advanced schedule:', error);
            req.flash('error', 'Error loading schedule');
            res.redirect('/dashboard');
        }
    },

    // Get schedule data for a specific week
    async getScheduleData(req, res) {
        try {
            const { week = 0 } = req.query;
            const weekOffset = parseInt(week);
            
            const startOfWeek = moment().add(weekOffset, 'weeks').startOf('isoWeek');
            const endOfWeek = moment().add(weekOffset, 'weeks').endOf('isoWeek');
            
            const { data: schedules, error } = await supabase
                .from('user_schedules')
                .select(`
                    *,
                    shift_template:shift_templates(*),
                    user:profiles(full_name)
                `)
                .gte('date', startOfWeek.format('YYYY-MM-DD'))
                .lte('date', endOfWeek.format('YYYY-MM-DD'));
            
            if (error) throw error;
            
            res.json({ success: true, schedules });
        } catch (error) {
            console.error('Error getting schedule data:', error);
            res.status(500).json({ success: false, message: 'Error loading schedule data' });
        }
    },

    // Assign shift to user
    async assignShift(req, res) {
        try {
            const { userId, date, shiftTemplateId } = req.body;
            const user = req.user;
            
            // Check if user is admin
            if (user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Only admins can assign shifts' });
            }
            
            // Get shift template details
            const { data: shiftTemplate, error: templateError } = await supabase
                .from('shift_templates')
                .select('*')
                .eq('id', shiftTemplateId)
                .single();
            
            if (templateError) throw templateError;
            
            // Upsert schedule
            const scheduleData = {
                user_id: userId,
                date: date,
                shift_template_id: shiftTemplateId,
                start_time: shiftTemplate.start_time,
                end_time: shiftTemplate.end_time,
                is_overnight: shiftTemplate.is_overnight,
                is_split: shiftTemplate.is_split,
                split_start_time: shiftTemplate.split_start_time,
                split_end_time: shiftTemplate.split_end_time,
                created_by: user.id
            };
            
            const { data, error } = await supabase
                .from('user_schedules')
                .upsert(scheduleData, { onConflict: 'user_id,date' })
                .select(`
                    *,
                    shift_template:shift_templates(*)
                `);
            
            if (error) throw error;
            
            res.json({ success: true, schedule: data[0] });
        } catch (error) {
            console.error('Error assigning shift:', error);
            res.status(500).json({ success: false, message: 'Error assigning shift' });
        }
    },

    // Remove shift assignment
    async removeShift(req, res) {
        try {
            const { userId, date } = req.body;
            const user = req.user;
            
            // Check if user is admin
            if (user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Only admins can remove shifts' });
            }
            
            const { error } = await supabase
                .from('user_schedules')
                .delete()
                .eq('user_id', userId)
                .eq('date', date);
            
            if (error) throw error;
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error removing shift:', error);
            res.status(500).json({ success: false, message: 'Error removing shift' });
        }
    },

    // Bulk assign shifts
    async bulkAssignShifts(req, res) {
        try {
            const { userIds, dates, shiftTemplateId } = req.body;
            const user = req.user;
            
            // Check if user is admin
            if (user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Only admins can assign shifts' });
            }
            
            // Get shift template details
            const { data: shiftTemplate, error: templateError } = await supabase
                .from('shift_templates')
                .select('*')
                .eq('id', shiftTemplateId)
                .single();
            
            if (templateError) throw templateError;
            
            // Prepare bulk data
            const bulkData = [];
            userIds.forEach(userId => {
                dates.forEach(date => {
                    bulkData.push({
                        user_id: userId,
                        date: date,
                        shift_template_id: shiftTemplateId,
                        start_time: shiftTemplate.start_time,
                        end_time: shiftTemplate.end_time,
                        is_overnight: shiftTemplate.is_overnight,
                        is_split: shiftTemplate.is_split,
                        split_start_time: shiftTemplate.split_start_time,
                        split_end_time: shiftTemplate.split_end_time,
                        created_by: user.id
                    });
                });
            });
            
            const { data, error } = await supabase
                .from('user_schedules')
                .upsert(bulkData, { onConflict: 'user_id,date' });
            
            if (error) throw error;
            
            res.json({ success: true, message: `${bulkData.length} shifts assigned successfully` });
        } catch (error) {
            console.error('Error bulk assigning shifts:', error);
            res.status(500).json({ success: false, message: 'Error assigning shifts' });
        }
    },

    // Copy shifts from one user to others
    async copyShifts(req, res) {
        try {
            const { sourceUserId, targetUserIds, startDate, endDate } = req.body;
            const user = req.user;
            
            // Check if user is admin
            if (user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Only admins can copy shifts' });
            }
            
            // Get source user's schedules
            const { data: sourceSchedules, error: sourceError } = await supabase
                .from('user_schedules')
                .select('*')
                .eq('user_id', sourceUserId)
                .gte('date', startDate)
                .lte('date', endDate);
            
            if (sourceError) throw sourceError;
            
            // Prepare bulk data for target users
            const bulkData = [];
            targetUserIds.forEach(targetUserId => {
                sourceSchedules.forEach(schedule => {
                    bulkData.push({
                        user_id: targetUserId,
                        date: schedule.date,
                        shift_template_id: schedule.shift_template_id,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time,
                        is_overnight: schedule.is_overnight,
                        is_split: schedule.is_split,
                        split_start_time: schedule.split_start_time,
                        split_end_time: schedule.split_end_time,
                        created_by: user.id
                    });
                });
            });
            
            if (bulkData.length > 0) {
                const { data, error } = await supabase
                    .from('user_schedules')
                    .upsert(bulkData, { onConflict: 'user_id,date' });
                
                if (error) throw error;
            }
            
            res.json({ success: true, message: `Shifts copied to ${targetUserIds.length} users` });
        } catch (error) {
            console.error('Error copying shifts:', error);
            res.status(500).json({ success: false, message: 'Error copying shifts' });
        }
    },

    // Check if user is currently working
    async getCurrentlyWorking(req, res) {
        try {
            const today = moment().format('YYYY-MM-DD');
            const now = moment().format('HH:mm');
            
            const { data: schedules, error } = await supabase
                .from('user_schedules')
                .select(`
                    user_id,
                    start_time,
                    end_time,
                    is_overnight,
                    is_split,
                    split_start_time,
                    split_end_time,
                    profiles:user_id(full_name)
                `)
                .eq('date', today);
            
            if (error) throw error;
            
            const currentlyWorking = schedules.filter(schedule => {
                if (schedule.is_split) {
                    // Check both time periods for split shifts
                    const inFirstPeriod = now >= schedule.start_time && now <= schedule.end_time;
                    const inSecondPeriod = schedule.split_start_time && schedule.split_end_time &&
                        now >= schedule.split_start_time && now <= schedule.split_end_time;
                    return inFirstPeriod || inSecondPeriod;
                } else if (schedule.is_overnight) {
                    // For overnight shifts, check if current time is after start or before end
                    return now >= schedule.start_time || now <= schedule.end_time;
                } else {
                    // Regular shift
                    return now >= schedule.start_time && now <= schedule.end_time;
                }
            });
            
            res.json({ success: true, currentlyWorking: currentlyWorking.map(s => s.user_id) });
        } catch (error) {
            console.error('Error checking currently working:', error);
            res.status(500).json({ success: false, message: 'Error checking work status' });
        }
    },

    // Render personal events page
    async renderPersonalEvents(req, res) {
        try {
            const user = req.user;
            
            // Get user's personal events
            const { data: events, error } = await supabase
                .from('personal_events')
                .select(`
                    *,
                    approved_by_profile:approved_by(full_name)
                `)
                .eq('user_id', user.id)
                .order('start_date', { ascending: false });
            
            if (error) throw error;
            
            res.render('my-events', {
                title: 'My Events',
                user: user,
                events: events || [],
                moment: moment
            });
        } catch (error) {
            console.error('Error rendering personal events:', error);
            req.flash('error', 'Error loading events');
            res.redirect('/dashboard');
        }
    },

    // Create personal event
    async createPersonalEvent(req, res) {
        try {
            const { title, eventType, startDate, endDate, startTime, endTime, isAllDay, description } = req.body;
            const user = req.user;
            
            const eventData = {
                user_id: user.id,
                title,
                event_type: eventType,
                start_date: startDate,
                end_date: endDate,
                start_time: isAllDay ? null : startTime,
                end_time: isAllDay ? null : endTime,
                is_all_day: isAllDay === 'on',
                description: description || null
            };
            
            const { data, error } = await supabase
                .from('personal_events')
                .insert(eventData)
                .select();
            
            if (error) throw error;
            
            res.json({ success: true, event: data[0] });
        } catch (error) {
            console.error('Error creating personal event:', error);
            res.status(500).json({ success: false, message: 'Error creating event' });
        }
    },

    // Update personal event
    async updatePersonalEvent(req, res) {
        try {
            const { id } = req.params;
            const { title, eventType, startDate, endDate, startTime, endTime, isAllDay, description } = req.body;
            const user = req.user;
            
            const eventData = {
                title,
                event_type: eventType,
                start_date: startDate,
                end_date: endDate,
                start_time: isAllDay ? null : startTime,
                end_time: isAllDay ? null : endTime,
                is_all_day: isAllDay === 'on',
                description: description || null
            };
            
            const { data, error } = await supabase
                .from('personal_events')
                .update(eventData)
                .eq('id', id)
                .eq('user_id', user.id)
                .select();
            
            if (error) throw error;
            
            if (data.length === 0) {
                return res.status(404).json({ success: false, message: 'Event not found' });
            }
            
            res.json({ success: true, event: data[0] });
        } catch (error) {
            console.error('Error updating personal event:', error);
            res.status(500).json({ success: false, message: 'Error updating event' });
        }
    },

    // Delete personal event
    async deletePersonalEvent(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            
            const { error } = await supabase
                .from('personal_events')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
            
            if (error) throw error;
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting personal event:', error);
            res.status(500).json({ success: false, message: 'Error deleting event' });
        }
    }
};

module.exports = scheduleController;