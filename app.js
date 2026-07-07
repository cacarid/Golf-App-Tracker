const STORAGE_KEY = "price-tracker-products-v1";

const form = document.getElementById("product-form");
const nameInput = document.getElementById("name");
const skuInput = document.getElementById("sku");
const costInput = document.getElementById("cost");
const retailInput = document.getElementById("retail");
const messageEl = document.getElementById("form-message");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const tableBody = document.getElementById("product-table-body");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search");

const statProducts = document.getElementById("stat-products");
const statMargin = document.getElementById("stat-margin");
const statProfit = document.getElementById("stat-profit");

let products = loadProducts();
let editingId = null;

render();

form.addEventListener("submit", onSubmit);
cancelEditBtn.addEventListener("click", exitEditMode);
searchInput.addEventListener("input", render);

function onSubmit(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const sku = skuInput.value.trim();
  const cost = parseMoney(costInput.value);
  const retail = parseMoney(retailInput.value);

  if (!name) {
    setMessage("Please enter a product name.");
    nameInput.focus();
    return;
  }

  if (!isFinite(cost) || cost < 0) {
    setMessage("Please enter a valid cost price.");
    costInput.focus();
    return;
  }

  if (!isFinite(retail) || retail < 0) {
    setMessage("Please enter a valid retail price.");
    retailInput.focus();
    return;
  }

  const product = {
    id: editingId ?? crypto.randomUUID(),
    name,
    sku,
    cost,
    retail,
    updatedAt: Date.now(),
  };

  if (editingId) {
    products = products.map((item) => (item.id === editingId ? product : item));
    exitEditMode();
  } else {
    products.unshift(product);
  }

  saveProducts(products);
  form.reset();
  setMessage("");
  render();
  nameInput.focus();
}

function enterEditMode(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  editingId = product.id;
  nameInput.value = product.name;
  skuInput.value = product.sku;
  costInput.value = product.cost.toFixed(2);
  retailInput.value = product.retail.toFixed(2);
  submitBtn.textContent = "Update Product";
  cancelEditBtn.hidden = false;
  setMessage("");
  nameInput.focus();
}

function exitEditMode() {
  editingId = null;
  submitBtn.textContent = "Save Product";
  cancelEditBtn.hidden = true;
  setMessage("");
}

function deleteProduct(productId) {
  products = products.filter((item) => item.id !== productId);
  saveProducts(products);

  if (editingId === productId) {
    form.reset();
    exitEditMode();
  }

  render();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = products.filter((item) => {
    return item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
  });

  tableBody.innerHTML = "";

  for (const product of filtered) {
    const metrics = calculateMetrics(product.cost, product.retail);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.sku || "-")}</td>
      <td>${formatMoney(product.cost)}</td>
      <td>${formatMoney(product.retail)}</td>
      <td>${formatMoney(metrics.profit)}</td>
      <td>${formatPercent(metrics.margin)}</td>
      <td>${formatPercent(metrics.markup)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary" type="button" data-action="edit" data-id="${product.id}">Edit</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${product.id}">Delete</button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  }

  emptyState.hidden = filtered.length !== 0;

  tableBody.querySelectorAll("button[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => enterEditMode(button.dataset.id));
  });

  tableBody.querySelectorAll("button[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.id));
  });

  renderStats(products);
}

function renderStats(items) {
  const totalProducts = items.length;
  let totalProfit = 0;
  let marginTotal = 0;

  for (const item of items) {
    const metrics = calculateMetrics(item.cost, item.retail);
    totalProfit += metrics.profit;
    marginTotal += metrics.margin;
  }

  const averageMargin = totalProducts > 0 ? marginTotal / totalProducts : 0;

  statProducts.textContent = String(totalProducts);
  statMargin.textContent = formatPercent(averageMargin);
  statProfit.textContent = formatMoney(totalProfit);
}

function calculateMetrics(cost, retail) {
  const profit = retail - cost;
  const margin = retail > 0 ? (profit / retail) * 100 : 0;
  const markup = cost > 0 ? (profit / cost) * 100 : 0;

  return { profit, margin, markup };
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidProduct).map(normalizeProduct);
  } catch {
    return [];
  }
}

function saveProducts(nextProducts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
}

function isValidProduct(value) {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sku === "string" &&
    Number.isFinite(Number(value.cost)) &&
    Number.isFinite(Number(value.retail))
  );
}

function normalizeProduct(value) {
  return {
    id: value.id,
    name: value.name.trim(),
    sku: value.sku.trim(),
    cost: Number(value.cost),
    retail: Number(value.retail),
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

function parseMoney(value) {
  return Number.parseFloat(value);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
