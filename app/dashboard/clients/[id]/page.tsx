'use client';

import { use, useState, useEffect } from 'react';
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
import { ArrowLeft, Phone, Mail, Calendar, DollarSign, Edit } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/utils/currency';
import { formatPhone } from '@/lib/utils/helpers';

interface ClientDetail {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  address: string;
  notes: string;
  total_visits: number;
  total_spend: number;
  last_visit_at: string;
  created_at: string;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [clientNotes, setClientNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
    const supabase = createClient();
    
    // Fetch client details
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError) {
      console.error('Error loading client:', clientError);
      alert('Failed to load client');
      return;
    }

    setClient(clientData);

    // Fetch booking history
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(
        `
        *,
        booking_items(
          service:services(name),
          staff:staff(display_name)
        )
      `
      )
      .eq('client_id', id)
      .order('scheduled_start', { ascending: false })
      .limit(10);

    setBookings(bookingsData || []);

    // Fetch notes
    const { data: notesData } = await supabase
      .from('client_notes')
      .select(
        `
        *,
        author:auth.users(email)
      `
      )
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    setClientNotes(notesData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Loading client details...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Client not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.full_name}</h1>
            <p className="text-muted-foreground">Client Profile</p>
          </div>
        </div>
        <Link href={`/dashboard/clients/${client.id}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Client Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{client.phone ? formatPhone(client.phone) : '-'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email || '-'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">
                      {client.date_of_birth ? formatDate(client.date_of_birth) : '-'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{client.gender || '-'}</p>
                </div>
              </div>

              {client.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{client.address}</p>
                </div>
              )}

              {client.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visit History */}
          <Card>
            <CardHeader>
              <CardTitle>Visit History ({bookings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.length > 0 ? (
                    bookings.map((booking: any) => (
                      <TableRow key={booking.id}>
                        <TableCell>{formatDate(booking.scheduled_start)}</TableCell>
                        <TableCell>
                          {booking.booking_items?.map((item: any) => item.service?.name).join(', ')}
                        </TableCell>
                        <TableCell>
                          {booking.booking_items?.[0]?.staff?.display_name || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(
                            booking.booking_items?.reduce((sum: number, item: any) => sum + (item.price || 0), 0) || 0
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{booking.status}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No visit history available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Client Notes */}
          {clientNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Notes ({clientNotes.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {clientNotes.map((note: any) => (
                  <div key={note.id} className="border-b pb-3 last:border-0">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(note.created_at, 'PPp')} by {note.author?.email}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-3xl font-bold">{client.total_visits || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-3xl font-bold">{formatCurrency(client.total_spend || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Visit</p>
                <p className="font-medium">
                  {client.last_visit_at ? formatDate(client.last_visit_at) : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Since</p>
                <p className="font-medium">{formatDate(client.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/dashboard/bookings/new?client=${client.id}`}>
                <Button className="w-full">
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Appointment
                </Button>
              </Link>
              <Link href={`/dashboard/pos?client=${client.id}`}>
                <Button variant="outline" className="w-full">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
