import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeatureAccess } from '@/lib/features/api-guard';

/**
 * GET /api/broadcasts
 * Get all broadcasts for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Check feature access
    const featureCheck = await checkFeatureAccess('broadcasts');
    if (featureCheck) return featureCheck;

    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.default_tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    // Fetch campaigns (broadcasts)
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching broadcasts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch broadcasts', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ broadcasts: campaigns || [] });
  } catch (error: any) {
    console.error('Error in broadcasts fetch:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch broadcasts' },
      { status: 500 }
    );
  }
}
