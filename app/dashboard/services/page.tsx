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
import { Plus, FolderOpen, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/currency';

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('default_tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.default_tenant_id;
  if (!tenantId) return null;

  // Fetch categories
  const { data: categories } = await supabase
    .from('service_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  // Build query with filters
  let query = supabase
    .from('services')
    .select(
      `
      *,
      category:service_categories(id, name)
    `
    )
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (params.category && params.category !== 'ALL') {
    query = query.eq('category_id', params.category);
  }

  const { data: services } = await query;

  // Get combos
  const { data: combos } = await supabase
    .from('service_combos')
    .select(
      `
      *,
      service_combo_items(
        service:services(name)
      )
    `
    )
    .eq('tenant_id', tenantId)
    .order('name');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground">Manage your service catalog</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/services/categories">
            <Button variant="outline">
              <FolderOpen className="mr-2 h-4 w-4" />
              Categories
            </Button>
          </Link>
          <Link href="/dashboard/services/combos/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create Combo
            </Button>
          </Link>
          <Link href="/dashboard/services/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combos</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{combos?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services?.filter((s: any) => s.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Link href="/dashboard/services">
            <Button variant={!params.category ? 'default' : 'outline'} size="sm">
              All Services
            </Button>
          </Link>
          {categories?.map((cat: any) => (
            <Link key={cat.id} href={`/dashboard/services?category=${cat.id}`}>
              <Button variant={params.category === cat.id ? 'default' : 'outline'} size="sm">
                {cat.name}
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services ({services?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services && services.length > 0 ? (
                services.map((service: any) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.category?.name || '-'}</TableCell>
                    <TableCell>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {service.duration_minutes} min
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(service.base_price)}
                    </TableCell>
                    <TableCell>{service.tax_rate}%</TableCell>
                    <TableCell>{service.gender_tag || 'All'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          service.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {service.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/services/${service.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No services found. Add your first service to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Combos Section */}
      {combos && combos.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Service Combos ({combos.length})</CardTitle>
            <Link href="/dashboard/services/combos/new">
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Combo
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Services Included</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combos.map((combo: any) => (
                  <TableRow key={combo.id}>
                    <TableCell className="font-medium">{combo.name}</TableCell>
                    <TableCell>
                      {combo.service_combo_items?.length || 0} services
                      <div className="text-xs text-muted-foreground">
                        {combo.service_combo_items
                          ?.map((item: any) => item.service?.name)
                          .join(', ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {combo.total_duration_minutes} min
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(combo.total_price)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          combo.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {combo.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/services/combos/${combo.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
