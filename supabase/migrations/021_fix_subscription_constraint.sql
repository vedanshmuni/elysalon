-- Fix tenant_subscriptions to allow proper upserts

-- Add unique constraint on tenant_id (one subscription per tenant)
ALTER TABLE public.tenant_subscriptions 
ADD CONSTRAINT tenant_subscriptions_tenant_id_unique UNIQUE (tenant_id);

-- Now you can use ON CONFLICT properly
