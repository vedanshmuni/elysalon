'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Clock, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/date';

export default function ShiftManagementPage() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [shifts, setShifts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  const [newShift, setNewShift] = useState({
    staff_id: '',
    branch_id: '',
    start_time: '',
    end_time: '',
    shift_type: 'REGULAR',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tid = profile?.default_tenant_id;
    if (!tid) return;
    setTenantId(tid);

    // Load staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, display_name, role_label')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('display_name');

    setStaff(staffData || []);

    // Load branches
    const { data: branchesData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');

    setBranches(branchesData || []);

    // Load shifts for selected week
    const weekStart = getWeekStart(selectedWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: shiftsData } = await supabase
      .from('staff_shifts')
      .select(
        `
        *,
        staff:staff(display_name, role_label),
        branch:branches(name)
      `
      )
      .eq('tenant_id', tid)
      .gte('start_time', weekStart.toISOString())
      .lt('start_time', weekEnd.toISOString())
      .order('start_time');

    setShifts(shiftsData || []);
    setLoading(false);
  }

  function getWeekStart(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  function previousWeek() {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(newDate);
  }

  function nextWeek() {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(newDate);
  }

  function checkConflicts() {
    if (!newShift.staff_id || !newShift.start_time || !newShift.end_time) return null;

    const newStart = new Date(newShift.start_time);
    const newEnd = new Date(newShift.end_time);

    const conflicts = shifts.filter((shift) => {
      if (shift.staff_id !== newShift.staff_id) return false;

      const existingStart = new Date(shift.start_time);
      const existingEnd = new Date(shift.end_time);

      // Check for overlap
      return newStart < existingEnd && newEnd > existingStart;
    });

    return conflicts.length > 0 ? conflicts : null;
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();

    const conflicts = checkConflicts();
    if (conflicts) {
      alert(
        `Conflict detected! This staff member has ${conflicts.length} overlapping shift(s). Please choose a different time.`
      );
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase.from('staff_shifts').insert({
        tenant_id: tenantId,
        staff_id: newShift.staff_id,
        branch_id: newShift.branch_id || null,
        start_time: newShift.start_time,
        end_time: newShift.end_time,
        shift_type: newShift.shift_type,
        notes: newShift.notes || null,
        status: 'SCHEDULED',
      });

      if (error) throw error;

      setShowCreateModal(false);
      setNewShift({
        staff_id: '',
        branch_id: '',
        start_time: '',
        end_time: '',
        shift_type: 'REGULAR',
        notes: '',
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating shift:', error);
      alert(error.message || 'Failed to create shift');
    }
  }

  async function handleDeleteShift(shiftId: string) {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('staff_shifts').delete().eq('id', shiftId);

      if (error) throw error;

      loadData();
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      alert(error.message || 'Failed to delete shift');
    }
  }

  function calculateDuration(startTime: string, endTime: string) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours.toFixed(1);
  }

  const weekStart = getWeekStart(selectedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/staff">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shift Management</h1>
            <p className="text-muted-foreground">Schedule and manage staff shifts</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Shift
        </Button>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={previousWeek}>
              ← Previous Week
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold">
                {formatDate(weekStart.toISOString())} - {formatDate(weekEnd.toISOString())}
              </p>
              <p className="text-sm text-muted-foreground">
                {shifts.length} shifts scheduled
              </p>
            </div>
            <Button variant="outline" onClick={nextWeek}>
              Next Week →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.length > 0 ? (
                shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{formatDate(shift.start_time)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{shift.staff?.display_name}</p>
                        <p className="text-sm text-muted-foreground">{shift.staff?.role_label}</p>
                      </div>
                    </TableCell>
                    <TableCell>{shift.branch?.name || 'N/A'}</TableCell>
                    <TableCell>
                      {new Date(shift.start_time).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(shift.end_time).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </TableCell>
                    <TableCell>
                      {calculateDuration(shift.start_time, shift.end_time)} hrs
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                        {shift.shift_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          shift.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : shift.status === 'SCHEDULED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {shift.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteShift(shift.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No shifts scheduled for this week
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle>Create New Shift</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateShift}>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staff_id">Staff Member *</Label>
                    <select
                      id="staff_id"
                      value={newShift.staff_id}
                      onChange={(e) => setNewShift({ ...newShift, staff_id: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="">Select Staff</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.display_name} - {s.role_label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch_id">Branch</Label>
                    <select
                      id="branch_id"
                      value={newShift.branch_id}
                      onChange={(e) => setNewShift({ ...newShift, branch_id: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={newShift.start_time}
                      onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={newShift.end_time}
                      onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shift_type">Shift Type</Label>
                    <select
                      id="shift_type"
                      value={newShift.shift_type}
                      onChange={(e) => setNewShift({ ...newShift, shift_type: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="OVERTIME">Overtime</option>
                      <option value="HOLIDAY">Holiday</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={newShift.notes}
                    onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                </div>

                {checkConflicts() && (
                  <div className="p-3 bg-red-50 rounded-md">
                    <p className="text-sm text-red-800 font-semibold">
                      ⚠️ Conflict detected: This staff member has overlapping shifts
                    </p>
                  </div>
                )}
              </CardContent>
              <div className="flex justify-end gap-4 p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!!checkConflicts()}>
                  Create Shift
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
