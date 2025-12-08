import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Calendar, Clock, User, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/utils/currency';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

const statusColors: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
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

  // Build query with filters
  let query = supabase
    .from('bookings')
    .select(
      `
      *,
      client:clients(id, full_name, phone),
      branch:branches(id, name),
      booking_items(
        id,
        service:services(name, duration_minutes),
        staff:staff(display_name)
      )
    `
    )
    .eq('tenant_id', tenantId)
    .order('scheduled_start', { ascending: false });

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  if (params.date) {
    const startOfDay = new Date(params.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(params.date);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.gte('scheduled_start', startOfDay.toISOString()).lte('scheduled_start', endOfDay.toISOString());
  }

  const { data: bookings } = await query.limit(100);

  // Get today's date range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = bookings?.filter(
    (b: any) => {
      const bookingDate = new Date(b.scheduled_start);
      return bookingDate >= todayStart && bookingDate <= todayEnd;
    }
  ).length || 0;

  const pendingCount = bookings?.filter((b: any) => b.status === 'PENDING').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground">Manage appointments and reservations</p>
        </div>
        <Link href="/dashboard/bookings/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                bookings?.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0) || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Bookings</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex gap-2">
            <Link href="/dashboard/bookings">
              <Button variant={!params.status ? 'default' : 'outline'} size="sm">
                All
              </Button>
            </Link>
            <Link href="/dashboard/bookings?status=PENDING">
              <Button variant={params.status === 'PENDING' ? 'default' : 'outline'} size="sm">
                Pending
              </Button>
            </Link>
            <Link href="/dashboard/bookings?status=CONFIRMED">
              <Button
                variant={params.status === 'CONFIRMED' ? 'default' : 'outline'}
                size="sm"
              >
                Confirmed
              </Button>
            </Link>
            <Link href="/dashboard/bookings?status=COMPLETED">
              <Button
                variant={params.status === 'COMPLETED' ? 'default' : 'outline'}
                size="sm"
              >
                Completed
              </Button>
            </Link>
            <Link href="/dashboard/bookings?status=CANCELLED">
              <Button
                variant={params.status === 'CANCELLED' ? 'default' : 'outline'}
                size="sm"
              >
                Cancelled
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bookings ({bookings?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings && bookings.length > 0 ? (
                bookings.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="font-medium">{formatDate(booking.scheduled_start)}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(booking.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{booking.client?.full_name || 'Walk-in'}</div>
                      {booking.client?.phone && (
                        <div className="text-sm text-muted-foreground">{booking.client.phone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {booking.booking_items?.map((item: any, idx: number) => (
                        <div key={item.id} className="text-sm">
                          {item.service?.name}
                          {idx < booking.booking_items.length - 1 && ', '}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {booking.booking_items?.map((item: any, idx: number) => (
                        <div key={item.id} className="text-sm">
                          {item.staff?.display_name}
                          {idx < booking.booking_items.length - 1 && ', '}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>{booking.branch?.name || '-'}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(
                        booking.booking_items?.reduce((sum: number, item: any) => sum + (item.price || 0), 0) || 0
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          statusColors[booking.status as BookingStatus]
                        }`}
                      >
                        {booking.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/bookings/${booking.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No bookings found. Create your first booking to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
