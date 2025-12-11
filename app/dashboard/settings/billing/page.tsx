'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Calendar, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Subscription = {
  id: string;
  plan_code: string;
  billing_period: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
};

type Plan = {
  name: string;
  code: string;
  monthly_price_in_inr: number;
  yearly_price_in_inr: number;
  max_branches: number;
  max_staff: number;
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tenant
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!tenantUser) return;

      // Get subscription
      const { data: subData, error: subError } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantUser.tenant_id)
        .single();

      if (subError) throw subError;
      setSubscription(subData);

      // Get plan details
      if (subData) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('code', subData.plan_code)
          .single();

        setPlan(planData);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ACTIVE: 'default',
      TRIAL: 'secondary',
      PAST_DUE: 'destructive',
      CANCELLED: 'outline',
      EXPIRED: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function isTrialExpiringSoon() {
    if (!subscription?.trial_ends_at) return false;
    const trialEnd = new Date(subscription.trial_ends_at);
    const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3 && daysLeft > 0;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!subscription || !plan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and billing</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>Choose a plan to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/pricing')}>
              View Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const price = subscription.billing_period === 'monthly' 
    ? plan.monthly_price_in_inr 
    : plan.yearly_price_in_inr;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      {/* Trial Warning */}
      {isTrialExpiringSoon() && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                Your trial is ending soon
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
                Subscribe now to continue using SalonOS without interruption.
              </p>
              <Button size="sm" className="mt-3" onClick={() => router.push('/pricing')}>
                Subscribe Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                {plan.name} Plan
                {getStatusBadge(subscription.status)}
              </CardTitle>
              <CardDescription>
                {subscription.billing_period === 'monthly' ? 'Monthly' : 'Annual'} billing
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">₹{price.toLocaleString('en-IN')}</p>
              <p className="text-sm text-muted-foreground">
                /{subscription.billing_period === 'monthly' ? 'month' : 'year'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Current Period</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                </p>
              </div>
            </div>

            {subscription.trial_ends_at && (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Trial Ends</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(subscription.trial_ends_at)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Usage Limits</p>
              <p className="text-sm text-muted-foreground">
                1 Branch • Unlimited Staff
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => router.push('/pricing')}>
              Change Plan
            </Button>
            <Button variant="outline" disabled>
              Manage Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>View your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No payment history yet. Your first payment will appear here after your trial ends.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
