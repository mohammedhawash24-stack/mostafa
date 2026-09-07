/*
 * Supabase data layer.
 * Supabase data layer for the live application.
 */
const API = (() => {
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function mapProduct(row) {
    if (!row) return row;
    return {
      id: row.id,
      name: row.name || '',
      brand: row.brand || '',
      type: row.type || '',
      variant: row.variant || '',
      supplier: row.supplier || '',
      supplierId: row.supplier_id || '',
      buy: Number(row.buy ?? 0),
      sell: Number(row.sell ?? 0),
      qty: Number(row.qty ?? 0),
      min: Number(row.min_qty ?? row.min ?? 0),
      image: row.image_url || ''
    };
  }

  function mapCustomer(row) {
    return row ? {
      id: row.id,
      name: row.name || '',
      phone: row.phone || '',
      notes: row.notes || '',
      createdAt: row.created_at
    } : row;
  }

  function mapMovement(row) {
    return row ? {
      id: row.id,
      date: row.created_at,
      productId: row.product_id,
      productName: row.product_name || '',
      change: Number(row.quantity || 0),
      reason: row.reason || row.movement_type || ''
    } : row;
  }

  function mapOrder(row) {
    if (!row) return null;
    const items = (row.order_items || []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name || '',
      qty: Number(item.quantity || 0),
      buy: Number(item.base_price || 0),
      sell: Number(item.sold_price || 0)
    }));
    return {
      id: String(row.order_number),
      date: row.created_at,
      customerId: row.customer_id || '',
      customerName: row.customer_name || 'Walk-in / No customer',
      items,
      sub: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      total: Number(row.total || 0),
      cost: items.reduce((sum, item) => sum + item.qty * item.buy, 0),
      profit: Number(row.profit || 0)
    };
  }

  async function get(resource) {
    if (resource === 'products') {
      const { data, error } = await window.supabaseClient.from('products').select('*').order('name');
      if (error) throw error;
      return data.map(mapProduct);
    }
    if (resource === 'orders') {
      const { data, error } = await window.supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(mapOrder);
    }
    if (resource === 'stockMovements') {
      const { data, error } = await window.supabaseClient
        .from('stock_movements')
        .select('*, products(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data.map((row) => ({ ...mapMovement(row), productName: row.products?.name || mapMovement(row).productName }));
    }
    if (resource === 'customers') {
      const { data, error } = await window.supabaseClient.from('customers').select('*').order('name');
      if (error) throw error;
      return data.map(mapCustomer);
    }
    if (resource === 'payments') {
      const { data, error } = await window.supabaseClient.from('customer_payments').select('*').order('paid_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({ id: row.id, customerId: row.customer_id, amount: Number(row.amount || 0), date: row.paid_at, note: row.note || '' }));
    }
    if (resource === 'suppliers') {
      const { data, error } = await window.supabaseClient.from('suppliers').select('*').order('name');
      if (error) throw error;
      return data;
    }
    if (resource === 'lastReceipt') {
      const { data, error } = await window.supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return mapOrder(data);
    }
    return null;
  }

  async function post(resource, body) {
    if (resource === 'products') {
      const payload = {
        name: body.name,
        brand: body.brand || null,
        type: body.type,
        variant: body.variant || null,
        supplier: body.supplier || null,
        buy: Number(body.buy || 0),
        sell: Number(body.sell || 0),
        qty: Number(body.qty || 0),
        min_qty: Number(body.min || 0),
        image_url: body.image || null
      };
      const { data, error } = await window.supabaseClient.from('products').insert(payload).select().single();
      if (error) throw error;
      return mapProduct(data);
    }
    if (resource === 'payments') {
      const { data, error } = await window.supabaseClient.from('customer_payments').insert({
        customer_id: body.customerId,
        amount: Number(body.amount || 0),
        note: body.note || null,
        created_by: (await window.supabaseClient.auth.getUser()).data.user?.id || null
      }).select().single();
      if (error) throw error;
      return { id: data.id, customerId: data.customer_id, amount: Number(data.amount || 0), date: data.paid_at, note: data.note || '' };
    }
    if (resource === 'customers') {
      const { data, error } = await window.supabaseClient.from('customers').insert({
        name: body.name,
        phone: body.phone || null,
        notes: body.notes || null
      }).select().single();
      if (error) throw error;
      return mapCustomer(data);
    }
    throw new Error(`Unsupported create operation: ${resource}`);
  }

  async function put(resource, id, body) {
    if (resource !== 'products') throw new Error(`Unsupported update operation: ${resource}`);
    const payload = {
      name: body.name,
      brand: body.brand || null,
      type: body.type,
      variant: body.variant || null,
      supplier: body.supplier || null,
      buy: Number(body.buy || 0),
      sell: Number(body.sell || 0),
      qty: Number(body.qty || 0),
      min_qty: Number(body.min || 0),
      image_url: body.image || null
    };
    const { data, error } = await window.supabaseClient.from('products').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return mapProduct(data);
  }

  async function remove(resource, id) {
    if (resource !== 'products') throw new Error(`Unsupported delete operation: ${resource}`);
    const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  async function patchProductStock(id, quantity, reason = 'Manual adjustment') {
    const { data: product, error: productError } = await window.supabaseClient
      .from('products').select('*').eq('id', id).single();
    if (productError) throw productError;
    const nextQty = Number(product.qty || 0) + Number(quantity || 0);
    if (nextQty < 0) throw new Error('Not enough stock');

    const { data: updated, error: updateError } = await window.supabaseClient
      .from('products').update({ qty: nextQty }).eq('id', id).select().single();
    if (updateError) throw updateError;

    const { error: movementError } = await window.supabaseClient.from('stock_movements').insert({
      product_id: id,
      movement_type: Number(quantity) >= 0 ? 'purchase' : 'adjustment',
      quantity: Number(quantity),
      purchase_cost: Number(product.buy || 0),
      reason
    });
    if (movementError) throw movementError;
    return mapProduct(updated);
  }

  async function completeOrder(order) {
    const items = order.items.map((item) => ({
      product_id: item.productId,
      qty: Number(item.qty),
      sold_price: Number(item.sell)
    }));

    const { data: orderNumber, error } = await window.supabaseClient.rpc('complete_order', {
      p_customer_id: order.customerId || null,
      p_customer_name: order.customerName || 'Walk-in / No customer',
      p_discount: Number(order.discount || 0),
      p_items: items
    });
    if (error) throw error;
    return String(orderNumber);
  }

  async function seedDemo() {
    const existing = await get('products');
    if (existing.length) return false;
    const rows = [
      { name: 'Marlboro Red', brand: 'Marlboro', type: 'Cigarettes', buy: 8.5, sell: 12, qty: 50, min: 10 },
      { name: 'Marlboro Gold', brand: 'Marlboro', type: 'Cigarettes', buy: 8.5, sell: 12, qty: 32, min: 8 },
      { name: 'Winston Blue', brand: 'Winston', type: 'Cigarettes', buy: 7.5, sell: 11, qty: 28, min: 7 },
      { name: 'L&M Red', brand: 'L&M', type: 'Cigarettes', buy: 7, sell: 10, qty: 40, min: 10 },
      { name: 'Camel Yellow', brand: 'Camel', type: 'Cigarettes', buy: 7.5, sell: 11, qty: 25, min: 8 },
      { name: 'Davidoff Gold', brand: 'Davidoff', type: 'Cigarettes', buy: 9, sell: 13, qty: 18, min: 6 },
      { name: 'Nargileh Apple', brand: 'Nargileh', type: 'Hookah / Argileh', buy: 16, sell: 25, qty: 5, min: 8 }
    ];
    for (const row of rows) {
      const created = await post('products', { ...row, qty: 0 });
      if (row.qty) await patchProductStock(created.id, row.qty, 'Initial demo stock');
    }
    return true;
  }

  async function reset() {
    throw new Error('Reset is disabled for the live Supabase database.');
  }

  async function login(email, password) {
    const client = window.supabaseClient;
    if (!client || !client.auth || typeof client.auth.signInWithPassword !== 'function') {
      throw new Error('Supabase is not connected. Refresh the page and make sure you are online.');
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    const { data: profile, error: profileError } = await window.supabaseClient
      .from('profiles').select('role').eq('id', data.user.id).single();
    if (profileError || profile?.role !== 'admin') {
      await window.supabaseClient.auth.signOut();
      return false;
    }
    return true;
  }

  async function logout() {
    await window.supabaseClient.auth.signOut();
  }

  return {
    get, post, put, delete: remove, patchProductStock,
    completeOrder, seedDemo, reset, login, logout,
    setLastReceipt: async (receipt) => receipt
  };
})();

function hasDuplicateProduct(data, candidate, currentId = '') {
  const name = String(candidate.name || '').trim().toLowerCase();
  const brand = String(candidate.brand || '').trim().toLowerCase();
  const type = String(candidate.type || '').trim().toLowerCase();
  const variant = String(candidate.variant || '').trim().toLowerCase();
  return data.products.some((product) =>
    String(product.id) !== String(currentId) &&
    String(product.name || '').trim().toLowerCase() === name &&
    String(product.brand || '').trim().toLowerCase() === brand &&
    String(product.type || '').trim().toLowerCase() === type &&
    String(product.variant || '').trim().toLowerCase() === variant
  );
}
