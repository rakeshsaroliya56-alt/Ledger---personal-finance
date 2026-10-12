/* =========================================================
   LEDGER — shared data layer & helpers
   Storage note: this app uses localStorage only (no backend).
   Passwords are stored in plain text for demo purposes — this
   is a stated scope/limitation of the project, not for real use.
   ========================================================= */

const DB = {
  USERS: "ledger_users",
  TXNS: "ledger_transactions",
  SESSION: "ledger_session",
};

const CATEGORIES = {
  income: ["Salary", "Freelance", "Gift", "Investment", "Other Income"],
  expense: ["Food", "Transport", "Housing", "Utilities", "Entertainment", "Health", "Shopping", "Other"],
};

/* ---------- low level storage ---------- */
function readAll(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}
function writeAll(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- users / auth ---------- */
function getUsers() { return readAll(DB.USERS); }

function findUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

function signup({ name, email, password, currency }) {
  const users = getUsers();
  if (findUserByEmail(email)) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const user = { id: uid(), name, email, password, currency: currency || "USD" };
  users.push(user);
  writeAll(DB.USERS, users);
  setSession(user.id);
  return { ok: true, user };
}

function login(email, password) {
  const user = findUserByEmail(email);
  if (!user) return { ok: false, error: "No account found with that email." };
  if (user.password !== password) return { ok: false, error: "Incorrect password." };
  setSession(user.id);
  return { ok: true, user };
}

function setSession(userId) { localStorage.setItem(DB.SESSION, userId); }
function clearSession() { localStorage.removeItem(DB.SESSION); }
function getCurrentUser() {
  const id = localStorage.getItem(DB.SESSION);
  if (!id) return null;
  return getUsers().find(u => u.id === id) || null;
}
function updateUser(userId, patch) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  writeAll(DB.USERS, users);
  return users[idx];
}
function deleteUser(userId) {
  writeAll(DB.USERS, getUsers().filter(u => u.id !== userId));
  writeAll(DB.TXNS, readAll(DB.TXNS).filter(t => t.userId !== userId));
  clearSession();
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

/* ---------- transactions ---------- */
function getTransactions(userId) {
  return readAll(DB.TXNS)
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function addTransaction(txn) {
  const all = readAll(DB.TXNS);
  all.push({ id: uid(), ...txn });
  writeAll(DB.TXNS, all);
}

function updateTransaction(id, patch) {
  const all = readAll(DB.TXNS);
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  writeAll(DB.TXNS, all);
}

function deleteTransaction(id) {
  writeAll(DB.TXNS, readAll(DB.TXNS).filter(t => t.id !== id));
}

function getTransactionById(id) {
  return readAll(DB.TXNS).find(t => t.id === id);
}

/* ---------- validation helpers ---------- */
const Validate = {
  email(value) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return "Email is required.";
    if (!re.test(value)) return "Enter a valid email address.";
    return "";
  },
  password(value) {
    if (!value) return "Password is required.";
    if (value.length < 6) return "Password must be at least 6 characters.";
    if (!/[0-9]/.test(value)) return "Password must include at least one number.";
    return "";
  },
  required(value, label = "This field") {
    if (!value || !value.toString().trim()) return `${label} is required.`;
    return "";
  },
  amount(value) {
    if (value === "" || value === null) return "Amount is required.";
    const n = Number(value);
    if (isNaN(n)) return "Amount must be a number.";
    if (n <= 0) return "Amount must be greater than zero.";
    if (n > 100000000) return "Amount is unrealistically large.";
    return "";
  },
  date(value) {
    if (!value) return "Date is required.";
    const d = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return "Date cannot be in the future.";
    return "";
  },
};

function showFieldError(inputEl, message) {
  const err = document.querySelector(`[data-error-for="${inputEl.id}"]`);
  if (err) err.textContent = message;
  inputEl.style.borderColor = message ? "var(--expense)" : "var(--rule)";
}

/* ---------- formatting ---------- */
function formatMoney(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch (e) {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ---------- toast ---------- */
function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- nav rail (shared across pages) ---------- */
function renderRail(activePage) {
  const mount = document.getElementById("rail-mount");
  if (!mount) return;
  const links = [
    { href: "index.html", label: "Dashboard", num: "01" },
    { href: "add-transaction.html", label: "Add Entry", num: "02" },
    { href: "history.html", label: "Ledger History", num: "03" },
    { href: "report_alt.html", label: "Reports", num: "04" },
    { href: "profile.html", label: "Settings", num: "05" },
  ];
  mount.innerHTML = `
    <div class="rail-brand">Ledger <span>PERSONAL FINANCE</span></div>
    ${links.map(l => `
      <a class="rail-link ${l.href === activePage ? "active" : ""}" href="${l.href}">
        <span class="rail-num">${l.num}</span>${l.label}
      </a>`).join("")}
    <div class="rail-footer">
      <div id="rail-user"></div>
      <button class="btn-ghost" style="width:100%" onclick="handleLogout()">Log out</button>
    </div>
  `;
  const user = getCurrentUser();
  const userEl = document.getElementById("rail-user");
  if (user && userEl) userEl.textContent = user.name;
}

function handleLogout() {
  clearSession();
  window.location.href = "login.html";
}
