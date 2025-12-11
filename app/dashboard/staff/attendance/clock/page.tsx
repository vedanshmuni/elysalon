'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  Play, 
  MapPin, 
  Loader2,
  CheckCircle2,
  XCircle,
  Timer,
  User,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Staff {
  id: string;
  display_name: string;
  phone: string;
  user_id: string | null;
}

interface AttendanceRecord {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  status: 'clocked_in' | 'on_break' | 'clocked_out';
  total_break_minutes: number;
  total_hours: number | null;
  clock_in_notes: string | null;
  clock_out_notes: string | null;
}

interface BreakRecord {
  id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
}

export default function ClockInPage() {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [myStaffRecord, setMyStaffRecord] = useState<Staff | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null);
  const [currentBreak, setCurrentBreak] = useState<BreakRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [breakType, setBreakType] = useState('regular');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('STAFF');
  const [elapsedTime, setElapsedTime] = useState<string>('');

  const supabase = createClient();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!currentAttendance || currentAttendance.status === 'clocked_out') {
      setElapsedTime('');
      return;
    }

    const updateElapsed = () => {
      const start = new Date(currentAttendance.clock_in);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [currentAttendance]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.default_tenant_id) return;
      setTenantId(profile.default_tenant_id);

      // Get user's role
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', profile.default_tenant_id)
        .single();

      const role = tenantUser?.role || 'STAFF';
      setUserRole(role);

      // Get current user's staff record
      const { data: myStaff } = await supabase
        .from('staff')
        .select('id, display_name, phone, user_id')
        .eq('tenant_id', profile.default_tenant_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (myStaff) {
        setMyStaffRecord(myStaff);
        setSelectedStaffId(myStaff.id);
      }

      // If manager+, load all staff
      if (['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, display_name, phone, user_id')
          .eq('tenant_id', profile.default_tenant_id)
          .eq('is_active', true)
          .order('display_name');

        if (staffData) setAllStaff(staffData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setInitialLoading(false);
    }
  }

  // Check attendance status when staff is selected
  const checkStatus = useCallback(async () => {
    if (!selectedStaffId || !tenantId) {
      setCurrentAttendance(null);
      setCurrentBreak(null);
      return;
    }

    try {
      // Get today's date range
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('staff_id', selectedStaffId)
        .gte('clock_in', todayStart.toISOString())
        .lte('clock_in', todayEnd.toISOString())
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentAttendance(attendance);

      // Check for active break
      if (attendance && attendance.status === 'on_break') {
        const { data: breakRecord } = await supabase
          .from('staff_breaks')
          .select('*')
          .eq('attendance_id', attendance.id)
          .is('break_end', null)
          .maybeSingle();

        setCurrentBreak(breakRecord);
      } else {
        setCurrentBreak(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, [selectedStaffId, tenantId, supabase]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleClockIn = async () => {
    if (!selectedStaffId || !tenantId) {
      setMessage({ type: 'error', text: 'No staff member selected' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          tenant_id: tenantId,
          staff_id: selectedStaffId,
          clock_in: new Date().toISOString(),
          clock_in_lat: location?.lat,
          clock_in_lng: location?.lng,
          clock_in_notes: notes || null,
          status: 'clocked_in',
        })
        .select()
        .single();

      if (error) throw error;

      setMessage({ type: 'success', text: '✓ Clocked in successfully!' });
      setCurrentAttendance(data);
      setNotes('');
    } catch (error: any) {
      console.error('Clock in error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to clock in' });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentAttendance) return;

    setLoading(true);
    setMessage(null);

    try {
      // End any active break first
      if (currentBreak) {
        await supabase
          .from('staff_breaks')
          .update({
            break_end: new Date().toISOString(),
          })
          .eq('id', currentBreak.id);
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(currentAttendance.clock_in);
      const totalMinutes = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60);
      const breakMinutes = currentAttendance.total_break_minutes || 0;
      const totalHours = (totalMinutes - breakMinutes) / 60;

      const { data, error } = await supabase
        .from('staff_attendance')
        .update({
          clock_out: clockOutTime.toISOString(),
          clock_out_lat: location?.lat,
          clock_out_lng: location?.lng,
          clock_out_notes: notes || null,
          status: 'clocked_out',
          total_hours: Math.round(totalHours * 100) / 100,
        })
        .eq('id', currentAttendance.id)
        .select()
        .single();

      if (error) throw error;

      setMessage({ type: 'success', text: `✓ Clocked out! Total: ${totalHours.toFixed(1)} hours` });
      setCurrentAttendance(data);
      setCurrentBreak(null);
      setNotes('');
    } catch (error: any) {
      console.error('Clock out error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to clock out' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!currentAttendance) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data: breakData, error: breakError } = await supabase
        .from('staff_breaks')
        .insert({
          attendance_id: currentAttendance.id,
          break_start: new Date().toISOString(),
          break_type: breakType,
          notes: notes || null,
        })
        .select()
        .single();

      if (breakError) throw breakError;

      // Update attendance status
      const { error: attendanceError } = await supabase
        .from('staff_attendance')
        .update({ status: 'on_break' })
        .eq('id', currentAttendance.id);

      if (attendanceError) throw attendanceError;

      setMessage({ type: 'success', text: '☕ Break started!' });
      setCurrentBreak(breakData);
      setCurrentAttendance(prev => prev ? { ...prev, status: 'on_break' } : null);
      setNotes('');
    } catch (error: any) {
      console.error('Start break error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to start break' });
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!currentBreak || !currentAttendance) return;

    setLoading(true);
    setMessage(null);

    try {
      const breakEnd = new Date();
      const breakStart = new Date(currentBreak.break_start);
      const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));

      const { error: breakError } = await supabase
        .from('staff_breaks')
        .update({
          break_end: breakEnd.toISOString(),
          break_minutes: breakMinutes,
        })
        .eq('id', currentBreak.id);

      if (breakError) throw breakError;

      // Update attendance
      const newTotalBreak = (currentAttendance.total_break_minutes || 0) + breakMinutes;

      const { error: attendanceError } = await supabase
        .from('staff_attendance')
        .update({
          status: 'clocked_in',
          total_break_minutes: newTotalBreak,
        })
        .eq('id', currentAttendance.id);

      if (attendanceError) throw attendanceError;

      setMessage({ type: 'success', text: `✓ Break ended (${breakMinutes} min)` });
      setCurrentBreak(null);
      setCurrentAttendance(prev => prev ? { 
        ...prev, 
        status: 'clocked_in',
        total_break_minutes: newTotalBreak,
      } : null);
    } catch (error: any) {
      console.error('End break error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to end break' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole);
  const selectedStaffName = allStaff.find(s => s.id === selectedStaffId)?.display_name || myStaffRecord?.display_name || '';

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Managers without staff record - show staff selector
  if (isManager && !myStaffRecord) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff Attendance Management</h1>
            <p className="text-muted-foreground">Manage staff clock in/out</p>
          </div>
          <Link href="/dashboard/staff/attendance">
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" />
              View All Attendance
            </Button>
          </Link>
        </div>

        {allStaff.length > 0 ? (
          <>
            {/* Staff Selection */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-sm text-muted-foreground">Select a staff member to manage:</Label>
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allStaff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Message Alert */}
            {message && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* Show attendance card only when staff is selected */}
            {selectedStaffId && (
              <Card className="overflow-hidden">
                {/* Status Header */}
                <div className={`p-6 text-white ${
                  currentAttendance?.status === 'clocked_in' 
                    ? 'bg-gradient-to-r from-green-500 to-green-600' 
                    : currentAttendance?.status === 'on_break'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : currentAttendance?.status === 'clocked_out'
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                }`}>
                  <div className="text-center">
                    <p className="text-lg opacity-90 mb-2">{selectedStaffName}</p>
                    <div className="text-5xl font-bold mb-1">{formatTime(currentTime)}</div>
                    <div className="text-lg opacity-80">{formatDate(currentTime)}</div>

                    <div className="mt-4">
                      {!currentAttendance || currentAttendance.status === 'clocked_out' ? (
                        <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                          <XCircle className="h-4 w-4" />
                          Not Clocked In
                        </span>
                      ) : currentAttendance.status === 'clocked_in' ? (
                        <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                          <CheckCircle2 className="h-4 w-4" />
                          Working
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                          <Coffee className="h-4 w-4" />
                          On Break
                        </span>
                      )}
                    </div>

                    {elapsedTime && currentAttendance?.status !== 'clocked_out' && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Timer className="h-5 w-5" />
                        <span className="text-2xl font-mono">{elapsedTime}</span>
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Clock In Button */}
                  {(!currentAttendance || currentAttendance.status === 'clocked_out') && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea
                          placeholder="Add any notes for clocking in..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleClockIn}
                        disabled={loading}
                        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                        Clock In
                      </Button>
                    </div>
                  )}

                  {/* Clock Out & Break buttons */}
                  {currentAttendance?.status === 'clocked_in' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Break Type</Label>
                          <Select value={breakType} onValueChange={setBreakType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regular">Regular Break</SelectItem>
                              <SelectItem value="lunch">Lunch Break</SelectItem>
                              <SelectItem value="tea">Tea Break</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={handleStartBreak}
                            disabled={loading}
                            variant="outline"
                            className="w-full h-10 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                          >
                            <Coffee className="mr-2 h-4 w-4" />
                            Start Break
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Clock Out Notes (Optional)</Label>
                        <Textarea
                          placeholder="Add any notes for clocking out..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleClockOut}
                        disabled={loading}
                        variant="destructive"
                        className="w-full h-14 text-lg"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
                        Clock Out
                      </Button>
                    </div>
                  )}

                  {/* End Break button */}
                  {currentAttendance?.status === 'on_break' && (
                    <Button
                      onClick={handleEndBreak}
                      disabled={loading}
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                      End Break & Resume Work
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedStaffId && (
              <Card>
                <CardContent className="py-12 text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a staff member above to manage their attendance</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Staff Found</h2>
              <p className="text-muted-foreground mb-4">Add staff members first to manage attendance.</p>
              <Link href="/dashboard/staff">
                <Button>Go to Staff Management</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // No staff record found for this user (non-manager)
  if (!myStaffRecord && !isManager) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Account Not Linked</h2>
            <p className="text-muted-foreground mb-4">
              Your login account is not linked to your staff profile. This needs to be done by your manager.
            </p>
            <p className="text-sm text-muted-foreground">
              Ask your manager to go to <strong>Staff Management</strong> and link your account to your staff record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clock In / Out</h1>
          <p className="text-muted-foreground">Mark your attendance</p>
        </div>
        {isManager && (
          <Link href="/dashboard/staff/attendance">
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" />
              View All Attendance
            </Button>
          </Link>
        )}
      </div>

      {/* Staff Selection (for managers only) */}
      {isManager && allStaff.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">Clock in/out for:</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.display_name} {s.user_id === myStaffRecord?.user_id && '(You)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {selectedStaffId && (
        <>
          {/* Main Clock Display & Actions */}
          <Card className="overflow-hidden">
            {/* Status Header */}
            <div className={`p-6 text-white ${
              currentAttendance?.status === 'clocked_in' 
                ? 'bg-gradient-to-r from-green-500 to-green-600' 
                : currentAttendance?.status === 'on_break'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                : currentAttendance?.status === 'clocked_out'
                ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
              <div className="text-center">
                {/* Staff Name */}
                <p className="text-lg opacity-90 mb-2">
                  {selectedStaffName}
                </p>

                {/* Current Time */}
                <div className="text-5xl font-bold mb-1">{formatTime(currentTime)}</div>
                <div className="text-lg opacity-80">{formatDate(currentTime)}</div>

                {/* Status Badge */}
                <div className="mt-4">
                  {!currentAttendance || currentAttendance.status === 'clocked_out' ? (
                    <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                      <XCircle className="h-4 w-4" />
                      Not Clocked In
                    </span>
                  ) : currentAttendance.status === 'clocked_in' ? (
                    <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                      <CheckCircle2 className="h-4 w-4" />
                      Working
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                      <Coffee className="h-4 w-4" />
                      On Break
                    </span>
                  )}
                </div>

                {/* Elapsed Time */}
                {elapsedTime && currentAttendance?.status !== 'clocked_out' && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Timer className="h-5 w-5" />
                    <span className="text-2xl font-mono">{elapsedTime}</span>
                  </div>
                )}

                {/* Location */}
                {location && (
                  <div className="mt-3 flex items-center justify-center gap-1 text-sm opacity-75">
                    <MapPin className="h-4 w-4" />
                    Location captured
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <CardContent className="p-6">
              {/* Clock In Button */}
              {(!currentAttendance || currentAttendance.status === 'clocked_out') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add any notes for clocking in..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleClockIn}
                    disabled={loading}
                    className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 h-6 w-6" />
                    )}
                    Clock In
                  </Button>
                </div>
              )}

              {/* Clocked In - Show Break and Clock Out */}
              {currentAttendance?.status === 'clocked_in' && (
                <div className="space-y-4">
                  {/* Today's Summary */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Clocked In</p>
                      <p className="font-semibold">
                        {new Date(currentAttendance.clock_in).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Break Time</p>
                      <p className="font-semibold">{currentAttendance.total_break_minutes || 0} min</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Working</p>
                      <p className="font-semibold font-mono">{elapsedTime}</p>
                    </div>
                  </div>

                  {/* Break Controls */}
                  <div className="flex gap-2">
                    <Select value={breakType} onValueChange={setBreakType}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleStartBreak}
                      disabled={loading}
                      variant="outline"
                      className="flex-1 h-12 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Coffee className="mr-2 h-5 w-5" />
                      )}
                      Start Break
                    </Button>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add notes for clocking out..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Clock Out */}
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    variant="destructive"
                    className="w-full h-14 text-lg"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-6 w-6" />
                    )}
                    Clock Out
                  </Button>
                </div>
              )}

              {/* On Break - Show End Break and Clock Out */}
              {currentAttendance?.status === 'on_break' && (
                <div className="space-y-4">
                  {/* Break Info */}
                  {currentBreak && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Coffee className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium capitalize">{currentBreak.break_type} Break</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Started at {new Date(currentBreak.break_start).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleEndBreak}
                    disabled={loading}
                    className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-6 w-6" />
                    )}
                    End Break & Resume Work
                  </Button>

                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    variant="destructive"
                    className="w-full h-12"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-5 w-5" />
                    )}
                    Clock Out (End Day)
                  </Button>
                </div>
              )}

              {/* Already Clocked Out */}
              {currentAttendance?.status === 'clocked_out' && (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg">Day Complete!</h3>
                  <p className="text-muted-foreground mb-4">
                    You worked {currentAttendance.total_hours?.toFixed(1) || '0'} hours today
                  </p>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="text-muted-foreground">Clock In</p>
                      <p className="font-medium">
                        {new Date(currentAttendance.clock_in).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clock Out</p>
                      <p className="font-medium">
                        {currentAttendance.clock_out && new Date(currentAttendance.clock_out).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <div className="flex gap-4">
            <Link href="/dashboard/staff/attendance/leave-requests" className="flex-1">
              <Button variant="outline" className="w-full">
                <CalendarDays className="mr-2 h-4 w-4" />
                Leave Requests
              </Button>
            </Link>
            {isManager && (
              <Link href="/dashboard/staff/attendance" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Clock className="mr-2 h-4 w-4" />
                  All Attendance
                </Button>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
