import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Clock, Calendar, TrendingUp, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default async function AttendancePage() {
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

  // Get today's date in IST
  const today = new Date();
  const todayIST = today.toLocaleDateString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [day, month, year] = todayIST.split('/');
  const todayDate = `${year}-${month}-${day}`;

  // Get today's attendance records
  const { data: todayAttendance } = await supabase
    .from('staff_attendance')
    .select(`
      *,
      staff:staff(id, display_name, phone),
      branch:branches(name)
    `)
    .eq('tenant_id', tenantId)
    .gte('clock_in', `${todayDate}T00:00:00`)
    .lte('clock_in', `${todayDate}T23:59:59`)
    .order('clock_in', { ascending: false });

  // Get all active staff
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, display_name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // Get pending leave requests
  const { data: pendingLeave } = await supabase
    .from('staff_leave_requests')
    .select(`
      *,
      staff:staff(display_name),
      leave_type:leave_types(name, color)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(5);

  // Calculate stats
  const totalStaff = allStaff?.length || 0;
  const clockedIn = todayAttendance?.filter(a => a.status === 'clocked_in' || a.status === 'on_break').length || 0;
  const onBreak = todayAttendance?.filter(a => a.status === 'on_break').length || 0;
  const clockedOut = todayAttendance?.filter(a => a.status === 'clocked_out').length || 0;

  // Calculate total hours worked today
  const totalHoursToday = todayAttendance?.reduce((sum, a) => sum + (a.total_hours || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Attendance</h1>
          <p className="text-muted-foreground">Track and manage staff attendance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/staff/attendance/leave-requests">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Leave Requests
              {pendingLeave && pendingLeave.length > 0 && (
                <span className="ml-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                  {pendingLeave.length}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/dashboard/staff/attendance/reports">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked In</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clockedIn}</div>
            <p className="text-xs text-muted-foreground">
              {onBreak > 0 && `${onBreak} on break`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clocked Out</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clockedOut}</div>
            <p className="text-xs text-muted-foreground">Completed shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursToday.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Total hours worked</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Leave Requests Alert */}
      {pendingLeave && pendingLeave.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertCircle className="mr-2 h-5 w-5" />
              {pendingLeave.length} Pending Leave Request{pendingLeave.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingLeave.slice(0, 3).map((leave: any) => (
                <div key={leave.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{leave.staff?.display_name}</span>
                  <span className="text-muted-foreground">
                    {new Date(leave.start_date).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short'
                    })} - {new Date(leave.end_date).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/dashboard/staff/attendance/leave-requests">
              <Button variant="link" className="mt-2 p-0 text-yellow-800">
                View all requests →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Today's Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Attendance - {new Date(todayDate).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Break Time</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayAttendance && todayAttendance.length > 0 ? (
                todayAttendance.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.staff?.display_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{record.branch?.name || '-'}</TableCell>
                    <TableCell>
                      {new Date(record.clock_in).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </TableCell>
                    <TableCell>
                      {record.clock_out
                        ? new Date(record.clock_out).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {record.total_break_minutes ? `${record.total_break_minutes} min` : '-'}
                    </TableCell>
                    <TableCell>
                      {record.total_hours ? `${record.total_hours.toFixed(2)} hrs` : '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          record.status === 'clocked_in'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'on_break'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {record.status === 'clocked_in' ? 'Working' : 
                         record.status === 'on_break' ? 'On Break' : 'Clocked Out'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/staff/attendance/${record.id}`}>
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
                    No attendance records for today yet.
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
