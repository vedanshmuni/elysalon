'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, X, Clock } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/utils/currency';

interface BookingDetail {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  notes: string;
  client: { id: string; full_name: string; phone: string } | null;
  branch: { id: string; name: string };
  booking_items: Array<{
    id: string;
    price: number;
    service: { name: string; duration_minutes: number };
    staff: { display_name: string };
  }>;
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [id]);

  async function loadBooking() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `
        *,
        client:clients(id, full_name, phone),
        branch:branches(id, name),
        booking_items(
          id,
          price,
          status,
          service:services(name, duration_minutes),
          staff:staff(display_name)
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      alert('Failed to load booking');
      return;
    }

    setBooking(data);
    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    if (!booking) return;
    setUpdating(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (error) throw error;

      setBooking({ ...booking, status: newStatus });
      alert('Booking status updated successfully');
    } catch (error: any) {
      console.error('Error updating booking:', error);
      alert(error.message || 'Failed to update booking');
    } finally {
      setUpdating(false);
    }
  }

  async function deleteBooking() {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setUpdating(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard/bookings');
      router.refresh();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      alert(error.message || 'Failed to cancel booking');
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Loading booking...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Booking not found</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    NO_SHOW: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/bookings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Booking Details</h1>
            <p className="text-muted-foreground">
              {new Date(booking.scheduled_start).toLocaleDateString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })} at {new Date(booking.scheduled_start).toLocaleTimeString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[booking.status]
          }`}
        >
          {booking.status}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.client ? (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <p className="font-medium">{booking.client.full_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Phone:</span>
                    <p className="font-medium">{booking.client.phone}</p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Walk-in Customer</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {booking.booking_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Staff: {item.staff.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {item.service.duration_minutes} minutes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.price)}</p>
                      <p className="text-xs text-muted-foreground">{item.status}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-lg font-semibold">{formatCurrency(booking.total_price)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {booking.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{booking.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.status === 'PENDING' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus('CONFIRMED')}
                  disabled={updating}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Booking
                </Button>
              )}
              {booking.status === 'CONFIRMED' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus('IN_PROGRESS')}
                  disabled={updating}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Start Service
                </Button>
              )}
              {booking.status === 'IN_PROGRESS' && (
                <Button
                  className="w-full"
                  onClick={() => updateStatus('COMPLETED')}
                  disabled={updating}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark Complete
                </Button>
              )}
              {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={deleteBooking}
                  disabled={updating}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Branch:</span>
                <p className="font-medium">{booking.branch.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <p className="font-medium">{new Date(booking.scheduled_start).toLocaleDateString('en-IN', { 
                  timeZone: 'Asia/Kolkata',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>
                <p className="font-medium">{new Date(booking.scheduled_start).toLocaleTimeString('en-IN', { 
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })} - {new Date(booking.scheduled_end).toLocaleTimeString('en-IN', { 
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="font-medium">
                  {booking.booking_items.reduce(
                    (sum, item) => sum + item.service.duration_minutes,
                    0
                  )}{' '}
                  minutes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
