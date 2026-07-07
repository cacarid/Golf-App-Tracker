// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBu_jHTbsXa9JRk8yGGldQAHrLW59BQ8HU",
  authDomain: "golf-inventory-tracker.firebaseapp.com",
  projectId: "golf-inventory-tracker",
  storageBucket: "golf-inventory-tracker.firebasestorage.app",
  messagingSenderId: "777880987409",
  appId: "1:777880987409:web:d24ef10034328c501eceb0"
};

// Initialize Firebase
let db, auth;

// Wait for Firebase to load
window.addEventListener('load', function() {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  
  // Enable offline persistence
  db.enablePersistence()
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.log('Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.log('Browser does not support persistence');
      }
    });

  // Initialize app after authentication
  auth.onAuthStateChanged((user) => {
    if (user) {
      setupFirestoreListener();
      setupEventListeners();
    } else {
      auth.signInAnonymously().catch((error) => {
        console.error("Auth error:", error);
      });
    }
  });
});

const STORAGE_KEY = "price-tracker-products-v1";

const form = document.getElementById("product-form");
const nameInput = document.getElementById("name");
const skuInput = document.getElementById("sku");
const costInput = document.getElementById("cost");
const retailInput = document.getElementById("retail");
const statusInput = document.getElementById("status");
const messageEl = document.getElementById("form-message");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");
const tableBody = document.getElementById("product-table-body");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search");
const exportBtn = document.getElementById("export-btn");

const statProducts = document.getElementById("stat-products");
const statMargin = document.getElementById("stat-margin");
const statProfit = document.getElementById("stat-profit");

let products = [];
let editingId = null;
let unsubscribe = null;

function setupEventListeners() {
  form.addEventListener("submit", onSubmit);
  cancelEditBtn.addEventListener("click", exitEditMode);
  searchInput.addEventListener("input", render);
  exportBtn.addEventListener("click", exportToExcel);
}

function setupFirestoreListener() {
  // Set up real-time listener for products collection
  if (unsubscribe) unsubscribe();
  
  unsubscribe = db.collection("products")
    .orderBy("updatedAt", "desc")
    .onSnapshot(
      (snapshot) => {
        products = [];
        snapshot.forEach((doc) => {
          products.push({ ...doc.data(), id: doc.id });
        });
        render();
      },
      (error) => {
        console.error("Error loading products:", error);
        setMessage("Error loading inventory. Please refresh.");
      }
    );
}

function onSubmit(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const sku = skuInput.value.trim();
  const cost = parseMoney(costInput.value);
  const retail = parseMoney(retailInput.value);
  const status = statusInput.value;

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
    name,
    sku,
    cost,
    retail,
    status,
    updatedAt: Date.now(),
  };

  const savePromise = editingId
    ? db.collection("products").doc(editingId).update(product)
    : db.collection("products").add(product);

  savePromise
    .then(() => {
      if (editingId) {
        exitEditMode();
      }
      form.reset();
      setMessage("");
      nameInput.focus();
    })
    .catch((error) => {
      console.error("Error saving product:", error);
      setMessage("Error saving. Please try again.");
    });
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
  statusInput.value = product.status;
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
  db.collection("products").doc(productId).delete()
    .catch((error) => {
      console.error("Error deleting product:", error);
      setMessage("Error deleting item. Please try again.");
    });

  if (editingId === productId) {
    form.reset();
    exitEditMode();
  }
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
      <td><span class="status-badge status-${product.status.toLowerCase()}">${product.status}</span></td>
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
    Number.isFinite(Number(value.retail)) &&
    typeof value.status === "string"
  );
}

function normalizeProduct(value) {
  return {
    id: value.id,
    name: value.name.trim(),
    sku: value.sku.trim(),
    cost: Number(value.cost),
    retail: Number(value.retail),
    status: value.status || "Active",
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

function exportToExcel() {
  if (products.length === 0) {
    alert("No products to export.");
    return;
  }

  const rows = products.map((p) => {
    const m = calculateMetrics(p.cost, p.retail);
    return {
      "Item Name": p.name,
      "Item Code": p.sku || "",
      "Cost ($)": p.cost,
      "Retail ($)": p.retail,
      "Profit ($)": parseFloat(m.profit.toFixed(2)),
      "Margin (%)": parseFloat(m.margin.toFixed(2)),
      "Markup (%)": parseFloat(m.markup.toFixed(2)),
      "Status": p.status,
      "Last Updated": new Date(p.updatedAt).toLocaleDateString("en-US"),
    };
  });

  // Summary row
  const totalProfit = products.reduce((sum, p) => sum + calculateMetrics(p.cost, p.retail).profit, 0);
  const avgMargin = products.reduce((sum, p) => sum + calculateMetrics(p.cost, p.retail).margin, 0) / products.length;

  rows.push({});
  rows.push({
    "Item Name": "INVENTORY TOTALS / AVERAGES",
    "Item Code": "",
    "Cost ($)": "",
    "Retail ($)": "",
    "Profit ($)": parseFloat(totalProfit.toFixed(2)),
    "Margin (%)": parseFloat(avgMargin.toFixed(2)),
    "Markup (%)": "",
    "Status": "",
    "Last Updated": "",
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths
  worksheet["!cols"] = [
    { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Divot Deals Products");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `DivotDeals_Products_${date}.xlsx`);
}
