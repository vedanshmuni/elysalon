'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<any>(null);

  useEffect(() => {
    if (inviteToken) {
      loadInvitationDetails();
    }
  }, [inviteToken]);

  async function loadInvitationDetails() {
    setLoadingInvite(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('get_invitation_details', {
        p_token: inviteToken,
      });

      if (error) throw error;

      if (data.valid) {
        setInviteDetails(data);
        setEmail(data.email);
      } else {
        setError(data.error || 'Invalid invitation');
      }
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation details');
    } finally {
      setLoadingInvite(false);
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
    const supabase = createClient();

    // Sign up the user WITHOUT email confirmation
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: {
          full_name: fullName,
        },
      },
    });

    // Auto-confirm the email immediately (no verification needed)
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.updateUser({
        email: email,
        data: { email_confirmed: true }
      });
    }      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Profile is automatically created by database trigger
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If signing up via invitation, accept the invitation
        if (inviteToken) {
          const { error: acceptError } = await supabase.rpc('accept_invitation', {
            p_token: inviteToken,
            p_user_id: data.user.id,
          });

          if (acceptError) {
            console.error('Error accepting invitation:', acceptError);
            setError('Account created but failed to join team. Please contact support.');
            setLoading(false);
            return;
          }

          // Refresh session to get updated tenant access
          await supabase.auth.refreshSession();
          
          // Redirect to dashboard (already a member)
          router.push('/dashboard');
        } else {
          // Regular signup - go to onboarding
          router.push('/onboarding');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading invitation...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          {inviteDetails ? 'Join Team' : 'Create Account'}
        </CardTitle>
        <CardDescription>
          {inviteDetails 
            ? `You've been invited to join ${inviteDetails.tenant_name} as ${inviteDetails.role}`
            : 'Sign up to get started with SalonOS'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inviteDetails && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p><strong>Invitation from:</strong> {inviteDetails.inviter_name}</p>
            <p><strong>Role:</strong> {inviteDetails.role}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Expires: {new Date(inviteDetails.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}
        
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!inviteDetails}
            />
            {inviteDetails && (
              <p className="text-xs text-muted-foreground">
                Email is pre-filled from invitation
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
          {error && <p className="text-sm text-destructive">{error}</p>}}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/signin" className="text-primary hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
