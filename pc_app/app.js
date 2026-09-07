/*
 * Cigarette Shop Admin
 * Main application logic.
 */

const AUTH_KEY = 'cig_admin_auth';

let db = {
  products: [],
  orders: [],
  stockMovements: [],
  payments: [],
  lastReceipt: null,
};

let cart = [];

const $ = (id) => document.getElementById(id);

const money = (value) => `₪${Number(value || 0).toFixed(2)}`;

const escapeHtml = (value) => String(value ?? '').replace(
  /[&<>"']/g,
  (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]),
);

const pages = {
  dashboard: ['לוח בקרה', 'לוח בקרה'],
  inventory: ['מלאי / מחסן', 'מלאי'],
  orders: ['הזמנה חדשה', 'הזמנה חדשה'],
  history: ['היסטוריית הזמנות', 'היסטוריית הזמנות'],
  reports: ['דוחות', 'דוחות'],
  movements: ['תנועות מלאי', 'תנועות מלאי'],
  accounts: ['חשבונות לקוחות', 'חשבונות לקוחות'],
  receipt: ['קבלה', 'קבלה'],
};

async function refresh() {
  db.products = await MockAPI.get('products');
  db.orders = await MockAPI.get('orders');
  db.stockMovements = await MockAPI.get('stockMovements');
  db.payments = await MockAPI.get('payments');
  db.lastReceipt = await MockAPI.get('lastReceipt');
  if (window.renderOrderCustomers) await window.renderOrderCustomers();
  try { db._customersCache = await MockAPI.get('customers'); } catch {}
  render();
}

async function login() {
  const email = $('user').value.trim();
  const password = $('pass').value;
  if (!email || !password) {
    $('loginMsg').textContent = 'Enter your email and password.';
    return;
  }
  try {
    const valid = await MockAPI.login(email, password);
    if (!valid) {
      $('loginMsg').textContent = 'Incorrect email, password, or admin access.';
      return;
    }
    sessionStorage.setItem(AUTH_KEY, '1');
    await showApp();
  } catch (error) {
    $('loginMsg').textContent = error.message || 'Login failed.';
  }
}

async function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  $('todayDate').textContent = new Date().toLocaleDateString();
  try {
    await refresh();
  } catch (error) {
    $('login').hidden = false;
    $('app').hidden = true;
    $('loginMsg').textContent = error.message || 'Could not load Supabase data.';
  }
}

function go(page) {
  document.querySelectorAll('.page').forEach((element) => {
    element.hidden = element.id !== page;
  });

  document.querySelectorAll('#sideNav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });

  const [title, label] = pages[page] || pages.dashboard;
  $('pageTitle').textContent = title;
  $('pageName').textContent = label;
  render();
}

function render() {
  renderProducts();
  renderSelect();
  renderCart();
  renderStats();
  renderDashboard();
  renderHistory();
  renderReports();
  renderMovements();
  renderCustomerAccounts();
  renderReceipt();
}

function renderStats() {
  const today = new Date().toDateString();
  const orders = db.orders.filter(
    (order) => new Date(order.date).toDateString() === today,
  );

  const stockUnits = db.products.reduce(
    (total, product) => total + Number(product.qty || 0),
    0,
  );

  const inventoryCost = db.products.reduce(
    (total, product) => total + Number(product.qty || 0) * Number(product.buy || 0),
    0,
  );

  const sales = orders.reduce((total, order) => total + Number(order.total || 0), 0);
  const profit = orders.reduce((total, order) => total + Number(order.profit || 0), 0);

  $('sProducts').textContent = db.products.length;
  $('sUnits').textContent = stockUnits;
  $('sCost').textContent = money(inventoryCost);
  $('sSales').textContent = money(sales);
  $('sProfit').textContent = money(profit);
  $('sOrders').textContent = `${orders.length} הזמנות`;
  $('sLow').textContent = db.products.filter(
    (product) => Number(product.qty) <= Number(product.min),
  ).length;
}

function renderDailyProfit() {
  const chart = $('dailyProfitChart');
  const totalEl = $('dailyProfitTotal');
  const monthSelect = $('profitMonth');
  const daysSelect = $('profitDays');
  const monthTotalEl = $('dailyProfitMonthTotal');
  const monthLabelEl = $('dailyProfitMonthLabel');
  const subtitleEl = $('dailyProfitSubtitle');
  if (!chart || !totalEl || !monthSelect || !daysSelect) return;

  const now = new Date();
  const keyOf = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const lang = window.currentLanguage || localStorage.getItem('cigarette_shop_language') || 'he';
  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  // Build a month selector for the current month + previous 11 months.
  const currentMonth = monthKey(now);
  if (!monthSelect.dataset.ready) {
    const months = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) });
    }
    monthSelect.innerHTML = months.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
    monthSelect.value = currentMonth;
    monthSelect.dataset.ready = '1';
  } else {
    const selected = monthSelect.value || currentMonth;
    const options = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ key: monthKey(d), label: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) });
    }
    monthSelect.innerHTML = options.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
    monthSelect.value = options.some(m => m.key === selected) ? selected : currentMonth;
  }

  const selectedKey = monthSelect.value || currentMonth;
  const [year, month] = selectedKey.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const isCurrentMonth = selectedKey === currentMonth;
  const lastDay = isCurrentMonth ? now.getDate() : monthEnd.getDate();
  const requested = daysSelect.value === 'all' ? monthEnd.getDate() : Number(daysSelect.value || 30);
  const dayCount = Math.min(requested, lastDay);
  const firstDayNumber = Math.max(1, lastDay - dayCount + 1);

  const totals = [];
  for (let dayNumber = firstDayNumber; dayNumber <= lastDay; dayNumber += 1) {
    const day = new Date(year, month - 1, dayNumber);
    const key = keyOf(day);
    const orders = db.orders.filter(order => keyOf(order.date) === key);
    totals.push({
      day,
      profit: orders.reduce((sum, order) => sum + Number(order.profit || 0), 0),
      sales: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      orders: orders.length,
    });
  }

  // Monthly total always covers the whole selected month (or month-to-date for the current month).
  const monthOrders = db.orders.filter(order => {
    const d = new Date(order.date);
    return !Number.isNaN(d.getTime()) && monthKey(d) === selectedKey;
  });
  const monthProfit = monthOrders.reduce((sum, order) => sum + Number(order.profit || 0), 0);
  const visibleProfit = totals.reduce((sum, item) => sum + item.profit, 0);
  totalEl.textContent = money(visibleProfit);
  if (monthTotalEl) monthTotalEl.textContent = money(monthProfit);
  if (monthLabelEl) monthLabelEl.textContent = isCurrentMonth
    ? (lang === 'he' ? 'רווח החודש עד היום' : 'Month-to-date profit')
    : (lang === 'he' ? 'רווח החודש' : 'Selected month profit');
  if (subtitleEl) subtitleEl.textContent = lang === 'he'
    ? `רווח יומי — ${dayCount} ימים אחרונים בחודש שנבחר.`
    : `Daily profit — last ${dayCount} days in the selected month.`;

  const maxProfit = Math.max(1, ...totals.map(item => item.profit));
  chart.innerHTML = totals.map(item => {
    const width = item.profit > 0 ? Math.max(4, (item.profit / maxProfit) * 100) : 0;
    const label = item.day.toLocaleDateString(locale, { weekday: 'short' });
    const date = item.day.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    return `
      <article class="daily-profit-row">
        <section class="daily-profit-date"><b>${label}</b><small>${date}</small></section>
        <section class="daily-profit-track" title="${money(item.profit)} · ${item.orders} orders">
          <span class="daily-profit-bar" style="width:${width}%"></span>
        </section>
        <section class="daily-profit-value"><b>${money(item.profit)}</b><small>${money(item.sales)} sales · ${item.orders}</small></section>
      </article>`;
  }).join('') || '<p class="empty">No days to display.</p>';
}

function renderCustomerAccounts() {
  const body = $('customerAccountRows');
  const summary = $('customerAccountSummary');
  if (!body) return;
  const customers = db._customersCache || [];
  const ordersBy = {};
  db.orders.forEach((order) => {
    if (!order.customerId) return;
    (ordersBy[order.customerId] ||= []).push(order);
  });
  const paidBy = {};
  db.payments.forEach((payment) => {
    paidBy[payment.customerId] = (paidBy[payment.customerId] || 0) + Number(payment.amount || 0);
  });
  const rows = customers.map((customer) => {
    const orders = ordersBy[customer.id] || [];
    const charged = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const paid = paidBy[customer.id] || 0;
    const due = Math.max(0, charged - paid);
    return { customer, charged, paid, due, orders };
  }).sort((a,b) => b.due - a.due || a.customer.name.localeCompare(b.customer.name));
  const totalDue = rows.reduce((s,r)=>s+r.due,0);
  const totalCharged = rows.reduce((s,r)=>s+r.charged,0);
  if (summary) summary.innerHTML = `<b>${money(totalDue)}</b><span>total outstanding</span><small>${money(totalCharged)} total customer sales</small>`;
  body.innerHTML = rows.length ? rows.map(({customer,charged,paid,due,orders}) => `
    <tr>
      <td><b>${escapeHtml(customer.name)}</b><small>${escapeHtml(customer.phone || '')}</small></td>
      <td>${orders.length}</td><td>${money(charged)}</td><td>${money(paid)}</td>
      <td><b class="${due > 0 ? 'due-positive' : 'paid-positive'}">${money(due)}</b></td>
      <td><button class="outline small-btn" data-action="customer-payment" data-id="${escapeHtml(customer.id)}">＋ Payment</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">No customers yet.</td></tr>';
}

async function loadCustomerAccounts() {
  try {
    db._customersCache = await MockAPI.get('customers');
    renderCustomerAccounts();
  } catch (error) { console.error(error); }
}

function openPaymentDialog(customerId) {
  const customer = (db._customersCache || []).find(c => String(c.id) === String(customerId));
  if (!customer) return;
  $('paymentCustomerId').value = customer.id;
  $('paymentCustomerName').textContent = customer.name;
  const orders = db.orders.filter(o => String(o.customerId) === String(customer.id));
  const charged = orders.reduce((s,o)=>s+Number(o.total||0),0);
  const paid = db.payments.filter(p=>String(p.customerId)===String(customer.id)).reduce((s,p)=>s+Number(p.amount||0),0);
  $('paymentOutstanding').textContent = money(Math.max(0, charged-paid));
  $('paymentAmount').value = '';
  $('paymentNote').value = '';
  const d=$('paymentDialog'); if (d.showModal) d.showModal(); else d.setAttribute('open','');
}

function closePaymentDialog(){ const d=$('paymentDialog'); if(d?.open) d.close(); }

async function saveCustomerPayment(){
  const customerId=$('paymentCustomerId').value;
  const amount=Number($('paymentAmount').value);
  const note=$('paymentNote').value.trim();
  if(!customerId || amount<=0){ alert('Enter a valid payment amount.'); return; }
  try{
    await MockAPI.post('payments',{customerId,amount,note});
    closePaymentDialog();
    await refresh();
    await loadCustomerAccounts();
  }catch(error){ alert(error.message || 'Could not record payment.'); }
}

function renderDashboard() {
  renderDailyProfit();
  const lowStock = [...db.products]
    .filter((product) => Number(product.qty) <= Number(product.min))
    .sort((a, b) => Number(a.qty) - Number(b.qty));

  $('lowStockList').innerHTML = lowStock.length
    ? lowStock.map((product) => `
        <article class="list-row">
          <section>
            <b>${escapeHtml(product.name)}</b>
            <small>${escapeHtml(product.brand || '')} · minimum ${product.min}</small>
          </section>
          <span class="low-num">${product.qty} left</span>
        </article>
      `).join('')
    : '<p class="empty">All products are above minimum stock.</p>';

  const recentOrders = [...db.orders]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  $('recentOrders').innerHTML = recentOrders.length
    ? recentOrders.map((order) => `
        <article class="list-row">
          <section>
            <b>${escapeHtml(order.id)}</b>
            <small>${new Date(order.date).toLocaleString()} · ${order.items.length} products</small>
          </section>
          <b>${money(order.total)}</b>
        </article>
      `).join('')
    : '<p class="empty">No orders yet.</p>';
}

function renderProducts() {
  const query = ($('search').value || '').toLowerCase();

  const products = db.products.filter((product) => {
    const text = [product.name, product.brand, product.type, product.variant, product.supplier]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(query);
  });

  $('productRows').innerHTML = products.length
    ? products.map((product) => {
        const status = product.qty === 0
          ? ['out', 'אזל מהמלאי']
          : product.qty <= product.min
            ? ['low', 'מלאי נמוך']
            : ['ok', 'במלאי'];

        return `
          <tr>
            <td class="product-name">
              <b>${escapeHtml(product.name)}</b>
              <small>${escapeHtml(product.brand || '')}</small>
            </td>
            <td>${escapeHtml(product.type || '')}</td>
            <td>${money(product.buy)}</td>
            <td>${money(product.sell)}</td>
            <td><b>${product.qty}</b></td>
            <td>${money(product.qty * product.buy)}</td>
            <td><span class="pill ${status[0]}">${status[1]}</span></td>
            <td>
              <section class="row-actions">
                <button data-action="edit-product" data-id="${product.id}">Edit</button>
                <button class="outline" data-action="delete-product" data-id="${product.id}">Delete</button>
              </section>
            </td>
          </tr>
        `;
      }).join('')
    : '<tr><td colspan="8" class="empty">No products found.</td></tr>';
}

function renderSelect() {
  const available = db.products.filter((product) => Number(product.qty) > 0);

  $('orderProduct').innerHTML = available.length
    ? available.map((product) => `
        <option value="${product.id}">
          ${escapeHtml(product.name)} — ${product.qty} available — ${money(product.sell)}
        </option>
      `).join('')
    : '<option value="">No stock available</option>';
}

function calculateCart() {
  const subtotal = cart.reduce(
    (total, item) => total + Number(item.qty) * Number(item.sell),
    0,
  );

  const cost = cart.reduce(
    (total, item) => total + Number(item.qty) * Number(item.buy),
    0,
  );

  const discount = Math.max(0, Number($('discount').value || 0));
  const total = Math.max(0, subtotal - discount);

  return { subtotal, cost, discount, total, profit: total - cost };
}

function renderCart() {
  const totals = calculateCart();

  $('cart').innerHTML = cart.length
    ? cart.map((item, index) => `
        <article class="cartitem">
          <section>
            <b>${escapeHtml(item.name)}</b>
            <small>${item.qty} × ${money(item.sell)}</small>
          </section>
          <b class="price">${money(item.qty * item.sell)}</b>
          <button class="icon-btn" data-action="remove-cart" data-index="${index}">×</button>
        </article>
      `).join('')
    : '<p class="empty">No products in this order.</p>';

  $('subtotal').textContent = money(totals.subtotal);
  $('total').textContent = money(totals.total);
  $('orderCost').textContent = money(totals.cost);
  $('profit').textContent = money(totals.profit);
}

function renderHistory() {
  const query = ($('orderSearch').value || '').toLowerCase();

  const orders = [...db.orders]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((order) => order.id.toLowerCase().includes(query));

  $('orderRows').innerHTML = orders.length
    ? orders.map((order) => `
        <tr>
          <td><b>${escapeHtml(order.id)}</b></td>
          <td>${new Date(order.date).toLocaleString()}</td>
          <td>${order.items.reduce((total, item) => total + item.qty, 0)}</td>
          <td>${money(order.sub)}</td>
          <td>${money(order.discount)}</td>
          <td><b>${money(order.total)}</b></td>
          <td class="profit-row"><b>${money(order.profit)}</b></td>
          <td>
            <button data-action="view-receipt" data-id="${escapeHtml(order.id)}">Receipt</button>
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="8" class="empty">No orders found.</td></tr>';
}

function renderReports() {
  const sales = db.orders.reduce((total, order) => total + Number(order.total || 0), 0);
  const profit = db.orders.reduce((total, order) => total + Number(order.profit || 0), 0);

  $('rSales').textContent = money(sales);
  $('rProfit').textContent = money(profit);
  $('rOrders').textContent = db.orders.length;
  $('rAvg').textContent = money(db.orders.length ? sales / db.orders.length : 0);

  const soldByProduct = {};

  db.orders.forEach((order) => {
    order.items.forEach((item) => {
      soldByProduct[item.name] = (soldByProduct[item.name] || 0) + Number(item.qty || 0);
    });
  });

  const bestSellers = Object.entries(soldByProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  $('bestSellers').innerHTML = bestSellers.length
    ? bestSellers.map(([name, quantity], index) => `
        <article class="list-row">
          <section><b>#${index + 1} ${escapeHtml(name)}</b></section>
          <b>${quantity} units</b>
        </article>
      `).join('')
    : '<p class="empty">Complete orders to see best sellers.</p>';
}

function renderMovements() {
  const movements = db.stockMovements.slice(0, 100);

  $('movementRows').innerHTML = movements.length
    ? movements.map((movement) => `
        <tr>
          <td>${new Date(movement.date).toLocaleString()}</td>
          <td><b>${escapeHtml(movement.productName)}</b></td>
          <td><b>${movement.change > 0 ? '+' : ''}${movement.change}</b></td>
          <td>${escapeHtml(movement.reason)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="empty">No stock movements yet.</td></tr>';
}

function receiptHtml(receipt) {
  return `
    <article>
      <h2>CIGARETTE SHOP</h2>
      <p class="muted">Admin receipt</p>
      <p class="muted">${escapeHtml(receipt.id)} · ${new Date(receipt.date).toLocaleString()}</p>

      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${receipt.items.map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${item.qty}</td>
              <td>${money(item.qty * item.sell)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <section class="receipt-total">
        <p>Subtotal: <b>${money(receipt.sub)}</b></p>
        <p>Discount: <b>${money(receipt.discount)}</b></p>
        <p>Total: <b>${money(receipt.total)}</b></p>
        <p>Cost: <b>${money(receipt.cost)}</b></p>
        <p class="profit-row">Profit: <b>${money(receipt.profit)}</b></p>
      </section>

      <p class="muted">Thank you</p>
    </article>
  `;
}

function renderReceipt() {
  $('receiptBox').innerHTML = db.lastReceipt
    ? receiptHtml(db.lastReceipt)
    : '<p class="empty">No receipt yet.</p>';
}

function resetProductForm() {
  $('productForm').reset();
  $('pId').value = '';
  $('pMin').value = 5;
}

function openProductDialog(product = null) {
  resetProductForm();

  if (product) {
    $('pId').value = product.id;
    $('pName').value = product.name;
    $('pBrand').value = product.brand || '';
    $('pType').value = product.type || '';
    $('pVariant').value = product.variant || '';
    $('pSupplier').value = product.supplier || '';
    $('pBuy').value = product.buy;
    $('pSell').value = product.sell;
    $('pQty').value = product.qty;
    $('pMin').value = product.min;
  }

  $('productDialog').showModal();
}

function closeProductDialog() {
  $('productDialog').close();
}

async function saveProduct(event) {
  event.preventDefault();

  const id = Number($('pId').value);
  const product = {
    id: id || '',
    name: $('pName').value.trim(),
    brand: $('pBrand').value.trim(),
    type: $('pType').value,
    variant: $('pVariant').value.trim(),
    supplier: $('pSupplier').value.trim(),
    buy: Number($('pBuy').value),
    sell: Number($('pSell').value),
    qty: Number($('pQty').value),
    min: Number($('pMin').value),
  };

  if (!product.name || !Number.isFinite(product.buy) || !Number.isFinite(product.sell)) {
    alert('Please complete the required product fields.');
    return;
  }

  if (hasDuplicateProduct(db, product, id)) {
    alert('This product already exists. Use Add Stock instead of creating a duplicate.');
    return;
  }

  if (id) {
    await MockAPI.put('products', id, product);
  } else {
    // Save the entered quantity exactly once. The previous version saved qty
    // on the product and then added the same qty again via stock movement.
    const initialQty = product.qty;
    const created = await MockAPI.post('products', { ...product, qty: 0 });
    if (initialQty > 0) {
      await MockAPI.patchProductStock(created.id, initialQty, 'Initial stock');
    }
  }

  closeProductDialog();
  await refresh();
}

async function deleteProduct(id) {
  const product = db.products.find((item) => String(item.id) === String(id));
  if (!product) return;

  if (!confirm(`Delete ${product.name}?`)) return;

  await MockAPI.delete('products', id);
  cart = cart.filter((item) => item.id !== id);
  await refresh();
}

function addToCart() {
  const product = db.products.find(
    (item) => String(item.id) === String($('orderProduct').value),
  );

  const quantity = Number($('orderQty').value);
  const existing = cart.find((item) => item.id === product?.id);
  const alreadyInCart = existing?.qty || 0;

  if (!product || quantity < 1 || alreadyInCart + quantity > product.qty) {
    alert('Not enough stock.');
    return;
  }

  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({ ...product, qty: quantity });
  }

  renderCart();
}

function clearCart() {
  cart = [];
  $('discount').value = 0;
  renderCart();
}

async function completeOrder() {
  if (!cart.length) {
    alert('הוסף מוצרים תחילה.');
    return;
  }

  const totals = calculateCart();

  if (totals.discount > totals.subtotal) {
    alert('Discount cannot exceed subtotal.');
    return;
  }

  for (const item of cart) {
    const product = db.products.find((entry) => entry.id === item.id);

    if (!product || product.qty < item.qty) {
      alert('המלאי השתנה. בדוק את ההזמנה מחדש.');
      return;
    }
  }

  const selectedCustomer = window.getSelectedCustomer ? window.getSelectedCustomer() : null;

  const order = {
    id: `R${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString(),
    customerId: selectedCustomer?.id || "",
    customerName: selectedCustomer?.name || "Walk-in / No customer",
    items: cart.map((item) => ({
      productId: item.id,
      name: item.name,
      qty: item.qty,
      buy: item.buy,
      sell: item.sell,
    })),
    sub: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    cost: totals.cost,
    profit: totals.profit,
  };

  try {
    const orderNumber = await MockAPI.completeOrder(order);
    cart = [];
    $('discount').value = 0;

    await refresh();
    const savedOrder = db.orders.find((entry) => String(entry.id) === String(orderNumber));
    if (savedOrder) db.lastReceipt = savedOrder;
    go('receipt');
    setTimeout(() => window.print(), 250);
  } catch (error) {
    alert(error.message || 'Could not complete order.');
  }
}

function viewReceipt(id) {
  const order = db.orders.find((item) => item.id === id);

  if (!order) return;

  db.lastReceipt = order;
  go('receipt');
}

async function loadDemoData() {
  if (!confirm('Load demo products? This only works when inventory is empty.')) return;

  const loaded = await MockAPI.seedDemo();

  if (!loaded) {
    alert('Demo data already exists.');
    return;
  }

  await refresh();
}

function handleClick(event) {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    go(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;

  const { action, id, index } = actionButton.dataset;

  if (action === 'customer-payment') { openPaymentDialog(id); return; }

  if (action === 'edit-product') {
    const product = db.products.find((item) => String(item.id) === String(id));
    if (product) openProductDialog(product);
  }

  if (action === 'delete-product') {
    deleteProduct(id);
  }

  if (action === 'remove-cart') {
    cart.splice(Number(index), 1);
    renderCart();
  }

  if (action === 'view-receipt') {
    viewReceipt(id);
  }
}

function init() {
  document.addEventListener('click', handleClick);

  $('loginBtn').addEventListener('click', login);
  $('pass').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') login();
  });

  $('logout').addEventListener('click', async () => {
    await MockAPI.logout();
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  $('search').addEventListener('input', renderProducts);
  $('orderSearch').addEventListener('input', renderHistory);
  $('paymentForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveCustomerPayment(); });
  $('cancelPayment')?.addEventListener('click', closePaymentDialog);
  $('cancelPaymentX')?.addEventListener('click', closePaymentDialog);
  $('paymentDialog')?.addEventListener('click', (e) => { if (e.target.id === 'paymentDialog') closePaymentDialog(); });
  $('sideNav')?.addEventListener('click', () => { if ($('accounts') && !$('accounts').hidden) loadCustomerAccounts(); });
  $('discount').addEventListener('input', renderCart);

  $('addProduct').addEventListener('click', () => openProductDialog());
  $('cancelProduct').addEventListener('click', closeProductDialog);
  $('cancelProduct2').addEventListener('click', closeProductDialog);
  $('productForm').addEventListener('submit', saveProduct);

  $('addToCart').addEventListener('click', addToCart);
  $('clearCart').addEventListener('click', clearCart);
  $('completeOrder').addEventListener('click', completeOrder);
  $('printLast').addEventListener('click', () => window.print());
  $('loadDemo').addEventListener('click', loadDemoData);
  $('backupExport')?.addEventListener('click', exportBackup);
  $('backupImport')?.addEventListener('click', () => $('backupFile')?.click());
  $('backupFile')?.addEventListener('change', importBackup);

  if (window.supabaseClient?.auth) {
    window.supabaseClient.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        sessionStorage.setItem(AUTH_KEY, '1');
        await showApp();
      } else {
        sessionStorage.removeItem(AUTH_KEY);
      }
    }).catch(() => {});
  }
}

// Backup & Restore — saves the app's local data into a portable JSON file.
function getBackupData() {
  const keys = ['cigarette_mock_api_v2', 'cig_admin_v1', 'cigarette_shop_language'];
  const data = {};
  keys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try { data[key] = JSON.parse(value); } catch { data[key] = value; }
    }
  });
  return data;
}

function exportBackup() {
  try {
    const payload = {
      app: 'Tobacco & Cigarette Shop Manager',
      version: 2,
      createdAt: new Date().toISOString(),
      data: getBackupData()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TobaccoShop_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message || 'Could not create backup.');
  }
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || payload.app !== 'Tobacco & Cigarette Shop Manager' || !payload.data) {
      throw new Error('Invalid backup file.');
    }
    const allowedKeys = ['cigarette_mock_api_v2', 'cig_admin_v1', 'cigarette_shop_language'];
    const hasData = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(payload.data, key));
    if (!hasData) throw new Error('Backup contains no app data.');
    if (!confirm('Restore this backup? Current app data will be replaced.')) return;
    allowedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(payload.data, key)) {
        const value = payload.data[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    alert('Backup restored successfully.');
    location.reload();
  } catch (error) {
    alert(error.message || 'Could not restore backup.');
  }
}


init();


// Prevent duplicate products: the same product name + variant is stored only once.
function hasDuplicateProduct(data, candidate, currentId = "") {
  const name = String(candidate.name || "").trim().toLowerCase();
  const variant = String(candidate.variant || "").trim().toLowerCase();
  return data.products.some((product) =>
    product.id !== currentId &&
    String(product.name || "").trim().toLowerCase() === name &&
    String(product.variant || "").trim().toLowerCase() === variant
  );
}



/* Language module — full English / Hebrew UI translation */
(function () {
  const pairs = [
    ['ניהול חנות טבק וסיגריות','Tobacco & Cigarette Shop Manager'],
    ['חנות סיגריות','Cigarette Shop'], ['מערכת ניהול למנהל','Admin management system'],
    ['שם משתמש','Username'], ['סיסמה','Password'], ['כניסה','Login'], ['התנתקות','Logout'],
    ['דוגמה:','Demo:'], ['מנהל','Admin'], ['לוח ניהול','Admin Panel'], ['לוח בקרה','Dashboard'],
    ['מלאי / מחסן','Storage / Inventory'], ['מלאי','Storage'], ['הזמנה חדשה','New Order'],
    ['היסטוריית הזמנות','Order History'], ['דוחות','Reports'], ['תנועות מלאי','Stock Movements'], ['קבלה','Receipt'],
    ['טען נתוני דוגמה','Load Demo Data'], ['צפה במלאי →','View Inventory →'], ['צפה בהכול →','View All →'],
    ['סה״כ מוצרים','Total Products'], ['סה״כ מלאי','Total Stock'], ['עלות המלאי','Inventory Cost'],
    ['מכירות היום','Today\'s Sales'], ['מוצרים פעילים','Active products'], ['יחידות במלאי','Units in stock'],
    ['שווי רכישה','Purchase value'], ['מלאי נמוך','Low Stock'], ['דורש טיפול','Needs attention'],
    ['לאחר הנחות','After discounts'], ['מוצרים שהמלאי שלהם ברמה המינימלית או מתחתיה','Products at or below minimum stock'],
    ['הזמנות אחרונות','Recent Orders'], ['המכירות האחרונות שהושלמו','Recently completed sales'],
    ['ניהול מוצרים, כמויות ומחירים.','Manage products, quantities, and prices.'],
    ['חיפוש לפי מוצר או מותג…','Search by product or brand…'], ['＋ הוסף מוצר','＋ Add Product'],
    ['מוצר','Product'], ['מותג','Brand'], ['סוג','Type'], ['גרסה','Variant'], ['ספק','Supplier'],
    ['עלות רכישה','Purchase Cost'], ['מחיר קנייה','Purchase Cost'], ['מחיר מכירה','Selling Price'],
    ['כמות','Quantity'], ['מלאי מינימלי','Minimum Stock'], ['שווי מלאי','Inventory Value'], ['סטטוס','Status'], ['פעולות','Actions'],
    ['הזמנה','Order'], ['תאריך','Date'], ['פריטים','Items'], ['סכום ביניים','Subtotal'], ['הנחה','Discount'],
    ['סה״כ','Total'], ['עלות','Cost'], ['רווח','Profit'], ['הוסף להזמנה','Add to Order'], ['נקה הזמנה','Clear Order'],
    ['סיכום הזמנה','Order Summary'], ['השלם הזמנה והדפס קבלה','Complete Order & Print Receipt'],
    ['חיפוש לפי מספר הזמנה…','Search by order number…'], ['הזמנות שהושלמו והרווח שחושב.','Completed orders and calculated profit.'],
    ['סקירת מכירות ורווחים.','Sales and profit overview.'], ['סה״כ מכירות','Total Sales'], ['הזמנות','Orders'],
    ['ממוצע להזמנה','Average Order'], ['המוצרים הנמכרים ביותר','Best-Selling Products'], ['יחידות שנמכרו בהזמנות שהושלמו','Units sold in completed orders'],
    ['כל שינוי במלאי שנרשם במערכת.','Every inventory change recorded in the system.'], ['Change','Change'], ['Reason','Reason'],
    ['הדפסת ההזמנה האחרונה שהושלמה.','Print the latest completed order.'], ['הדפס קבלה','Print Receipt'],
    ['שפה','Language'], ['עברית','Hebrew'], ['אנגלית','English'],
    ['לקוח להזמנה','Order Customer'], ['למי מיועדת ההזמנה?','Who is this order for?'], ['בחר לקוח קיים או צור לקוח חדש.','Choose an existing customer or create a new one.'],
    ['＋ הוסף לקוח','＋ Add Customer'], ['לקוח','Customer'], ['לקוח מזדמן / ללא לקוח','Walk-in / No customer'], ['לא נבחר לקוח.','No customer selected.'],
    ['הוספת לקוח','Add Customer'], ['הזן את פרטי הלקוח.','Enter customer details.'], ['שם הלקוח','Customer Name'], ['מספר טלפון','Phone Number'],
    ['הערות','Notes'], ['הערות אופציונליות על הלקוח...','Optional notes about the customer...'], ['ביטול','Cancel'], ['שמירת לקוח','Save Customer'],
    ['הוספה או עריכה של מוצר במלאי.','Add or edit a product in inventory.'], ['שם המוצר','Product Name'], ['בחר סוג','Select type'],
    ['שמירת מוצר','Save Product'], ['בחר מותג','Select brand'], ['בחר מותג first','Select a brand first'], ['הוספת מלאי','Add Stock'],
    ['ניהול מוצרים, עלויות, מחירים, מלאי והתראות על מלאי נמוך.','Manage products, costs, prices, stock, and low-stock alerts.'],
    ['לאחר הנחות','After discounts'], ['אזל מהמלאי','Out of stock'], ['תקין','In stock'], ['מלאי נמוך','Low stock'],
    ['הוסף מוצרים תחילה.','Add products first.'], ['המלאי השתנה. בדוק את ההזמנה מחדש.','Inventory changed. Please review the order again.'],
    ['מלאי התחלתי','Initial stock'], ['שמור','Save'], ['חיפוש מוצרים...','Search products...'], ['Search products...','Search products...'],
    ['לקוחות','Customers'], ['ספקים','Suppliers'], ['הגדרות','Settings']
  ];

  const heToEn = new Map(pairs);
  const enToHe = new Map(pairs.map(([he,en]) => [en,he]));
  const sorted = (map) => [...map.entries()].sort((a,b)=>b[0].length-a[0].length);

  function replacePhrases(text, map) {
    let out = text;
    for (const [from,to] of sorted(map)) out = out.split(from).join(to);
    return out;
  }

  function translateDom(lang) {
    const map = lang === 'he' ? enToHe : heToEn;
    document.title = lang === 'he' ? 'ניהול חנות טבק וסיגריות' : 'Tobacco & Cigarette Shop Manager';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if (!n.nodeValue.trim()) return;
      n.nodeValue = replacePhrases(n.nodeValue, map);
    });
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.placeholder) el.placeholder = replacePhrases(el.placeholder, map);
      if (el.getAttribute('aria-label')) el.setAttribute('aria-label', replacePhrases(el.getAttribute('aria-label'), map));
    });
    document.querySelectorAll('option').forEach(o => { o.textContent = replacePhrases(o.textContent, map); });
    const sel=document.getElementById('language-select'); if(sel) sel.value=lang;
    localStorage.setItem('cigarette_shop_language', lang);
    window.currentLanguage=lang;
  }

  function applyLanguage(lang) {
    const safe = lang === 'he' ? 'he' : 'en';
    translateDom(safe);
    // Re-apply after render functions create dynamic nodes.
    setTimeout(() => translateDom(safe), 0);
  }
  document.addEventListener('change', e => { if(e.target && e.target.id==='language-select') applyLanguage(e.target.value); });
  window.applyLanguage = applyLanguage;
  applyLanguage(localStorage.getItem('cigarette_shop_language') || 'he');
})();

/* Brand selector — filters the product-name suggestions by brand. */
(function () {
  const brandProducts = {
    Marlboro: ["Marlboro Red","Marlboro Gold","Marlboro Touch","Marlboro Silver Blue","Marlboro Ice Blast","Marlboro Crafted"],
    Winston: ["Winston Red","Winston Blue","Winston Silver","Winston XS"],
    Camel: ["Camel Yellow","Camel Blue","Camel Silver"],
    Kent: ["Kent Blue","Kent Silver","Kent White"],
    "L&M": ["L&M Red","L&M Blue","L&M Silver","L&M Forward"],
    Parliament: ["Parliament Aqua Blue","Parliament Night Blue","Parliament Silver Blue"],
    Rothmans: ["Rothmans Red","Rothmans Blue","Rothmans Silver"],
    Davidoff: ["Davidoff Classic","Davidoff Gold","Davidoff Silver","Davidoff Reach"],
    "Pall Mall": ["Pall Mall Red","Pall Mall Blue","Pall Mall Silver"],
    "Lucky Strike": ["Lucky Strike Red","Lucky Strike Blue","Lucky Strike Silver"],
    Chesterfield: ["Chesterfield Red","Chesterfield Blue","Chesterfield Silver"],
    Vogue: ["Vogue Classic","Vogue Menthe","Vogue Blue"],
    West: ["West Red","West Blue","West Silver"],
    "Bond Street": ["Bond Street Red","Bond Street Blue"],
    LD: ["LD Red","LD Blue"],
    Gauloises: ["Gauloises Red","Gauloises Blue"],
    Sobranie: ["Sobranie Black","Sobranie Gold"],
    Mevius: ["Mevius Original","Mevius Sky Blue"],
    Esse: ["Esse Classic","Esse Blue","Esse Menthol"]
  };

  const brand = document.getElementById("product-brand");
  const name = document.getElementById("product-name");
  const list = document.getElementById("cigarette-names");

  function filterProducts() {
    if (!brand || !name || !list) return;
    const selected = brand.value;
    const products = brandProducts[selected] || [];
    list.innerHTML = products.map((product) => `<option value="${product}"></option>`).join("");
    if (selected && name.value && !products.includes(name.value)) name.value = "";
  }

  brand?.addEventListener("change", filterProducts);
  window.filterProductsByBrand = filterProducts;
  filterProducts();
})();

/* Product selector — Brand -> Product Name */
(function () {
  const productsByBrand = {
    Marlboro:["Marlboro Red","Marlboro Gold","Marlboro Touch","Marlboro Silver Blue","Marlboro Ice Blast","Marlboro Crafted"],
    Winston:["Winston Red","Winston Blue","Winston Silver","Winston XS"],
    Camel:["Camel Yellow","Camel Blue","Camel Silver"],
    Kent:["Kent Blue","Kent Silver","Kent White"],
    "L&M":["L&M Red","L&M Blue","L&M Silver","L&M Forward"],
    Parliament:["Parliament Aqua Blue","Parliament Night Blue","Parliament Silver Blue"],
    Rothmans:["Rothmans Red","Rothmans Blue","Rothmans Silver"],
    Davidoff:["Davidoff Classic","Davidoff Gold","Davidoff Silver","Davidoff Reach"],
    "Pall Mall":["Pall Mall Red","Pall Mall Blue","Pall Mall Silver"],
    "Lucky Strike":["Lucky Strike Red","Lucky Strike Blue","Lucky Strike Silver"],
    Chesterfield:["Chesterfield Red","Chesterfield Blue","Chesterfield Silver"],
    Vogue:["Vogue Classic","Vogue Menthe","Vogue Blue"],
    West:["West Red","West Blue","West Silver"],
    "Bond Street":["Bond Street Red","Bond Street Blue"],
    LD:["LD Red","LD Blue"],
    Gauloises:["Gauloises Red","Gauloises Blue"],
    Sobranie:["Sobranie Black","Sobranie Gold"],
    Mevius:["Mevius Original","Mevius Sky Blue"],
    Esse:["Esse Classic","Esse Blue","Esse Menthol"],
    Other:["Other"]
  };
  const brand=document.getElementById("product-brand");
  const name=document.getElementById("product-name");
  function updateProductNames(selectedName="") {
    if (!brand || !name) return;
    const list=productsByBrand[brand.value] || [];
    name.innerHTML='<option value="">Select product</option>'+list.map(v=>`<option value="${v}">${v}</option>`).join("");
    name.disabled=list.length===0;
    if (selectedName && list.includes(selectedName)) name.value=selectedName;
  }
  brand?.addEventListener("change",()=>updateProductNames());
  window.setProductBrandAndName=(b,n)=>{ if(brand){brand.value=b;updateProductNames(n);} };
  updateProductNames();
})();



/* Customers + New Order customer selector — stored in Supabase. */
(function () {
  const $ = (id) => document.getElementById(id);

  async function renderCustomers() {
    const select = $('order-customer');
    if (!select) return;
    try {
      const customers = await MockAPI.get('customers');
      const current = select.value;
      select.innerHTML = '<option value="">Walk-in / No customer</option>' +
        customers.map((customer) =>
          `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.phone ? ` — ${escapeHtml(customer.phone)}` : ''}</option>`
        ).join('');
      if (customers.some((customer) => String(customer.id) === String(current))) select.value = current;
      showCustomerInfo();
    } catch (error) {
      console.error('Could not load customers:', error);
    }
  }

  async function getSelectedCustomer() {
    const id = $('order-customer')?.value || '';
    if (!id) return null;
    try {
      const customers = await MockAPI.get('customers');
      return customers.find((customer) => String(customer.id) === String(id)) || null;
    } catch {
      return null;
    }
  }

  function showCustomerInfo() {
    const info = $('selected-customer-info');
    if (!info) return;
    const id = $('order-customer')?.value || '';
    if (!id) {
      info.innerHTML = '<span class="customer-dot"></span><span>No customer selected — this will be a walk-in order.</span>';
      return;
    }
    const option = $('order-customer')?.selectedOptions?.[0];
    info.innerHTML = `<span class="customer-dot"></span><section><b>${escapeHtml(option?.textContent?.split(' — ')[0] || '')}</b></section>`;
  }

  function openCustomerDialog() {
    const dialog = $('customerDialog');
    if (!dialog) return;
    $('customerForm')?.reset();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(() => $('customer-name')?.focus(), 50);
  }

  function closeCustomerDialog() {
    const dialog = $('customerDialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  async function addCustomer(event) {
    event?.preventDefault();
    const nameInput = $('customer-name');
    const name = nameInput?.value.trim() || '';
    if (!name) {
      nameInput?.focus();
      return;
    }

    try {
      const customer = await MockAPI.post('customers', {
        name,
        phone: $('customer-phone')?.value.trim() || '',
        notes: $('customer-notes')?.value.trim() || ''
      });
      closeCustomerDialog();
      await renderCustomers();
      $('order-customer').value = customer.id;
      showCustomerInfo();
    } catch (error) {
      alert(error.message || 'Could not save customer.');
    }
  }

  $('order-customer')?.addEventListener('change', showCustomerInfo);
  $('add-customer-from-order')?.addEventListener('click', openCustomerDialog);
  $('customerForm')?.addEventListener('submit', addCustomer);
  $('cancelCustomer')?.addEventListener('click', closeCustomerDialog);
  $('cancelCustomerX')?.addEventListener('click', closeCustomerDialog);
  $('customerDialog')?.addEventListener('click', (event) => {
    if (event.target === $('customerDialog')) closeCustomerDialog();
  });

  window.getSelectedCustomerId = () => $('order-customer')?.value || '';
  window.getSelectedCustomer = () => {
    const id = $('order-customer')?.value || '';
    if (!id) return null;
    const option = $('order-customer')?.selectedOptions?.[0];
    return { id, name: option?.textContent?.split(' — ')[0] || 'Walk-in / No customer' };
  };
  window.renderOrderCustomers = renderCustomers;
  renderCustomers();
})();


/* Full bilingual UI — translates the entire visible interface between Hebrew and English. */
(function () {
  const HE_EN = {
    'חנות סיגריות': 'Cigarette Shop', 'לוח ניהול': 'Admin Dashboard', 'מערכת ניהול למנהל': 'Admin management system',
    'שם משתמש': 'Username', 'סיסמה': 'Password', 'כניסה': 'Login', 'דוגמה:': 'Demo:',
    'לוח בקרה': 'Dashboard', 'מלאי': 'Inventory', 'מלאי / מחסן': 'Storage / Inventory', 'הזמנה חדשה': 'New Order',
    'היסטוריית הזמנות': 'Order History', 'דוחות': 'Reports', 'תנועות מלאי': 'Stock Movements', 'קבלה': 'Receipt',
    'טען נתוני דוגמה': 'Load Demo Data', 'התנתקות': 'Logout', 'מנהל /': 'Admin /', 'Mock API': 'Mock API', 'שפה': 'Language',
    'סה״כ מוצרים': 'Total Products', 'מוצרים פעילים': 'Active products', 'סה״כ מלאי': 'Total Stock', 'יחידות במלאי': 'Units in stock',
    'עלות המלאי': 'Inventory Cost', 'שווי רכישה': 'Purchase value', 'מכירות היום': "Today's Sales", "Today's profit": "Today's Profit",
    'לאחר הנחות': 'After discounts', 'מלאי נמוך': 'Low Stock', 'דורש טיפול': 'Needs attention', 'מלאי נמוך': 'Low Stock',
    'מוצרים שהמלאי שלהם ברמה המינימלית או מתחתיה': 'Products at or below minimum stock', 'צפה במלאי →': 'View Inventory →',
    'הזמנות אחרונות': 'Recent Orders', 'המכירות האחרונות שהושלמו': 'Latest completed sales', 'צפה בהכול →': 'View All →',
    'מלאי / מחסן': 'Storage / Inventory', 'ניהול מוצרים, כמויות ומחירים.': 'Manage products, quantities and prices.',
    'ניהול מוצרים, עלויות, מחירים, מלאי והתראות על מלאי נמוך.': 'Manage products, costs, prices, stock and low-stock alerts.',
    '＋ הוסף מוצר': '＋ Add Product', '+ הוספת מלאי': '+ Add Stock', 'הוסף להזמנה': 'Add to Order', 'נקה הזמנה': 'Clear Order',
    'יצירת מכירה והפחתת המלאי באופן אוטומטי.': 'Create a sale and automatically reduce stock.', 'סיכום הזמנה': 'Order Summary',
    'סכום ביניים': 'Subtotal', 'הנחה': 'Discount', 'סה״כ': 'Total', 'עלות': 'Cost', 'רווח': 'Profit',
    'השלם הזמנה והדפס קבלה': 'Complete Order & Print Receipt', 'הזמנות שהושלמו והרווח שחושב.': 'Completed orders and calculated profit.',
    'חיפוש לפי מספר הזמנה…': 'Search by order number…', 'חיפוש לפי מוצר או מותג…': 'Search by product or brand…',
    'סקירת מכירות ורווחים.': 'Sales and profit overview.', 'סה״כ מכירות': 'Total Sales', 'סה״כ רווח': 'Total Profit',
    'הזמנות': 'Orders', 'ממוצע להזמנה': 'Average per Order', 'המוצרים הנמכרים ביותר': 'Best Selling Products',
    'יחידות שנמכרו בהזמנות שהושלמו': 'Units sold in completed orders', 'כל שינוי במלאי שנרשם במערכת.': 'Every stock change recorded in the system.',
    'הדפס קבלה': 'Print Receipt', 'הדפסת ההזמנה האחרונה שהושלמה.': 'Print the last completed order.',
    'מוצר': 'Product', 'שם המוצר': 'Product Name', 'מותג': 'Brand', 'סוג': 'Type', 'גרסה': 'Variant',
    'מחיר קנייה': 'Purchase Cost', 'מחיר מכירה': 'Selling Price', 'כמות': 'Quantity', 'מלאי מינימלי': 'Minimum Stock',
    'ספק': 'Supplier', 'פעולות': 'Actions', 'סטטוס': 'Status', 'שווי מלאי': 'Inventory Value', 'תאריך': 'Date', 'פריטים': 'Items',
    'הוסף מוצר': 'Add Product', 'שמירת מוצר': 'Save Product', 'שמירת לקוח': 'Save Customer', 'ביטול': 'Cancel',
    'הוספה או עריכה של מוצר במלאי.': 'Add or edit a product in inventory.', 'בחר סוג': 'Select type', 'בחר מותג': 'Select brand',
    'בחר מותג first': 'Select a brand first', 'שם הלקוח': 'Customer Name', 'שם הלקוח ': 'Customer Name ', 'מספר טלפון': 'Phone Number',
    'הערות': 'Notes', 'הערות אופציונליות על הלקוח...': 'Optional notes about the customer...', 'הוספת לקוח': 'Add Customer',
    'לקוח': 'Customer', 'לקוח להזמנה': 'Customer for Order', 'למי מיועדת ההזמנה?': 'Who is this order for?',
    'בחר לקוח קיים או צור לקוח חדש.': 'Select an existing customer or create a new one.', 'לקוח מזדמן / ללא לקוח': 'Walk-in / No customer',
    'לא נבחר לקוח.': 'No customer selected.', 'הזן את פרטי הלקוח.': 'Enter customer details.',
    'מוצרי סיגריות': 'Cigarette products', 'אזל מהמלאי': 'Out of stock', 'במלאי': 'In stock', 'תקין': 'OK',
    'הוסף מוצרים תחילה.': 'Add products first.', 'המלאי השתנה. בדוק את ההזמנה מחדש.': 'Stock changed. Please review the order again.',
    'שם המשתמש או הסיסמה שגויים.': 'Incorrect username or password.', 'חיפוש מוצרים...': 'Search products...',
    'לאחר הנחות': 'After discounts', 'מוצר': 'Product', 'Brand': 'Brand',
    'הגדרות': 'Settings', 'לקוחות': 'Customers', 'ספקים': 'Suppliers', 'הוספת מלאי': 'Add Stock', '+ הוספת מלאי': '+ Add Stock',
    'מלאי התחלתי': 'Initial Stock', 'מוצרי סיגריות': 'Cigarette products', 'אזל מהמלאי': 'Out of stock', 'במלאי': 'In stock',
    'תקין': 'OK', 'שמירה': 'Save', 'שם המשתמש או הסיסמה שגויים.': 'Incorrect username or password.',
    'הוסף מוצרים תחילה.': 'Add products first.', 'המלאי השתנה. בדוק את ההזמנה מחדש.': 'Stock changed. Please review the order again.',
    'הערות ': 'Notes ', 'גרסה ': 'Variant ', 'מחיר מכירה ': 'Selling Price ', 'עלות רכישה ': 'Purchase Cost ', 'מלאי מינימלי ': 'Minimum Stock ',
    'ספק name': 'Supplier name', 'בחר מותג first': 'Select a brand first', 'שם המשתמש': 'Username',
    'מנהל /': 'Admin /', 'תאריך': 'Date', 'פריטים': 'Items', 'הזמנה': 'Order', 'הזמנות': 'Orders',
 'Type': 'Type', 'Cost': 'Cost', 'Price': 'Price',
    'Qty': 'Qty', 'Change': 'Change', 'Reason': 'Reason', 'Subtotal': 'Subtotal', 'Total': 'Total', 'Profit': 'Profit',
    'Quantity': 'Quantity', 'Accessories': 'Accessories', 'Cigarettes': 'Cigarettes', 'Tobacco': 'Tobacco', 'Cigars': 'Cigars',
    'Rolling Tobacco': 'Rolling Tobacco', 'Shisha / Molasses': 'Shisha / Molasses', 'Hookah / Argileh': 'Hookah / Argileh', 'Other': 'Other',
    'Argileh / Hookah': 'Argileh / Hookah', 'No orders yet.': 'No orders yet.', 'All products are above minimum stock.': 'All products are above minimum stock.',
    'No products found.': 'No products found.', 'products': 'products', 'left': 'left', 'orders': 'orders'
  };
  const EN_HE = Object.fromEntries(Object.entries(HE_EN).map(([he, en]) => [en, he]));

  function translateValue(value, lang) {
    if (!value) return value;
    const map = lang === 'en' ? HE_EN : EN_HE;
    let out = value;
    if (map[out] !== undefined) return map[out];
    // Handle common Hebrew UI strings with embedded punctuation/whitespace.
    if (lang === 'en') {
      const replacements = [
        ['שם הלקוח', 'Customer Name'], ['מספר טלפון', 'Phone Number'], ['הערות', 'Notes'], ['גרסה', 'Variant'],
        ['מחיר מכירה', 'Selling Price'], ['עלות רכישה', 'Purchase Cost'], ['מלאי מינימלי', 'Minimum Stock'], ['ספק', 'Supplier'],
        ['שם המוצר', 'Product Name'], ['מותג', 'Brand'], ['סוג', 'Type'], ['כמות', 'Quantity'], ['סטטוס', 'Status'],
        ['פעולות', 'Actions'], ['עלות', 'Cost'], ['רווח', 'Profit'], ['סה״כ', 'Total'], ['הנחה', 'Discount']
      ];
      for (const [he, en] of replacements) if (out.includes(he)) out = out.split(he).join(en);
    }
    // Common dynamic counters.
    if (lang === 'en') {
      out = out.replace(/^(\d+) הזמנות$/, '$1 orders').replace(/^(\d+) מוצרים$/, '$1 products').replace(/^(.+) נשארו$/, '$1 left');
    } else {
      out = out.replace(/^(\d+) orders$/, '$1 הזמנות').replace(/^(\d+) products$/, '$1 מוצרים').replace(/^(.+) left$/, '$1 נשארו');
    }
    return out;
  }

  function translateAll(lang) {
    const safe = lang === 'he' ? 'he' : 'en';
    document.documentElement.lang = safe;
    document.documentElement.dir = safe === 'he' ? 'rtl' : 'ltr';
    localStorage.setItem('cigarette_shop_language', safe);
    document.title = safe === 'he' ? 'ניהול חנות טבק וסיגריות' : 'Tobacco & Cigarette Shop Admin';
    document.querySelectorAll('[placeholder]').forEach((el) => { el.placeholder = translateValue(el.placeholder, safe); });
    document.querySelectorAll('[aria-label]').forEach((el) => { el.setAttribute('aria-label', translateValue(el.getAttribute('aria-label'), safe)); });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement && ['SCRIPT','STYLE'].includes(node.parentElement.tagName)) return;
      const before = node.nodeValue;
      const trimmed = before.trim();
      if (!trimmed) return;
      const translated = translateValue(trimmed, safe);
      if (translated !== trimmed) node.nodeValue = before.replace(trimmed, translated);
    });
    const select = document.getElementById('language-select');
    if (select) select.value = safe;
  }

  window.fullTranslate = translateAll;
  document.getElementById('language-select')?.addEventListener('change', (e) => translateAll(e.target.value));
  // Translate after every app render so newly-created rows/cards use the selected language.
  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function () {
      const result = originalRender.apply(this, arguments);
      translateAll(localStorage.getItem('cigarette_shop_language') || 'he');
      return result;
    };
  }
  translateAll(localStorage.getItem('cigarette_shop_language') || 'he');
})();


document.addEventListener('change', (event) => { if (event.target?.id === 'profitMonth' || event.target?.id === 'profitDays') renderDailyProfit(); });
