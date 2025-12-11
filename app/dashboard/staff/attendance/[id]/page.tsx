import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Coffee, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function AttendanceDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Get attendance record with related data
  const { data: attendance, error } = await supabase
    .from('staff_attendance')
    .select(`
      *,
      staff:staff(id, display_name),
      branch:branches(name),
      breaks:staff_breaks(*)
    `)
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !attendance) {
    return notFound();
  }

  // Format dates
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Invalid Date';
    // For DATE fields (YYYY-MM-DD), append time to avoid timezone issues
    const date = new Date(dateString + 'T12:00:00');
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/staff/attendance">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Attendance
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Attendance Details</h1>
          <p className="text-muted-foreground">
            {attendance.clock_in ? new Date(attendance.clock_in).toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata',
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'Date not available'}
          </p>
        </div>
      </div>

      {/* Staff Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Staff Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Staff Member</p>
              <p className="text-lg font-medium">
                {attendance.staff?.display_name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="text-lg font-medium">
                {attendance.branch?.name || 'Main Branch'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium mt-1 ${
                attendance.status === 'clocked_in'
                  ? 'bg-green-100 text-green-800'
                  : attendance.status === 'on_break'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {attendance.status === 'clocked_in' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Working
                </>
              ) : attendance.status === 'on_break' ? (
                <>
                  <Coffee className="h-4 w-4 mr-1" />
                  On Break
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  Clocked Out
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Time Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Time Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Clock In
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatTime(attendance.clock_in)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Clock In Location
                </p>
                {attendance.clock_in_lat && attendance.clock_in_lng ? (
                  <iframe
                    className="w-full h-32 rounded-lg border mt-2"
                    loading="lazy"
                    src={`https://www.google.com/maps?q=${attendance.clock_in_lat},${attendance.clock_in_lng}&output=embed`}
                  />
                ) : (
                  <p className="text-sm mt-1">Not recorded</p>
                )}
              </div>

              {attendance.clock_in_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Clock In Notes</p>
                  <p className="text-sm mt-1">{attendance.clock_in_notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Clock Out
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatTime(attendance.clock_out)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Clock Out Location
                </p>
                {attendance.clock_out_lat && attendance.clock_out_lng ? (
                  <iframe
                    className="w-full h-32 rounded-lg border mt-2"
                    loading="lazy"
                    src={`https://www.google.com/maps?q=${attendance.clock_out_lat},${attendance.clock_out_lng}&output=embed`}
                  />
                ) : (
                  <p className="text-sm mt-1">Not recorded</p>
                )}
              </div>

              {attendance.clock_out_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Clock Out Notes</p>
                  <p className="text-sm mt-1">{attendance.clock_out_notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Break Time</p>
                <p className="text-xl font-bold mt-1">
                  {attendance.total_break_minutes 
                    ? formatDuration(attendance.total_break_minutes)
                    : '0m'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Working Hours</p>
                <p className="text-xl font-bold mt-1">
                  {attendance.total_hours 
                    ? `${attendance.total_hours.toFixed(2)} hrs`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {attendance.is_overtime ? 'Overtime' : 'Regular Hours'}
                </p>
                {attendance.is_overtime && (
                  <AlertCircle className="h-5 w-5 text-amber-500 mx-auto mt-1" />
                )}
                {!attendance.is_overtime && (
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mt-1" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Break Details Card */}
      {attendance.breaks && attendance.breaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Break History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendance.breaks.map((breakRecord: any, index: number) => (
                <div
                  key={breakRecord.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">Break #{index + 1}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(breakRecord.break_start)} - {formatTime(breakRecord.break_end)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {breakRecord.duration_minutes 
                        ? formatDuration(breakRecord.duration_minutes)
                        : 'Ongoing'}
                    </p>
                    {breakRecord.notes && (
                      <p className="text-sm text-muted-foreground">{breakRecord.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
