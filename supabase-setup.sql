-- Run this AFTER the main Tobacco Shop schema.
-- It adds one atomic RPC used by the app to complete a sale safely.

create or replace function public.complete_order(
  p_customer_id uuid default null,
  p_customer_name text default 'Walk-in / No customer',
  p_discount numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_cost numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_profit numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_sold_price numeric(12,2);
  v_buy numeric(12,2);
  v_line numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if p_discount < 0 then
    raise exception 'Discount cannot be negative';
  end if;

  -- Lock products and validate stock before changing anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
    for update;

    if not found then
      raise exception 'Product not found';
    end if;

    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid quantity';
    end if;

    if v_product.qty < v_qty then
      raise exception 'Not enough stock for %', v_product.name;
    end if;

    v_sold_price := coalesce((v_item->>'sold_price')::numeric, v_product.sell);
    v_buy := v_product.buy;
    v_line := v_qty * v_sold_price;
    v_subtotal := v_subtotal + v_line;
    v_cost := v_cost + (v_qty * v_buy);
  end loop;

  if p_discount > v_subtotal then
    raise exception 'Discount cannot exceed subtotal';
  end if;

  v_total := v_subtotal - p_discount;
  v_profit := v_total - v_cost;

  insert into public.orders (
    customer_id, customer_name, subtotal, discount, total, profit, status, created_by
  ) values (
    p_customer_id, coalesce(nullif(trim(p_customer_name), ''), 'Walk-in / No customer'),
    v_subtotal, p_discount, v_total, v_profit, 'completed', auth.uid()
  ) returning order_number into v_order_number;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
    for update;

    v_qty := (v_item->>'qty')::integer;
    v_sold_price := coalesce((v_item->>'sold_price')::numeric, v_product.sell);

    insert into public.order_items (
      order_id, product_id, product_name, quantity, base_price, sold_price
    ) values (
      v_order_number, v_product.id, v_product.name, v_qty, v_product.sell, v_sold_price
    );

    update public.products
    set qty = qty - v_qty
    where id = v_product.id;

    insert into public.stock_movements (
      product_id, order_id, movement_type, quantity, purchase_cost, reason, created_by
    ) values (
      v_product.id, v_order_number, 'sale', -v_qty, v_product.buy,
      'Sale #' || v_order_number, auth.uid()
    );
  end loop;

  return v_order_number;
end;
$$;

grant execute on function public.complete_order(uuid, text, numeric, jsonb) to authenticated;


-- Customer credit / accounts: payments are recorded separately from orders.
create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references auth.users(id)
);

alter table public.customer_payments enable row level security;
drop policy if exists "customer_payments_admin_all" on public.customer_payments;
create policy "customer_payments_admin_all" on public.customer_payments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists customer_payments_customer_id_idx on public.customer_payments(customer_id);
create index if not exists customer_payments_paid_at_idx on public.customer_payments(paid_at desc);

-- Keep the client safe: a payment can only be recorded against a real customer.
create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_customer_id is null then raise exception 'Customer is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then raise exception 'Customer not found'; end if;
  insert into public.customer_payments(customer_id, amount, note, created_by)
  values (p_customer_id, p_amount, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.record_customer_payment(uuid, numeric, text) to authenticated;
