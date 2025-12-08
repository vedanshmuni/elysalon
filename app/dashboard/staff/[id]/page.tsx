'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
import { ArrowLeft, Plus, Clock, Target, Award } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [staff, setStaff] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const supabase = createClient();

    // Load staff details
    const { data: staffData } = await supabase
      .from('staff')
      .select(
        `
        *,
        branch:branches(name),
        user:auth.users!inner(email)
      `
      )
      .eq('id', id)
      .single();

    setStaff(staffData);

    // Load shifts
    const { data: shiftsData} = await supabase
      .from('staff_shifts')
      .select(
        `
        *,
        branch:branches(name)
      `
      )
      .eq('staff_id', id)
      .order('start_time', { ascending: false })
      .limit(10);

    setShifts(shiftsData || []);

    // Load earnings
    const { data: earningsData } = await supabase
      .from('staff_earnings')
      .select('*')
      .eq('staff_id', id)
      .order('period_start', { ascending: false })
      .limit(6);

    setEarnings(earningsData || []);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Loading staff details...</div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Staff member not found</div>
      </div>
    );
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
            <h1 className="text-3xl font-bold tracking-tight">{staff.display_name}</h1>
            <p className="text-muted-foreground">{staff.role_label || 'Staff Member'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/staff/shifts">
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" />
              Manage Shifts
            </Button>
          </Link>
          <Link href={`/dashboard/staff/${staff.id}/edit`}>
            <Button>Edit Profile</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Service Revenue Target</p>
              <p className="text-2xl font-bold">
                {staff.target_revenue ? formatCurrency(staff.target_revenue) : 'Not Set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Retail Target</p>
              <p className="text-2xl font-bold">
                {staff.target_retail ? formatCurrency(staff.target_retail) : 'Not Set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{staff.user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="font-medium">{staff.branch?.name || 'All Branches'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  staff.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {staff.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staff.skills && staff.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staff.skills.map((skill: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills added</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Shifts */}
      {shifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift: any) => {
                  const start = new Date(shift.start_time);
                  const end = new Date(shift.end_time);
                  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                  
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>{formatDate(shift.start_time, 'PP')}</TableCell>
                      <TableCell>{shift.branch?.name}</TableCell>
                      <TableCell>{formatDate(shift.start_time, 'p')}</TableCell>
                      <TableCell>{formatDate(shift.end_time, 'p')}</TableCell>
                      <TableCell>{duration}h</TableCell>
                      <TableCell className="capitalize">{shift.status}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Earnings History */}
      {earnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earnings History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Service Earnings</TableHead>
                  <TableHead>Retail Earnings</TableHead>
                  <TableHead>Tips</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((earning: any) => (
                  <TableRow key={earning.id}>
                    <TableCell>
                      {formatDate(earning.period_start, 'PP')} - {formatDate(earning.period_end, 'PP')}
                    </TableCell>
                    <TableCell>{formatCurrency(earning.service_earnings)}</TableCell>
                    <TableCell>{formatCurrency(earning.retail_earnings)}</TableCell>
                    <TableCell>{formatCurrency(earning.tips)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(earning.total_earnings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
