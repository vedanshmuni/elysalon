'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Plan = {
  id: string;
  name: string;
  code: string;
  monthly_price_in_inr: number;
  yearly_price_in_inr: number;
  max_branches: number;
  max_staff: number;
  features_json: Record<string, boolean | string>;
  is_active: boolean;
};

const FEATURE_LABELS: Record<string, string> = {
  bookings: 'Bookings Management',
  calendar: 'Calendar View',
  clients: 'Client Management',
  staff: 'Staff Management',
  services: 'Service Catalog',
  pos: 'Point of Sale (POS)',
  basic_reports: 'Basic Reports',
  whatsapp: 'WhatsApp Integration',
  inventory: 'Inventory Management',
  marketing: 'Marketing & Campaigns',
  analytics: 'Advanced Analytics',
  broadcasts: 'WhatsApp Broadcasts',
  priority_support: 'Priority Support',
  attendance_management: 'Attendance Management',
  custom_integrations: 'Custom Integrations',
  white_label: 'White Label Branding',
  dedicated_support: 'Dedicated Support',
  advanced_pos: 'Advanced POS Features',
  loyalty_programs: 'Loyalty & Rewards Programs',
  gift_cards: 'Gift Card Management',
  commission_tracking: 'Staff Commission Tracking',
  multi_user_access: 'Multi-User Access Control',
  custom_reports: 'Custom Report Builder',
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price_in_inr', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(plan: Plan) {
    setSubscribing(plan.code);
    
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to signin with return URL
        router.push(`/signin?redirect=/pricing&plan=${plan.code}`);
        return;
      }

      // Get tenant_id
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!tenantUser) {
        alert('Please complete onboarding first');
        router.push('/onboarding');
        return;
      }

      // TODO: Integrate with Razorpay
      // For now, show instructions
      alert(`
🚀 Ready to subscribe to ${plan.name}!

Price: ₹${billingPeriod === 'monthly' ? plan.monthly_price_in_inr : plan.yearly_price_in_inr}/${billingPeriod}

Next steps:
1. You'll be redirected to Razorpay
2. Complete the payment
3. Your subscription will be activated immediately

Click OK to proceed...
      `.trim());

      // Navigate to checkout (we'll implement this next)
      router.push(`/billing/checkout?plan=${plan.code}&period=${billingPeriod}`);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setSubscribing(null);
    }
  }

  function getFeaturesList(features: Record<string, boolean | string>): string[] {
    return Object.entries(features)
      .filter(([_, value]) => value === true)
      .map(([key]) => FEATURE_LABELS[key] || key);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Simple pricing. All plans limited to 1 branch. Cancel anytime.
          </p>

          {/* Billing Period Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Billed Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Billed Annually
              <Badge className="ml-2" variant="secondary">Save 15%</Badge>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const features = getFeaturesList(plan.features_json);
            const price = billingPeriod === 'monthly' 
              ? plan.monthly_price_in_inr 
              : plan.yearly_price_in_inr;
            const isPopular = index === 1; // Middle plan is popular

            return (
              <Card 
                key={plan.id} 
                className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1">Most Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    1 Branch • Unlimited Staff
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ₹{billingPeriod === 'monthly' 
                          ? plan.monthly_price_in_inr.toLocaleString('en-IN')
                          : Math.round(plan.yearly_price_in_inr / 12).toLocaleString('en-IN')
                        }
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    {billingPeriod === 'yearly' ? (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed annually at ₹{plan.yearly_price_in_inr.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed monthly
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={subscribing !== null}
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                  >
                    {subscribing === plan.code ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Subscribe Now'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            All plans are billed monthly or yearly • Cancel anytime
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Questions? Contact us at support@salonos.com
          </p>
        </div>
      </div>
    </div>
  );
}
