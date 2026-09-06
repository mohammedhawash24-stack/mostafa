/*
 * Local Mock REST API.
 * Persists data in localStorage so the static app works without a server.
 */

const MockAPI = (() => {
  const STORAGE_KEY = 'cigarette_mock_api_v2';

  const emptyDatabase = {
    products: [],
    orders: [],
    stockMovements: [],
    lastReceipt: null,
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const load = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : clone(emptyDatabase);
  };

  const save = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const wait = (value) => new Promise((resolve) => {
    setTimeout(() => resolve(clone(value)), 60);
  });

  return {
    async get(resource) {
      const data = load();
      return wait(data[resource] ?? null);
    },

    async post(resource, body) {
      const data = load();
      data[resource].push(clone(body));
      save(data);
      return wait(body);
    },

    async put(resource, id, body) {
      const data = load();
      const index = data[resource].findIndex(
        (item) => String(item.id) === String(id),
      );

      if (index < 0) throw new Error('Not found');

      data[resource][index] = clone(body);
      save(data);
      return wait(body);
    },

    async delete(resource, id) {
      const data = load();
      data[resource] = data[resource].filter(
        (item) => String(item.id) !== String(id),
      );
      save(data);
      return wait({ ok: true });
    },

    async patchProductStock(id, quantity, reason = 'Manual adjustment') {
      const data = load();
      const product = data.products.find(
        (item) => String(item.id) === String(id),
      );

      if (!product) throw new Error('Product not found');
      if (Number(product.qty) + quantity < 0) {
        throw new Error('Not enough stock');
      }

      product.qty += quantity;
      data.stockMovements.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        productId: product.id,
        productName: product.name,
        change: quantity,
        reason,
      });

      save(data);
      return wait(product);
    },

    async setLastReceipt(receipt) {
      const data = load();
      data.lastReceipt = clone(receipt);
      save(data);
      return wait(receipt);
    },

    async seedDemo() {
      const data = load();
      if (data.products.length) return wait(false);

      data.products = [
        { id: 101, name: 'Marlboro Red', brand: 'Marlboro', type: 'Cigarettes', buy: 8.5, sell: 12, qty: 50, min: 10 },
        { id: 102, name: 'Marlboro Gold', brand: 'Marlboro', type: 'Cigarettes', buy: 8.5, sell: 12, qty: 32, min: 8 },
        { id: 103, name: 'Winston Blue', brand: 'Winston', type: 'Cigarettes', buy: 7.5, sell: 11, qty: 28, min: 7 },
        { id: 104, name: 'L&M Red', brand: 'L&M', type: 'Cigarettes', buy: 7, sell: 10, qty: 40, min: 10 },
        { id: 105, name: 'Camel Yellow', brand: 'Camel', type: 'Cigarettes', buy: 7.5, sell: 11, qty: 25, min: 8 },
        { id: 106, name: 'Davidoff Gold', brand: 'Davidoff', type: 'Cigarettes', buy: 9, sell: 13, qty: 18, min: 6 },
        { id: 107, name: 'Nargileh Apple', brand: 'Nargileh', type: 'Hookah', buy: 16, sell: 25, qty: 5, min: 8 },
      ];

      data.stockMovements = data.products.map((product) => ({
        id: Date.now() + product.id,
        date: new Date().toISOString(),
        productId: product.id,
        productName: product.name,
        change: product.qty,
        reason: 'Initial demo stock',
      }));

      save(data);
      return wait(true);
    },

    async reset() {
      save(clone(emptyDatabase));
      return wait(true);
    },

    async login(username, password) {
      return wait(username === 'admin' && password === 'admin123');
    },
  };
})();


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
