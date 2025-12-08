'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import Link from 'next/link';

interface BookingRequest {
  id: string;
  client_id: string;
  phone_number: string;
  message: string;
  status: string;
  requested_at: string;
  client?: {
    full_name: string;
  };
}

export default function BookingRequestsPage() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
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

    const { data } = await supabase
      .from('booking_requests')
      .select(`
        *,
        client:clients(full_name)
      `)
      .eq('tenant_id', tid)
      .order('requested_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  }

  async function handleAccept(requestId: string) {
    // Redirect to create booking with pre-filled data
    window.location.href = `/dashboard/bookings/new?request_id=${requestId}`;
  }

  async function handleDecline(requestId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('booking_requests')
      .update({
        status: 'DECLINED',
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (!error) {
      loadRequests();
    }
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    DECLINED: 'bg-red-100 text-red-800',
    CONVERTED: 'bg-blue-100 text-blue-800',
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Booking Requests</h1>
        <p className="text-muted-foreground">
          Manage booking requests received via WhatsApp
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requests.filter((r) => r.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                requests.filter(
                  (r) =>
                    r.status === 'ACCEPTED' &&
                    new Date(r.requested_at).toDateString() === new Date().toDateString()
                ).length
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No booking requests yet. Share your WhatsApp number with clients to receive
                booking requests!
              </p>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        {request.client?.full_name || 'Unknown Client'}
                      </h3>
                      <Badge className={statusColors[request.status] || 'bg-gray-100'}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      📱 {request.phone_number}
                    </p>
                    <p className="text-sm mb-2">{request.message}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested: {formatDate(request.requested_at)}
                    </p>
                  </div>
                  {request.status === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAccept(request.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecline(request.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
