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
import { Plus, Users, Calendar, DollarSign, Target } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';
import { requireRole, FEATURE_PERMISSIONS } from '@/lib/auth/roles';

export default async function StaffPage() {
  // Require staff management permission - redirects unauthorized users
  const { tenantId } = await requireRole(FEATURE_PERMISSIONS.manageStaff);
  
  const supabase = await createClient();

  // Fetch staff members
  const { data: staffMembers, error: staffError } = await supabase
    .from('staff')
    .select('*, branch:branches(id, name)')
    .eq('tenant_id', tenantId)
    .order('display_name', { ascending: true });

  // Fetch tenant_users to get roles
  const { data: tenantUsers } = await supabase
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId);

  // Map roles to staff members
  const staffWithRoles = staffMembers?.map((staff: any) => ({
    ...staff,
    role: tenantUsers?.find((tu: any) => tu.user_id === staff.user_id)?.role || null
  }));

  // Get active staff count
  const activeCount = staffWithRoles?.filter((s: any) => s.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground">Manage team members and schedules</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/staff/attendance">
            <Button variant="outline" size="sm">
              <Users className="mr-2 h-4 w-4" />
              Attendance
            </Button>
          </Link>
          <Link href="/dashboard/staff/commissions">
            <Button variant="outline" size="sm">
              <DollarSign className="mr-2 h-4 w-4" />
              Commissions
            </Button>
          </Link>
          <Link href="/dashboard/staff/shifts">
            <Button variant="outline" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Shifts
            </Button>
          </Link>
          <Link href="/dashboard/staff/create-account">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Staff Account
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
            <div className="text-2xl font-bold">{staffWithRoles?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rules</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Link href="/dashboard/staff/commissions">
                <Button variant="link" className="p-0 h-auto">
                  Manage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Staff Members ({staffWithRoles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Target Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffWithRoles && staffWithRoles.length > 0 ? (
                staffWithRoles.map((staff: any) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      {staff.display_name}
                      {!staff.user_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(No account)</span>
                      )}
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          staff.role === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                          staff.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {staff.role || 'STAFF'}
                        </span>
                        {staff.role_label && (
                          <span className="text-xs text-muted-foreground">{staff.role_label}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{staff.branch?.name || 'All Branches'}</TableCell>
                    <TableCell>
                      {staff.skills && staff.skills.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {staff.skills.slice(0, 2).map((skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                            >
                              {skill}
                            </span>
                          ))}
                          {staff.skills.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{staff.skills.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {staff.target_revenue ? (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {formatCurrency(staff.target_revenue)}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          staff.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/staff/${staff.id}`}>
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
                    No staff members found. Add your first team member to get started.
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
