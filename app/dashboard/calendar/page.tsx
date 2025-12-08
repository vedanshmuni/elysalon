import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/date';

function getWeekDates(date: Date) {
  const week = [];
  const current = new Date(date);
  current.setDate(current.getDate() - current.getDay());

  for (let i = 0; i < 7; i++) {
    week.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return week;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-300',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; staff?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.default_tenant_id;
  if (!tenantId) return null;

  // Get current week
  const currentDate = params.date ? new Date(params.date) : new Date();
  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0].toISOString().split('T')[0];
  const weekEnd = weekDates[6].toISOString().split('T')[0];

  // Fetch staff
  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('display_name');

  // Fetch bookings for the week
  let bookingsQuery = supabase
    .from('bookings')
    .select(
      `
      *,
      client:clients(full_name),
      booking_items(
        service:services(name),
        staff:staff(id, display_name)
      )
    `
    )
    .eq('tenant_id', tenantId)
    .gte('scheduled_start', weekStart + 'T00:00:00Z')
    .lte('scheduled_start', weekEnd + 'T23:59:59Z')
    .order('scheduled_start', { ascending: true });

  if (params.staff) {
    // Filter by staff member
    const { data: staffBookingItems } = await supabase
      .from('booking_items')
      .select('booking_id')
      .eq('staff_id', params.staff);

    const bookingIds = staffBookingItems?.map((item: any) => item.booking_id) || [];
    if (bookingIds.length > 0) {
      bookingsQuery = bookingsQuery.in('id', bookingIds);
    }
  }

  const { data: bookings } = await bookingsQuery;

  // Group bookings by date
  const bookingsByDate: Record<string, any[]> = {};
  bookings?.forEach((booking: any) => {
    const dateKey = booking.scheduled_start.split('T')[0];
    if (!bookingsByDate[dateKey]) {
      bookingsByDate[dateKey] = [];
    }
    bookingsByDate[dateKey].push(booking);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Visual schedule and availability management</p>
        </div>
        <Link href="/dashboard/bookings/new">
          <Button>
            <CalendarIcon className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard/calendar?date=${new Date(
                  currentDate.setDate(currentDate.getDate() - 7)
                ).toISOString().split('T')[0]}`}
              >
                <Button variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h3 className="text-lg font-semibold">
                {formatDate(weekDates[0].toISOString(), 'MMM d')} -{' '}
                {formatDate(weekDates[6].toISOString(), 'MMM d, yyyy')}
              </h3>
              <Link
                href={`/dashboard/calendar?date=${new Date(
                  currentDate.setDate(currentDate.getDate() + 14)
                ).toISOString().split('T')[0]}`}
              >
                <Button variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <Link href="/dashboard/calendar">
              <Button variant="outline">Today</Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Staff Filter */}
      {staff && staff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filter by Staff</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <Link href="/dashboard/calendar">
              <Button variant={!params.staff ? 'default' : 'outline'} size="sm">
                All Staff
              </Button>
            </Link>
            {staff.map((member: any) => (
              <Link key={member.id} href={`/dashboard/calendar?staff=${member.id}`}>
                <Button
                  variant={params.staff === member.id ? 'default' : 'outline'}
                  size="sm"
                >
                  {member.display_name}
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Week View */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const dayBookings = bookingsByDate[dateStr] || [];
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <Card key={dateStr} className={isToday ? 'border-blue-500 border-2' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  <div className="text-muted-foreground">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={isToday ? 'text-blue-600 font-bold' : ''}>
                    {date.getDate()}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[400px]">
                {dayBookings.length > 0 ? (
                  dayBookings.map((booking: any) => (
                    <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`}>
                      <div
                        className={`p-2 rounded border-l-4 text-xs cursor-pointer hover:shadow-md transition-shadow ${
                          statusColors[booking.status] || 'bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">
                          {new Date(booking.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="truncate">{booking.client?.full_name || 'Walk-in'}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {booking.booking_items?.[0]?.service?.name}
                        </div>
                        {booking.booking_items?.[0]?.staff && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {booking.booking_items[0].staff.display_name}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    No bookings
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border-l-4 border-yellow-300"></div>
            <span className="text-sm">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border-l-4 border-blue-300"></div>
            <span className="text-sm">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-100 border-l-4 border-purple-300"></div>
            <span className="text-sm">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border-l-4 border-green-300"></div>
            <span className="text-sm">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border-l-4 border-red-300"></div>
            <span className="text-sm">Cancelled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

