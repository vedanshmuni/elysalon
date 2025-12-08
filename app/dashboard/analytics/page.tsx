import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

export default async function AnalyticsPage() {
  const supabase = await createClient();

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

  // Fetch analytics data
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total, created_at, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'PAID');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, created_at')
    .eq('tenant_id', tenantId);

  const { data: clients } = await supabase
    .from('clients')
    .select('id, created_at, total_visits')
    .eq('tenant_id', tenantId);

  // Calculate metrics
  const totalRevenue = invoices?.reduce((sum: number, inv: any) => sum + inv.total, 0) || 0;
  
  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = invoices?.filter((inv: any) => 
    inv.created_at?.startsWith(today)
  ).reduce((sum: number, inv: any) => sum + inv.total, 0) || 0;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = invoices?.filter((inv: any) => 
    inv.created_at?.startsWith(thisMonth)
  ).reduce((sum: number, inv: any) => sum + inv.total, 0) || 0;

  const totalClients = clients?.length || 0;
  const newClientsThisMonth = clients?.filter((c: any) => 
    c.created_at?.startsWith(thisMonth)
  ).length || 0;

  const completedBookings = bookings?.filter((b: any) => b.status === 'COMPLETED').length || 0;
  const totalBookings = bookings?.length || 0;
  const completionRate = totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0;

  // Top services
  const { data: topServices } = await supabase
    .from('invoice_items')
    .select('name, total')
    .eq('tenant_id', tenantId)
    .eq('type', 'SERVICE')
    .order('total', { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Business insights and reports</p>
      </div>

      {/* Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Current month revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Today&apos;s revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Invoice</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(invoices && invoices.length > 0 ? totalRevenue / invoices.length : 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Client & Booking Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Client Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Clients:</span>
              <span className="text-2xl font-bold">{totalClients}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New This Month:</span>
              <span className="text-lg font-semibold text-green-600">+{newClientsThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Visits:</span>
              <span className="text-lg font-semibold">
                {totalClients > 0 && clients ? ((clients.reduce((sum: number, c: any) => sum + (c.total_visits || 0), 0) / totalClients).toFixed(1)) : 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Bookings:</span>
              <span className="text-2xl font-bold">{totalBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Completed:</span>
              <span className="text-lg font-semibold text-green-600">{completedBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Completion Rate:</span>
              <span className="text-lg font-semibold">{completionRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Growth Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Month-over-month growth coming soon with more data</div>
            <div className="h-24 flex items-center justify-center border border-dashed rounded">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Services */}
      {topServices && topServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Services by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topServices.map((service: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                    <span className="font-medium">{service.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(service.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
