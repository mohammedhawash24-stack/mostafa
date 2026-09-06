/*
 * Cigarette Shop Admin
 * Main application logic.
 */

const AUTH_KEY = 'cig_admin_auth';

let db = {
  products: [],
  orders: [],
  stockMovements: [],
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

async function resizeProductImage(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  const maxSize = 160;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

function setProductImagePreview(src) {
  const image = $('pImagePreview');
  const placeholder = $('pImagePlaceholder');
  if (src) {
    image.src = src;
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    placeholder.hidden = false;
  }
}

const pages = {
  dashboard: ['לוח בקרה', 'לוח בקרה'],
  inventory: ['מלאי / מחסן', 'מלאי'],
  orders: ['הזמנה חדשה', 'הזמנה חדשה'],
  history: ['היסטוריית הזמנות', 'היסטוריית הזמנות'],
  reports: ['דוחות', 'דוחות'],
  movements: ['תנועות מלאי', 'תנועות מלאי'],
  receipt: ['קבלה', 'קבלה'],
};

async function refresh() {
  db.products = await MockAPI.get('products');
  db.orders = await MockAPI.get('orders');
  db.stockMovements = await MockAPI.get('stockMovements');
  db.lastReceipt = await MockAPI.get('lastReceipt');
  render();
}

async function login() {
  const username = $('user').value.trim();
  const password = $('pass').value;
  const valid = await MockAPI.login(username, password);

  if (!valid) {
    $('loginMsg').textContent = 'שם המשתמש או הסיסמה שגויים.';
    return;
  }

  sessionStorage.setItem(AUTH_KEY, '1');
  showApp();
}

async function showApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  $('todayDate').textContent = new Date().toLocaleDateString();
  await refresh();
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

function renderDashboard() {
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
            <td class="product-image-cell">${product.image ? `<img class="product-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<span class="product-thumb-placeholder">📦</span>'}</td>
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
    : '<tr><td colspan="9" class="empty">No products found.</td></tr>';
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
          <section class="cartitem-main">
            <b>${escapeHtml(item.name)}</b>
            <small>${item.qty} ×</small>
            <label class="order-price-field">Price for this order
              <input class="cart-price-input" data-index="${index}" type="number" min="0" step="0.01" value="${Number(item.sell).toFixed(2)}" aria-label="Price for this order">
            </label>
          </section>
          <b class="price">${money(item.qty * item.sell)}</b>
          <button class="icon-btn" data-action="remove-cart" data-index="${index}" type="button">×</button>
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
  $('pImage').value = '';
  setProductImagePreview('');
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
    setProductImagePreview(product.image || '');
  }

  $('productDialog').showModal();
}

function closeProductDialog() {
  $('productDialog').close();
}

async function saveProduct(event) {
  event.preventDefault();

  const id = Number($('pId').value);
  const existingProduct = id ? db.products.find((item) => item.id === id) : null;
  let image = existingProduct?.image || '';

  try {
    if ($('pImage').files[0]) image = await resizeProductImage($('pImage').files[0]);
  } catch (error) {
    alert(error.message || 'Could not read the product image.');
    return;
  }

  const product = {
    id: id || Date.now(),
    name: $('pName').value.trim(),
    brand: $('pBrand').value.trim(),
    type: $('pType').value,
    variant: $('pVariant').value.trim(),
    supplier: $('pSupplier').value.trim(),
    buy: Number($('pBuy').value),
    sell: Number($('pSell').value),
    qty: Number($('pQty').value),
    min: Number($('pMin').value),
    image,
  };

  if (!product.name || !Number.isFinite(product.buy) || !Number.isFinite(product.sell)) {
    alert('Please complete the required product fields.');
    return;
  }

  if (id) {
    await MockAPI.put('products', id, product);
  } else {
    // Save the entered quantity exactly once. The previous version saved qty
    // on the product and then added the same qty again via stock movement.
    const initialQty = product.qty;
    await MockAPI.post('products', { ...product, qty: 0 });
    if (initialQty > 0) {
      await MockAPI.patchProductStock(product.id, initialQty, 'Initial stock');
    }
  }

  closeProductDialog();
  await refresh();
}

async function deleteProduct(id) {
  const product = db.products.find((item) => item.id === id);
  if (!product) return;

  if (!confirm(`Delete ${product.name}?`)) return;

  await MockAPI.delete('products', id);
  cart = cart.filter((item) => item.id !== id);
  await refresh();
}

function addToCart() {
  const product = db.products.find(
    (item) => item.id === Number($('orderProduct').value),
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
  if ($('order-customer')) {
    $('order-customer').value = '';
    window.showSelectedCustomer?.();
  }
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
    for (const item of cart) {
      await MockAPI.patchProductStock(item.id, -item.qty, `Sale ${order.id}`);
    }

    await MockAPI.post('orders', order);
    await MockAPI.setLastReceipt(order);

    cart = [];
    $('discount').value = 0;

    await refresh();
    go('receipt');
    setTimeout(() => window.print(), 250);
  } catch (error) {
    alert(error.message);
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

  if (action === 'edit-product') {
    const product = db.products.find((item) => item.id === Number(id));
    if (product) openProductDialog(product);
  }

  if (action === 'delete-product') {
    deleteProduct(Number(id));
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

  $('logout').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  $('search').addEventListener('input', renderProducts);
  $('orderSearch').addEventListener('input', renderHistory);
  $('discount').addEventListener('input', renderCart);
  document.addEventListener('input', (event) => {
    const input = event.target.closest('.cart-price-input');
    if (!input) return;
    const index = Number(input.dataset.index);
    if (!cart[index]) return;
    const value = Number(input.value);
    cart[index].sell = Number.isFinite(value) && value >= 0 ? value : 0;
    renderCart();
    const refreshed = document.querySelectorAll('.cart-price-input')[index];
    if (refreshed) { refreshed.focus(); refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length); }
  });

  $('addProduct').addEventListener('click', () => openProductDialog());
  $('cancelProduct').addEventListener('click', closeProductDialog);
  $('cancelProduct2').addEventListener('click', closeProductDialog);
  $('pImage').addEventListener('change', async () => {
    const file = $('pImage').files[0];
    if (!file) return;
    try {
      const preview = await resizeProductImage(file);
      setProductImagePreview(preview);
    } catch (error) {
      $('pImage').value = '';
      setProductImagePreview('');
      alert(error.message || 'Could not read the product image.');
    }
  });

  $('productForm').addEventListener('submit', saveProduct);

  $('addToCart').addEventListener('click', addToCart);
  $('clearCart').addEventListener('click', clearCart);
  $('completeOrder').addEventListener('click', completeOrder);
  $('printLast').addEventListener('click', () => window.print());
  $('loadDemo').addEventListener('click', loadDemoData);

  if (sessionStorage.getItem(AUTH_KEY) === '1') {
    showApp();
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



/* Customers + New Order customer selector */
(function () {
  const STORAGE_KEY = "cig_admin_v1";
  const $ = (id) => document.getElementById(id);

  function data() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function save(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function ensureCustomers() {
    const value = data();
    value.customers ||= [];
    return value;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function renderCustomers() {
    const select = $("order-customer");
    if (!select) return;

    const value = ensureCustomers();
    const current = select.value;
    select.innerHTML = '<option value="">Walk-in / No customer</option>' +
      value.customers.map((customer) =>
        `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.phone ? ` — ${escapeHtml(customer.phone)}` : ""}</option>`
      ).join("");

    if (value.customers.some((customer) => customer.id === current)) select.value = current;
    showCustomerInfo();
  }

  function getSelectedCustomer() {
    const id = $("order-customer")?.value || "";
    if (!id) return null;
    return ensureCustomers().customers.find((customer) => customer.id === id) || null;
  }

  function showCustomerInfo() {
    const info = $("selected-customer-info");
    if (!info) return;
    const customer = getSelectedCustomer();
    if (!customer) {
      info.innerHTML = '<span class="customer-dot"></span><span>No customer selected — this will be a walk-in order.</span>';
      return;
    }
    info.innerHTML = `<span class="customer-dot"></span><section><b>${escapeHtml(customer.name)}</b>${customer.phone ? `<small>${escapeHtml(customer.phone)}</small>` : ""}</section>`;
  }

  function openCustomerDialog() {
    const dialog = $("customerDialog");
    if (!dialog) return;
    $("customerForm")?.reset();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    setTimeout(() => $("customer-name")?.focus(), 50);
  }

  function closeCustomerDialog() {
    const dialog = $("customerDialog");
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function addCustomer(event) {
    event?.preventDefault();
    const nameInput = $("customer-name");
    const phoneInput = $("customer-phone");
    const notesInput = $("customer-notes");
    const name = nameInput?.value.trim() || "";
    if (!name) {
      nameInput?.focus();
      return;
    }

    const value = ensureCustomers();
    const customer = {
      id: crypto.randomUUID(),
      name,
      phone: phoneInput?.value.trim() || "",
      notes: notesInput?.value.trim() || "",
      createdAt: new Date().toISOString()
    };

    value.customers.push(customer);
    save(value);
    closeCustomerDialog();
    renderCustomers();
    $("order-customer").value = customer.id;
    showCustomerInfo();
  }

  $("order-customer")?.addEventListener("change", showCustomerInfo);
  $("add-customer-from-order")?.addEventListener("click", openCustomerDialog);
  $("customerForm")?.addEventListener("submit", addCustomer);
  $("cancelCustomer")?.addEventListener("click", closeCustomerDialog);
  $("cancelCustomerX")?.addEventListener("click", closeCustomerDialog);
  $("customerDialog")?.addEventListener("click", (event) => {
    if (event.target === $("customerDialog")) closeCustomerDialog();
  });

  window.getSelectedCustomerId = () => $("order-customer")?.value || "";
  window.getSelectedCustomer = getSelectedCustomer;
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
    'Argileh / Hookah': 'Argileh / Hookah', 'Price for this order': 'Price for this order', 'No orders yet.': 'No orders yet.', 'All products are above minimum stock.': 'All products are above minimum stock.',
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
