import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureAccess } from '@/lib/features/api-guard';

export async function POST(request: NextRequest) {
  try {
    // Check feature access - attendance management requires staff feature
    const featureCheck = await checkFeatureAccess('attendance_management');
    if (featureCheck) return featureCheck;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, staff_id, branch_id, notes, latitude, longitude } = body;

    // Get tenant ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.default_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    if (action === 'clock_in') {
      // Check if already clocked in today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: existing } = await supabase
        .from('staff_attendance')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staff_id)
        .gte('clock_in', todayStart.toISOString())
        .lte('clock_in', todayEnd.toISOString())
        .maybeSingle();

      if (existing && existing.status !== 'clocked_out') {
        return NextResponse.json(
          { error: 'Staff member is already clocked in' },
          { status: 400 }
        );
      }

      // Create new attendance record
      const { data, error } = await supabase
        .from('staff_attendance')
        .insert({
          tenant_id: tenantId,
          staff_id,
          branch_id,
          clock_in: new Date().toISOString(),
          clock_in_lat: latitude,
          clock_in_lng: longitude,
          clock_in_notes: notes,
          status: 'clocked_in',
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    } else if (action === 'clock_out') {
      // Find today's attendance record
      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staff_id)
        .eq('status', 'clocked_in')
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!attendance) {
        return NextResponse.json(
          { error: 'No active clock-in found for this staff member' },
          { status: 400 }
        );
      }

      // Update attendance record
      const { data, error } = await supabase
        .from('staff_attendance')
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: latitude,
          clock_out_lng: longitude,
          clock_out_notes: notes,
          status: 'clocked_out',
        })
        .eq('id', attendance.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    } else if (action === 'start_break') {
      // Find current attendance
      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staff_id)
        .eq('status', 'clocked_in')
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!attendance) {
        return NextResponse.json(
          { error: 'No active clock-in found' },
          { status: 400 }
        );
      }

      // Create break record
      const { data: breakData, error: breakError } = await supabase
        .from('staff_breaks')
        .insert({
          attendance_id: attendance.id,
          break_start: new Date().toISOString(),
          break_type: body.break_type || 'regular',
          notes,
        })
        .select()
        .single();

      if (breakError) throw breakError;

      // Update attendance status
      await supabase
        .from('staff_attendance')
        .update({ status: 'on_break' })
        .eq('id', attendance.id);

      return NextResponse.json({ success: true, data: breakData });
    } else if (action === 'end_break') {
      // Find current attendance
      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staff_id)
        .eq('status', 'on_break')
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!attendance) {
        return NextResponse.json(
          { error: 'No active break found' },
          { status: 400 }
        );
      }

      // Find active break
      const { data: breakRecord } = await supabase
        .from('staff_breaks')
        .select('id')
        .eq('attendance_id', attendance.id)
        .is('break_end', null)
        .order('break_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!breakRecord) {
        return NextResponse.json(
          { error: 'No active break found' },
          { status: 400 }
        );
      }

      // End break
      const { error: breakError } = await supabase
        .from('staff_breaks')
        .update({ break_end: new Date().toISOString() })
        .eq('id', breakRecord.id);

      if (breakError) throw breakError;

      // Update attendance status back to clocked_in
      await supabase
        .from('staff_attendance')
        .update({ status: 'clocked_in' })
        .eq('id', attendance.id);

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in attendance API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.default_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    if (staffId) {
      // Get current status for specific staff
      const { data: attendance } = await supabase
        .from('staff_attendance')
        .select('*, staff_breaks(*)')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staffId)
        .neq('status', 'clocked_out')
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({ data: attendance });
    }

    return NextResponse.json({ error: 'staff_id required' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in attendance API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
