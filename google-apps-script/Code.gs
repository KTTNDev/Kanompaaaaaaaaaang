const SPREADSHEET_ID = "11TVIZinypm-mzrkj_LyUMrgCGUexytr-mTA8nBCLV-A";
const TIME_ZONE = "Asia/Bangkok";
const TABLES = {
  products: { sheet: "DB_PRODUCTS", headers: ["id", "sku", "name", "category", "price", "appPrice", "cost", "imageUrl", "active", "sortOrder", "trackStock", "currentStock", "minStock", "createdAt", "updatedAt"], numbers: ["price", "appPrice", "cost", "sortOrder", "currentStock", "minStock"], booleans: ["active", "trackStock"] },
  orders: { sheet: "DB_ORDERS", headers: ["orderNumber", "createdAt", "channel", "paymentMethod", "subtotal", "discount", "total", "cost", "profit", "itemCount", "receivedAmount", "changeAmount", "status", "clientOrderId"], numbers: ["subtotal", "discount", "total", "cost", "profit", "itemCount", "receivedAmount", "changeAmount"], booleans: [] },
  orderItems: { sheet: "DB_ORDER_ITEMS", headers: ["id", "orderNumber", "productId", "productName", "quantity", "unitPrice", "unitCost", "lineTotal", "lineCost"], numbers: ["quantity", "unitPrice", "unitCost", "lineTotal", "lineCost"], booleans: [] },
  expenses: { sheet: "DB_EXPENSES", headers: ["id", "createdAt", "category", "title", "amount", "note"], numbers: ["amount"], booleans: [] },
  waste: { sheet: "DB_WASTE", headers: ["id", "createdAt", "productId", "productName", "quantity", "unitCost", "totalCost", "reason", "note"], numbers: ["quantity", "unitCost", "totalCost"], booleans: [] },
  settings: { sheet: "DB_SETTINGS", headers: ["key", "value", "updatedAt"], numbers: [], booleans: [] },
};

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || "bootstrap");
    if (action === "bootstrap") return json_(bootstrap_());
    if (action === "health") return json_({ ok: true, spreadsheetId: SPREADSHEET_ID, time: now_() });
    return json_({ error: "ไม่รู้จักคำสั่ง " + action });
  } catch (error) {
    return json_({ error: error.message || String(error) });
  }
}

function doPost(event) {
  try {
    const body = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      if (body.action === "order.create") return json_(createOrder_(body.order || {}));
      if (body.action === "product.save") return json_(saveProduct_(body.product || {}));
      if (body.action === "product.archive") return json_(archiveProduct_(String(body.id || "")));
      if (body.action === "expense.save") return json_(saveExpense_(body.expense || {}));
      if (body.action === "waste.save") return json_(saveWaste_(body.waste || {}));
      if (body.action === "settings.save") return json_(saveSettings_(body.settings || {}));
      return json_({ error: "ไม่รู้จักคำสั่ง" });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json_({ error: error.message || String(error) });
  }
}

function bootstrap_() {
  ensureDatabase_();
  const orders = readTable_("orders");
  const orderItems = readTable_("orderItems");
  const itemMap = {};
  orderItems.forEach(function (item) {
    if (!itemMap[item.orderNumber]) itemMap[item.orderNumber] = [];
    itemMap[item.orderNumber].push(item);
  });
  orders.forEach(function (order) { order.items = itemMap[order.orderNumber] || []; });
  return {
    source: "GOOGLE_SHEETS",
    products: readTable_("products").filter(function (product) { return product.active !== false; }),
    orders: orders.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 1000),
    expenses: readTable_("expenses"),
    waste: readTable_("waste"),
    settings: readSettings_(),
  };
}

function createOrder_(input) {
  ensureDatabase_();
  const clientOrderId = String(input.clientOrderId || "").trim();
  if (clientOrderId) {
    const duplicate = readTable_("orders").filter(function (order) { return String(order.clientOrderId || "") === clientOrderId; })[0];
    if (duplicate) {
      duplicate.items = readTable_("orderItems").filter(function (item) { return item.orderNumber === duplicate.orderNumber; });
      return { ok: true, order: duplicate, duplicate: true };
    }
  }
  const products = readTableWithRows_("products");
  const productById = {};
  products.forEach(function (entry) { productById[entry.value.id] = entry; });
  const requestedItems = Array.isArray(input.items) ? input.items : [];
  if (!requestedItems.length) throw new Error("ยังไม่มีสินค้าในบิล");
  const channel = input.channel === "APP" ? "APP" : "STORE";
  const items = [];
  let subtotal = 0;
  let cost = 0;
  let itemCount = 0;
  requestedItems.forEach(function (requested) {
    const productEntry = productById[String(requested.productId || "")];
    const quantity = Math.max(1, Math.floor(Number(requested.quantity || 1)));
    if (!productEntry || productEntry.value.active === false) throw new Error("ไม่พบสินค้าใน Google Sheet");
    const product = productEntry.value;
    if (product.trackStock && Number(product.currentStock || 0) < quantity) throw new Error("สต็อก " + product.name + " ไม่พอ");
    const unitPrice = channel === "APP" ? Number(product.appPrice || product.price || 0) : Number(product.price || 0);
    const unitCost = Number(product.cost || 0);
    const lineTotal = round_(unitPrice * quantity);
    const lineCost = round_(unitCost * quantity);
    subtotal += lineTotal;
    cost += lineCost;
    itemCount += quantity;
    items.push({ id: Utilities.getUuid(), productId: product.id, productName: product.name, quantity: quantity, unitPrice: unitPrice, unitCost: unitCost, lineTotal: lineTotal, lineCost: lineCost });
    if (product.trackStock) {
      product.currentStock = Number(product.currentStock || 0) - quantity;
      product.updatedAt = now_();
      writeObjectToRow_("products", productEntry.row, product);
    }
  });
  const discount = Math.min(Math.max(Number(input.discount || 0), 0), subtotal);
  const total = round_(subtotal - discount);
  const paymentMethod = ["CASH", "QR", "CARD", "OTHER"].indexOf(input.paymentMethod) >= 0 ? input.paymentMethod : "CASH";
  const receivedAmount = paymentMethod === "CASH" ? Number(input.receivedAmount || total) : total;
  if (receivedAmount < total) throw new Error("ยอดเงินที่รับไม่เพียงพอ");
  const createdAt = now_();
  const orderNumber = "ORD-" + Utilities.formatDate(new Date(), TIME_ZONE, "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 900 + 100);
  const order = { orderNumber: orderNumber, createdAt: createdAt, channel: channel, paymentMethod: paymentMethod, subtotal: round_(subtotal), discount: round_(discount), total: total, cost: round_(cost), profit: round_(total - cost), itemCount: itemCount, receivedAmount: round_(receivedAmount), changeAmount: round_(receivedAmount - total), status: "COMPLETED", clientOrderId: clientOrderId };
  appendObject_("orders", order);
  items.forEach(function (item) { item.orderNumber = orderNumber; appendObject_("orderItems", item); });
  order.items = items;
  return { ok: true, order: order };
}

function saveProduct_(input) {
  const existing = readTableWithRows_("products").filter(function (entry) { return entry.value.id === input.id; })[0];
  const timestamp = now_();
  const product = {
    id: String(input.id || Utilities.getUuid()), sku: String(input.sku || ""), name: String(input.name || "").trim(), category: String(input.category || "ทั่วไป").trim(),
    price: nonNegative_(input.price), appPrice: nonNegative_(input.appPrice || input.price), cost: nonNegative_(input.cost), imageUrl: String(input.imageUrl || ""),
    active: input.active !== false, sortOrder: Number(input.sortOrder || 0), trackStock: input.trackStock === true, currentStock: nonNegative_(input.currentStock), minStock: nonNegative_(input.minStock),
    createdAt: existing ? existing.value.createdAt : timestamp, updatedAt: timestamp,
  };
  if (!product.name) throw new Error("กรุณาระบุชื่อสินค้า");
  if (product.price <= 0) throw new Error("ราคาขายต้องมากกว่า 0");
  if (existing) writeObjectToRow_("products", existing.row, product); else appendObject_("products", product);
  return { ok: true, product: product };
}

function archiveProduct_(id) {
  const existing = readTableWithRows_("products").filter(function (entry) { return entry.value.id === id; })[0];
  if (!existing) throw new Error("ไม่พบสินค้า");
  existing.value.active = false;
  existing.value.updatedAt = now_();
  writeObjectToRow_("products", existing.row, existing.value);
  return { ok: true };
}

function saveExpense_(input) {
  const expense = { id: String(input.id || Utilities.getUuid()), createdAt: String(input.createdAt || now_()), category: String(input.category || "OTHER"), title: String(input.title || "").trim(), amount: nonNegative_(input.amount), note: String(input.note || "") };
  if (!expense.title || expense.amount <= 0) throw new Error("กรุณาระบุรายการและจำนวนเงิน");
  appendObject_("expenses", expense);
  return { ok: true, expense: expense };
}

function saveWaste_(input) {
  const productEntry = readTableWithRows_("products").filter(function (entry) { return entry.value.id === input.productId; })[0];
  if (!productEntry) throw new Error("ไม่พบสินค้า");
  const quantity = Math.max(1, Math.floor(Number(input.quantity || 1)));
  const product = productEntry.value;
  const waste = { id: Utilities.getUuid(), createdAt: now_(), productId: product.id, productName: product.name, quantity: quantity, unitCost: Number(product.cost || 0), totalCost: round_(Number(product.cost || 0) * quantity), reason: String(input.reason || "UNSOLD"), note: String(input.note || "") };
  if (product.trackStock) { product.currentStock = Math.max(0, Number(product.currentStock || 0) - quantity); product.updatedAt = now_(); writeObjectToRow_("products", productEntry.row, product); }
  appendObject_("waste", waste);
  return { ok: true, waste: waste };
}

function saveSettings_(input) {
  const values = { storeName: String(input.storeName || "ร้านขนมปัง"), currency: "THB", defaultChannel: input.defaultChannel === "APP" ? "APP" : "STORE" };
  const sheet = sheetFor_("settings");
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, TABLES.settings.headers.length).clearContent();
  Object.keys(values).forEach(function (key) { appendObject_("settings", { key: key, value: values[key], updatedAt: now_() }); });
  return { ok: true, settings: values };
}

function readSettings_() {
  const settings = { storeName: "ร้านขนมปัง", currency: "THB", defaultChannel: "STORE" };
  readTable_("settings").forEach(function (row) { settings[row.key] = row.value; });
  return settings;
}

function ensureDatabase_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(TABLES).forEach(function (key) {
    const definition = TABLES[key];
    let sheet = spreadsheet.getSheetByName(definition.sheet);
    if (!sheet) sheet = spreadsheet.insertSheet(definition.sheet);
    const firstRow = sheet.getRange(1, 1, 1, definition.headers.length).getValues()[0];
    if (firstRow.join("|") !== definition.headers.join("|")) sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
    sheet.setFrozenRows(1);
  });
}

function sheetFor_(key) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TABLES[key].sheet); }
function readTable_(key) { return readTableWithRows_(key).map(function (entry) { return entry.value; }); }
function readTableWithRows_(key) {
  const definition = TABLES[key]; const sheet = sheetFor_(key); const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, definition.headers.length).getValues().map(function (values, index) {
    const value = {}; definition.headers.forEach(function (header, column) { let cell = values[column]; if (definition.numbers.indexOf(header) >= 0) cell = Number(cell || 0); if (definition.booleans.indexOf(header) >= 0) cell = cell === true || String(cell).toLowerCase() === "true"; value[header] = cell; });
    return { row: index + 2, value: value };
  }).filter(function (entry) { return String(entry.value[definition.headers[0]] || "").trim() !== ""; });
}
function appendObject_(key, object) { const definition = TABLES[key]; sheetFor_(key).appendRow(definition.headers.map(function (header) { return object[header] === undefined ? "" : object[header]; })); }
function writeObjectToRow_(key, row, object) { const definition = TABLES[key]; sheetFor_(key).getRange(row, 1, 1, definition.headers.length).setValues([definition.headers.map(function (header) { return object[header] === undefined ? "" : object[header]; })]); }
function nonNegative_(value) { const number = Number(value || 0); return isFinite(number) ? Math.max(0, number) : 0; }
function round_(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function now_() { return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
