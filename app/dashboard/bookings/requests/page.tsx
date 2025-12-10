'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import Link from 'next/link';

interface BookingRequest {
  id: string;
  client_id: string;
  phone_number: string;
  message: string;
  parsed_service: string | null;
  parsed_date: string | null;
  parsed_time: string | null;
  status: string;
  source: string;
  requested_at: string;
  client?: {
    full_name: string;
  };
}

interface Staff {
  id: string;
  display_name: string;
}

export default function BookingRequestsPage() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [confirming, setConfirming] = useState(false);

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

    // Load staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, display_name')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('display_name');
    setStaff(staffData || []);

    setLoading(false);
  }

  async function handleQuickConfirm(request: BookingRequest) {
    setSelectedRequest(request);
    setSelectedStaffId('');
  }

  async function confirmBooking() {
    if (!selectedRequest || !selectedStaffId) return;
    
    setConfirming(true);
    const supabase = createClient();

    try {
      // Get service ID from service name
      const { data: service } = await supabase
        .from('services')
        .select('id, duration_minutes, base_price')
        .eq('tenant_id', tenantId)
        .ilike('name', selectedRequest.parsed_service || '')
        .maybeSingle();

      if (!service) {
        alert('Service not found');
        return;
      }

      // Get first branch
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .single();

      // Create booking datetime
      const bookingDateTime = `${selectedRequest.parsed_date}T${selectedRequest.parsed_time}:00+05:30`;

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          tenant_id: tenantId,
          client_id: selectedRequest.client_id,
          branch_id: branch?.id,
          scheduled_at: bookingDateTime,
          total_duration_minutes: service.duration_minutes,
          estimated_total: service.base_price,
          status: 'CONFIRMED',
          source: 'WHATSAPP',
          notes: `WhatsApp booking request ID: ${selectedRequest.id}`
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Add booking item
      await supabase
        .from('booking_items')
        .insert({
          booking_id: booking.id,
          service_id: service.id,
          staff_id: selectedStaffId,
          duration_minutes: service.duration_minutes
        });

      // Update request status
      await supabase
        .from('booking_requests')
        .update({
          status: 'CONVERTED',
          booking_id: booking.id,
          responded_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id);

      // Reload requests
      loadRequests();
      setSelectedRequest(null);
      setSelectedStaffId('');
      alert('Booking confirmed successfully!');
    } catch (error) {
      console.error('Error confirming booking:', error);
      alert('Failed to confirm booking');
    } finally {
      setConfirming(false);
    }
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
                      {request.source === 'WHATSAPP' && (
                        <Badge className="bg-green-100 text-green-800">
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      📱 {request.phone_number}
                    </p>
                    
                    {/* Show parsed booking details if available */}
                    {request.parsed_service && request.parsed_date && request.parsed_time ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                        <p className="text-sm font-medium text-blue-900 mb-1">Booking Details:</p>
                        <p className="text-sm text-blue-800">
                          💇 <strong>Service:</strong> {request.parsed_service}
                        </p>
                        <p className="text-sm text-blue-800">
                          📅 <strong>Date:</strong> {new Date(request.parsed_date).toLocaleDateString('en-IN', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-blue-800">
                          🕐 <strong>Time:</strong> {request.parsed_time}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm mb-2">{request.message}</p>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Requested: {formatDate(request.requested_at)}
                    </p>
                  </div>
                  {request.status === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      {request.parsed_service && request.parsed_date && request.parsed_time ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleQuickConfirm(request)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Quick Confirm
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAccept(request.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      )}
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

      {/* Quick Confirm Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Confirm Booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm text-blue-900">Customer:</p>
                <p className="text-sm">{selectedRequest.client?.full_name || 'Walk-in Customer'}</p>
                <p className="text-sm text-muted-foreground">📱 {selectedRequest.phone_number}</p>
                
                <p className="font-medium text-sm text-blue-900 mt-3">Service:</p>
                <p className="text-sm">{selectedRequest.parsed_service}</p>
                
                <p className="font-medium text-sm text-blue-900 mt-3">Date & Time:</p>
                <p className="text-sm">
                  {selectedRequest.parsed_date && new Date(selectedRequest.parsed_date).toLocaleDateString('en-IN', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
                <p className="text-sm">🕐 {selectedRequest.parsed_time}</p>
              </div>

              <div>
                <Label htmlFor="staff">Select Staff Member *</Label>
                <select
                  id="staff"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">Choose staff...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  disabled={!selectedStaffId || confirming}
                  onClick={confirmBooking}
                >
                  {confirming ? 'Confirming...' : 'Confirm Booking'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(null);
                    setSelectedStaffId('');
                  }}
                  disabled={confirming}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
