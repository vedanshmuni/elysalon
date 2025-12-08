import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign, Users, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

async function getDashboardStats(tenantId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Today's bookings
  const { count: bookingsToday } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('scheduled_start', today)
    .lt('scheduled_start', new Date(Date.now() + 86400000).toISOString());

  // Total clients
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Today's revenue (simplified)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('status', 'PAID')
    .gte('issued_at', today);

  const todayRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;

  // Active staff
  const { count: activeStaff } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  return {
    bookingsToday: bookingsToday || 0,
    totalClients: totalClients || 0,
    todayRevenue,
    activeStaff: activeStaff || 0,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get user's default tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.default_tenant_id;

  if (!tenantId) {
    return (
      <div>
        <h1 className="text-3xl font-bold">Welcome to SalonOS</h1>
        <p className="mt-4 text-muted-foreground">Please complete onboarding to get started.</p>
      </div>
    );
  }

  const stats = await getDashboardStats(tenantId);

  // Get upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('*, clients(full_name), branches(name)')
    .eq('tenant_id', tenantId)
    .gte('scheduled_start', new Date().toISOString())
    .order('scheduled_start', { ascending: true })
    .limit(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bookingsToday}</div>
            <p className="text-xs text-muted-foreground">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todayRevenue)}</div>
            <p className="text-xs text-muted-foreground">From completed services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">In your database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStaff}</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings && upcomingBookings.length > 0 ? (
            <div className="space-y-4">
              {upcomingBookings.map((booking: any) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <div className="font-medium">{booking.clients?.full_name || 'Walk-in'}</div>
                    <div className="text-sm text-muted-foreground">
                      {booking.branches?.name} • {booking.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatDate(booking.scheduled_start, 'p')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(booking.scheduled_start, 'PP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming bookings</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
