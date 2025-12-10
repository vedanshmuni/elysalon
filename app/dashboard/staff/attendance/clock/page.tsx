'use client';

import { useState, useEffect } from 'react';
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
  Timer
} from 'lucide-react';
import Link from 'next/link';

interface Staff {
  id: string;
  display_name: string;
  phone: string;
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
  staff?: { display_name: string };
}

interface BreakRecord {
  id: string;
  break_start: string;
  break_end: string | null;
  break_type: string;
}

export default function ClockInPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null);
  const [currentBreak, setCurrentBreak] = useState<BreakRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [breakType, setBreakType] = useState('regular');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tenantId, setTenantId] = useState<string | null>(null);

  const supabase = createClient();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Load staff and tenant
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.default_tenant_id) return;
      setTenantId(profile.default_tenant_id);

      // Load staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, display_name, phone')
        .eq('tenant_id', profile.default_tenant_id)
        .eq('is_active', true)
        .order('display_name');

      if (staffData) setStaff(staffData);
    }

    loadData();
  }, []);

  // Check current status when staff is selected
  useEffect(() => {
    async function checkStatus() {
      if (!selectedStaffId || !tenantId) {
        setCurrentAttendance(null);
        setCurrentBreak(null);
        return;
      }

      // Get today's attendance for selected staff
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('staff_id', selectedStaffId)
        .gte('clock_in', todayStart)
        .lte('clock_in', todayEnd)
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
    }

    checkStatus();
  }, [selectedStaffId, tenantId]);

  const handleClockIn = async () => {
    if (!selectedStaffId) {
      setMessage({ type: 'error', text: 'Please select a staff member' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_in',
          staff_id: selectedStaffId,
          notes,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock in');
      }

      setMessage({ type: 'success', text: 'Clocked in successfully!' });
      setCurrentAttendance(data.data);
      setNotes('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_out',
          staff_id: selectedStaffId,
          notes,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock out');
      }

      setMessage({ type: 'success', text: 'Clocked out successfully!' });
      setCurrentAttendance(data.data);
      setNotes('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_break',
          staff_id: selectedStaffId,
          break_type: breakType,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start break');
      }

      setMessage({ type: 'success', text: 'Break started!' });
      setCurrentBreak(data.data);
      setCurrentAttendance(prev => prev ? { ...prev, status: 'on_break' } : null);
      setNotes('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end_break',
          staff_id: selectedStaffId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end break');
      }

      setMessage({ type: 'success', text: 'Break ended!' });
      setCurrentBreak(null);
      setCurrentAttendance(prev => prev ? { ...prev, status: 'clocked_in' } : null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clocked_in': return 'bg-green-100 text-green-800 border-green-300';
      case 'on_break': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'clocked_out': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800';
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

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clock In / Out</h1>
          <p className="text-muted-foreground">Mark your attendance</p>
        </div>
        <Link href="/dashboard/staff/attendance">
          <Button variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            View All Attendance
          </Button>
        </Link>
      </div>

      {/* Current Time Display */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{formatTime(currentTime)}</div>
            <div className="text-xl opacity-90">{formatDate(currentTime)}</div>
            {location && (
              <div className="flex items-center justify-center mt-4 text-sm opacity-75">
                <MapPin className="h-4 w-4 mr-1" />
                Location captured
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message Alert */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Staff Selection & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Select Staff Member</CardTitle>
            <CardDescription>Choose who is clocking in/out</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStaffId && (
              <>
                {/* Current Status */}
                {currentAttendance && (
                  <div className={`p-4 rounded-lg border ${getStatusColor(currentAttendance.status)}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Current Status</p>
                        <p className="text-sm capitalize">{currentAttendance.status.replace('_', ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Clock In</p>
                        <p className="font-medium">
                          {new Date(currentAttendance.clock_in).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </p>
                      </div>
                    </div>
                    {currentAttendance.status !== 'clocked_out' && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        <span className="text-sm">
                          Working for: {calculateDuration(currentAttendance.clock_in)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Clock In - Show when not clocked in or already clocked out */}
                  {(!currentAttendance || currentAttendance.status === 'clocked_out') && (
                    <Button
                      onClick={handleClockIn}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <LogIn className="mr-2 h-5 w-5" />
                      )}
                      Clock In
                    </Button>
                  )}

                  {/* Break & Clock Out - Show when clocked in */}
                  {currentAttendance?.status === 'clocked_in' && (
                    <>
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
                          className="flex-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                        >
                          {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Coffee className="mr-2 h-4 w-4" />
                          )}
                          Start Break
                        </Button>
                      </div>
                      <Button
                        onClick={handleClockOut}
                        disabled={loading}
                        variant="destructive"
                        className="w-full"
                        size="lg"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-5 w-5" />
                        )}
                        Clock Out
                      </Button>
                    </>
                  )}

                  {/* End Break - Show when on break */}
                  {currentAttendance?.status === 'on_break' && (
                    <>
                      {currentBreak && (
                        <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                          <p className="font-medium">On {currentBreak.break_type} break</p>
                          <p className="text-muted-foreground">
                            Started: {new Date(currentBreak.break_start).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </p>
                          <p className="text-muted-foreground">
                            Duration: {calculateDuration(currentBreak.break_start)}
                          </p>
                        </div>
                      )}
                      <Button
                        onClick={handleEndBreak}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-5 w-5" />
                        )}
                        End Break & Resume Work
                      </Button>
                      <Button
                        onClick={handleClockOut}
                        disabled={loading}
                        variant="destructive"
                        className="w-full"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-4 w-4" />
                        )}
                        Clock Out (End Day)
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Info</CardTitle>
            <CardDescription>Today&apos;s attendance summary</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStaffId && currentAttendance ? (
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Clock In Time</span>
                  <span className="font-medium">
                    {new Date(currentAttendance.clock_in).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                {currentAttendance.clock_out && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Clock Out Time</span>
                    <span className="font-medium">
                      {new Date(currentAttendance.clock_out).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Break Time</span>
                  <span className="font-medium">
                    {currentAttendance.total_break_minutes || 0} minutes
                  </span>
                </div>
                {currentAttendance.total_hours && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-medium">
                      {currentAttendance.total_hours.toFixed(2)} hours
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentAttendance.status)}`}>
                    {currentAttendance.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {selectedStaffId 
                  ? 'No attendance record for today. Click "Clock In" to start.'
                  : 'Select a staff member to view their status'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
