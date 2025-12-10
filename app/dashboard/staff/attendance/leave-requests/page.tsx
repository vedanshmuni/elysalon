'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Check, X, Plus, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Default leave types to seed
const DEFAULT_LEAVE_TYPES = [
  { name: 'Sick Leave', description: 'For illness or medical appointments', color: '#EF4444', days_per_year: 12, paid: true },
  { name: 'Casual Leave', description: 'For personal errands or family matters', color: '#3B82F6', days_per_year: 10, paid: true },
  { name: 'Annual Leave', description: 'For vacations and planned time off', color: '#10B981', days_per_year: 15, paid: true },
  { name: 'Maternity Leave', description: 'For expecting mothers', color: '#EC4899', days_per_year: 180, paid: true },
  { name: 'Paternity Leave', description: 'For new fathers', color: '#8B5CF6', days_per_year: 15, paid: true },
  { name: 'Unpaid Leave', description: 'Leave without pay', color: '#6B7280', days_per_year: 365, paid: false },
];

export default function LeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [currentStaffId, setCurrentStaffId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [seedingLeaveTypes, setSeedingLeaveTypes] = useState(false);

  const [formData, setFormData] = useState({
    staff_id: '',
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
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
      if (!tid) {
        console.error('No tenant ID found for user');
        return;
      }
      console.log('Loading leave requests for tenant:', tid);
      setTenantId(tid);

      // Get user's role
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tid)
        .single();
      
      setUserRole(tenantUser?.role || 'STAFF');

      // Get current user's staff record
      const { data: staffRecord } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', tid)
        .single();

      if (staffRecord) {
        setCurrentStaffId(staffRecord.id);
        setFormData(prev => ({ ...prev, staff_id: staffRecord.id }));
      }

      // Load leave requests - ultra-simple query first
      console.log('Querying leave requests for tenant:', tid);
      const { data: requests, error: requestsError } = await supabase
        .from('staff_leave_requests')
        .select('*')
        .eq('tenant_id', tid)
        .order('requested_at', { ascending: false });

      if (requestsError) {
        console.error('Error loading leave requests:', requestsError);
      } else {
        console.log('Leave requests loaded:', requests?.length || 0, requests);
      }
      
      // Now fetch related data separately if requests exist
      if (requests && requests.length > 0) {
        // Fetch staff names
        const staffIds = [...new Set(requests.map(r => r.staff_id))];
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, display_name, phone')
          .in('id', staffIds);
        
        // Fetch leave types
        const leaveTypeIds = [...new Set(requests.map(r => r.leave_type_id))];
        const { data: leaveTypeData } = await supabase
          .from('leave_types')
          .select('id, name, color, paid')
          .in('id', leaveTypeIds);
        
        // Merge data
        const mergedRequests = requests.map(req => ({
          ...req,
          staff: staffData?.find(s => s.id === req.staff_id) || null,
          leave_type: leaveTypeData?.find(lt => lt.id === req.leave_type_id) || null,
        }));
        
        setLeaveRequests(mergedRequests);
      } else {
        setLeaveRequests([]);
      }

      // Load leave types
      const { data: types } = await supabase
        .from('leave_types')
        .select('*')
        .eq('tenant_id', tid)
        .eq('is_active', true);

      setLeaveTypes(types || []);

      // Load staff (only for managers+)
      if (['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(tenantUser?.role || '')) {
        const { data: staffList } = await supabase
          .from('staff')
          .select('id, display_name')
          .eq('tenant_id', tid)
          .eq('is_active', true);
        setStaff(staffList || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaultLeaveTypes() {
    if (!tenantId) return;
    setSeedingLeaveTypes(true);
    
    try {
      const insertData = DEFAULT_LEAVE_TYPES.map(type => ({
        tenant_id: tenantId,
        ...type,
      }));

      const { error } = await supabase
        .from('leave_types')
        .insert(insertData);

      if (error) throw error;

      alert('Default leave types created successfully!');
      loadData();
    } catch (error: any) {
      console.error('Error seeding leave types:', error);
      alert('Failed to create leave types: ' + error.message);
    } finally {
      setSeedingLeaveTypes(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSubmitting(true);

    try {
      // Calculate total days
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      
      if (end < start) {
        alert('End date must be after start date');
        setSubmitting(false);
        return;
      }

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase.from('staff_leave_requests').insert({
        tenant_id: tenantId,
        staff_id: formData.staff_id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_days: diffDays,
        reason: formData.reason,
        status: 'pending',
      });

      if (error) throw error;

      alert('Leave request created successfully!');
      setShowNewRequest(false);
      setFormData({
        staff_id: currentStaffId || '',
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating leave request:', error);
      alert('Failed to create leave request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateLeaveStatus(requestId: string, status: 'approved' | 'rejected', notes?: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('staff_leave_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      alert(`Leave request ${status}!`);
      loadData();
    } catch (error) {
      console.error('Error updating leave status:', error);
      alert('Failed to update leave request');
    }
  }

  const isManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole);
  const canApprove = isManager;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Debug info - remove after fixing */}
      <div className="p-4 bg-gray-100 rounded text-xs font-mono">
        <div>Role: {userRole || '(empty)'}</div>
        <div>isManager: {String(isManager)}</div>
        <div>tenantId: {tenantId || '(empty)'}</div>
        <div>currentStaffId: {currentStaffId || '(empty)'}</div>
        <div>leaveRequests.length: {leaveRequests.length}</div>
        <div>leaveTypes.length: {leaveTypes.length}</div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/staff/attendance">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
            <p className="text-muted-foreground">
              {isManager ? 'Manage staff leave requests' : 'Request and track your leave'}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNewRequest(true)} disabled={leaveTypes.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          New Leave Request
        </Button>
      </div>

      {/* Warning if no leave types */}
      {leaveTypes.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800">No Leave Types Configured</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Leave types need to be set up before staff can request leave.
                  {isManager && ' Click the button to create default leave types.'}
                </p>
                {isManager && (
                  <Button 
                    onClick={seedDefaultLeaveTypes} 
                    className="mt-3" 
                    size="sm"
                    disabled={seedingLeaveTypes}
                  >
                    {seedingLeaveTypes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Default Leave Types'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Leave Request Form */}
      {showNewRequest && leaveTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Leave Request</CardTitle>
            <CardDescription>
              {isManager ? 'Submit a leave request for any staff member' : 'Submit your leave request for approval'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Staff Member - only show for managers */}
                {isManager && staff.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="staff">Staff Member *</Label>
                    <Select
                      value={formData.staff_id}
                      onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
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
                ) : (
                  <input type="hidden" value={currentStaffId} />
                )}

                <div className="space-y-2">
                  <Label htmlFor="leave_type">Leave Type *</Label>
                  <Select
                    value={formData.leave_type_id}
                    onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: type.color }}
                            />
                            {type.name} {!type.paid && '(Unpaid)'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    required
                    rows={3}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Please provide a reason for your leave request..."
                  />
                </div>
              </div>

              {/* Summary */}
              {formData.start_date && formData.end_date && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Duration:</strong>{' '}
                    {Math.ceil(
                      Math.abs(new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1}{' '}
                    day(s)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !formData.staff_id || !formData.leave_type_id}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNewRequest(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isManager ? 'All Leave Requests' : 'My Leave Requests'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {canApprove && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveRequests.length > 0 ? (
                leaveRequests
                  .filter(req => isManager || req.staff_id === currentStaffId)
                  .map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.staff?.display_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${request.leave_type?.color}20`,
                          color: request.leave_type?.color,
                        }}
                      >
                        {request.leave_type?.name || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(request.start_date).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(request.end_date).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{request.total_days}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={request.reason}>
                        {request.reason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : request.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      {request.reviewed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.reviewed_at).toLocaleDateString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </TableCell>
                    {canApprove && (
                      <TableCell>
                        {request.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => updateLeaveStatus(request.id, 'approved')}
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                const notes = prompt('Rejection reason (optional):');
                                updateLeaveStatus(request.id, 'rejected', notes || undefined);
                              }}
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={canApprove ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No leave requests found.
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
