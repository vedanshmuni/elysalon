'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, startOfDay, endOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Plus, Calendar as CalendarIcon, Users, Box, Settings } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    booking: any;
    color: string;
  };
}

export default function EnhancedCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<View>('week');
  const [viewMode, setViewMode] = useState<'bookings' | 'staff' | 'resources'>('bookings');
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [calendarSettings, setCalendarSettings] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [selectedStaff, selectedResource, viewMode]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tid = profile?.default_tenant_id;
    if (!tid) return;
    setTenantId(tid);

    // Load calendar settings
    const { data: settings } = await supabase
      .from('calendar_settings')
      .select('*')
      .eq('tenant_id', tid)
      .single();

    setCalendarSettings(settings);

    // Load staff
    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('tenant_id', tid)
      .eq('is_active', true);

    setStaffMembers(staff || []);

    // Load resources
    const { data: resourcesData } = await supabase
      .from('resources')
      .select('*')
      .eq('tenant_id', tid)
      .eq('is_active', true);

    setResources(resourcesData || []);

    // Load bookings
    await loadBookings(tid);
    setLoading(false);
  }

  async function loadBookings(tid: string) {
    const supabase = createClient();
    
    let query = supabase
      .from('bookings')
      .select(`
        *,
        client:clients(full_name, phone),
        branch:branches(name),
        booking_items(
          id,
          service:services(name),
          staff:staff(id, display_name, color_code)
        ),
        booking_resources(
          resource:resources(id, name)
        )
      `)
      .eq('tenant_id', tid)
      .neq('status', 'CANCELLED');

    // Filter by staff if selected
    if (selectedStaff !== 'all') {
      const { data: staffBookings } = await supabase
        .from('booking_items')
        .select('booking_id')
        .eq('staff_id', selectedStaff);
      
      const bookingIds = staffBookings?.map(b => b.booking_id) || [];
      if (bookingIds.length > 0) {
        query = query.in('id', bookingIds);
      }
    }

    // Filter by resource if selected
    if (selectedResource !== 'all') {
      const { data: resourceBookings } = await supabase
        .from('booking_resources')
        .select('booking_id')
        .eq('resource_id', selectedResource);
      
      const bookingIds = resourceBookings?.map(b => b.booking_id) || [];
      if (bookingIds.length > 0) {
        query = query.in('id', bookingIds);
      }
    }

    const { data: bookings } = await query;

    // Load staff breaks
    const { data: breaks } = await supabase
      .from('staff_breaks')
      .select('*, staff:staff(display_name)')
      .eq('tenant_id', tid);

    // Convert bookings to calendar events
    const bookingEvents: CalendarEvent[] = (bookings || []).map((booking: any) => {
      const staffMember = booking.booking_items?.[0]?.staff;
      const color = booking.color_code || staffMember?.color_code || '#3b82f6';
      
      return {
        id: booking.id,
        title: `${booking.client?.full_name || 'Walk-in'} - ${booking.booking_items?.[0]?.service?.name || 'Service'}`,
        start: new Date(booking.scheduled_start),
        end: new Date(booking.scheduled_end),
        resource: {
          booking,
          color,
          isFrozen: booking.is_frozen,
        },
      };
    });

    // Convert breaks to calendar events
    const breakEvents: CalendarEvent[] = (breaks || []).map((breakItem: any) => ({
      id: `break-${breakItem.id}`,
      title: `${breakItem.staff?.display_name} - ${breakItem.break_type.toUpperCase()}`,
      start: new Date(breakItem.break_start),
      end: new Date(breakItem.break_end),
      resource: {
        booking: null,
        color: '#ef4444',
        isBreak: true,
      },
    }));

    setEvents([...bookingEvents, ...breakEvents]);
  }

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    // Navigate to create booking with pre-filled date/time
    const dateStr = format(start, 'yyyy-MM-dd');
    const timeStr = format(start, 'HH:mm');
    window.location.href = `/dashboard/bookings/new?date=${dateStr}&time=${timeStr}&staff=${selectedStaff}`;
  }, [selectedStaff]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    if (event.resource.isBreak) {
      // Handle break click - could open break details
      return;
    }
    window.location.href = `/dashboard/bookings/${event.id}`;
  }, []);

  const handleEventDrop = async ({ event, start, end }: any) => {
    const supabase = createClient();
    
    // Check if booking is frozen
    if (event.resource.isFrozen) {
      alert('This booking is frozen and cannot be moved. Unfreeze it first.');
      return;
    }

    // Check for conflicts if double booking is not allowed
    if (!calendarSettings?.allow_double_booking && selectedStaff !== 'all') {
      const hasConflict = await checkConflict(selectedStaff, start, end, event.id);
      if (hasConflict) {
        alert('This time slot conflicts with another booking. Enable double booking in calendar settings to allow overlaps.');
        return;
      }
    }

    // Update booking time
    const { error } = await supabase
      .from('bookings')
      .update({
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking time');
      return;
    }

    // Update local state
    setEvents(prevEvents =>
      prevEvents.map(evt =>
        evt.id === event.id
          ? { ...evt, start, end }
          : evt
      )
    );
  };

  const handleEventResize = async ({ event, start, end }: any) => {
    if (event.resource.isFrozen) {
      alert('This booking is frozen and cannot be resized. Unfreeze it first.');
      return;
    }

    await handleEventDrop({ event, start, end });
  };

  async function checkConflict(staffId: string, start: Date, end: Date, excludeBookingId: string) {
    const supabase = createClient();
    const { data } = await supabase.rpc('check_booking_conflict', {
      p_staff_id: staffId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_booking_id: excludeBookingId,
    });
    return data;
  }

  const eventStyleGetter = (event: CalendarEvent) => {
    const style: any = {
      backgroundColor: event.resource.color,
      borderRadius: '5px',
      opacity: 0.9,
      color: 'white',
      border: event.resource.isFrozen ? '2px solid #f59e0b' : '0px',
      display: 'block',
      cursor: event.resource.isFrozen ? 'not-allowed' : 'pointer',
    };

    return { style };
  };

  const timeFormat = useMemo(() => 
    calendarSettings?.time_format === '24h' ? 'HH:mm' : 'h:mm a',
    [calendarSettings]
  );

  const formats = useMemo(() => ({
    timeGutterFormat: timeFormat,
    eventTimeRangeFormat: ({ start, end }: any) => 
      `${format(start, timeFormat)} - ${format(end, timeFormat)}`,
    agendaTimeRangeFormat: ({ start, end }: any) => 
      `${format(start, timeFormat)} - ${format(end, timeFormat)}`,
  }), [timeFormat]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Drag & drop to reschedule appointments</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/settings/calendar">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href="/dashboard/bookings/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">View Mode</label>
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bookings">
                    <CalendarIcon className="inline mr-2 h-4 w-4" />
                    Bookings View
                  </SelectItem>
                  <SelectItem value="staff">
                    <Users className="inline mr-2 h-4 w-4" />
                    Staff Occupancy
                  </SelectItem>
                  <SelectItem value="resources">
                    <Box className="inline mr-2 h-4 w-4" />
                    Resource View
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Calendar View</label>
              <Select value={calendarView} onValueChange={(value: any) => setCalendarView(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="work_week">Work Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="agenda">Agenda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {viewMode === 'staff' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Staff</label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffMembers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === 'resources' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Resource</label>
                <Select value={selectedResource} onValueChange={setSelectedResource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    {resources.map((resource) => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
              <span>Regular Booking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-amber-500" style={{ backgroundColor: '#3b82f6' }}></div>
              <span>Frozen (Confirmed)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span>Break/Block Time</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <p>Loading calendar...</p>
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <DragAndDropCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 700 }}
                view={calendarView}
                onView={setCalendarView}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                selectable
                resizable
                eventPropGetter={eventStyleGetter}
                formats={formats}
                step={calendarSettings?.time_slot_interval || 15}
                timeslots={1}
                min={new Date(2024, 0, 1, 
                  parseInt(calendarSettings?.working_hours_start?.split(':')[0] || '9'), 
                  parseInt(calendarSettings?.working_hours_start?.split(':')[1] || '0')
                )}
                max={new Date(2024, 0, 1, 
                  parseInt(calendarSettings?.working_hours_end?.split(':')[0] || '18'), 
                  parseInt(calendarSettings?.working_hours_end?.split(':')[1] || '0')
                )}
                popup
                tooltipAccessor={(event: CalendarEvent) => 
                  `${event.title}\n${format(event.start, timeFormat)} - ${format(event.end, timeFormat)}`
                }
              />
            </DndProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
