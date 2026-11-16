import './bootstrap';

const API = '/api';
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toastNode = document.querySelector('#toast');
const state = {
    token: localStorage.getItem('pos_token') || '',
    user: null,
    view: 'dashboard',
    products: [],
    cart: [],
    toastTimer: null,
};

const eyeIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>';
const eyeOffIcon = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m2 3.27 1.28-1.28L22 20.72 20.73 22l-3.06-3.06A11.75 11.75 0 0 1 12 20C7 20 2.73 16.89 1 13c.79-1.78 2.09-3.35 3.78-4.53L2 3.27zM12 6c5 0 9.27 3.11 11 7-.62 1.4-1.58 2.64-2.83 3.65l-3.17-3.17A5 5 0 0 0 9.52 8.99L7.76 7.23A11.9 11.9 0 0 1 12 6zm0 3a4 4 0 0 1 4 4c0 .45-.08.88-.22 1.28l-5.06-5.06c.4-.14.83-.22 1.28-.22z"/></svg>';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function money(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function parseVariants(value) {
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value || '[]');
    } catch {
        return [];
    }
}

async function api(path, options = {}) {
    const { auth = true, headers: extraHeaders = {}, ...fetchOptions } = options;
    const headers = {
        Accept: 'application/json',
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && state.token ? { Authorization: 'Bearer ' + state.token } : {}),
        ...extraHeaders,
    };
    const response = await fetch(API + path, { ...fetchOptions, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const validation = Object.values(data.errors || {}).flat().join(' ');
        const error = new Error(data.message || validation || 'Permintaan gagal. Coba lagi.');
        error.status = response.status;
        throw error;
    }
    return data;
}

function showToast(message) {
    toastNode.textContent = message;
    toastNode.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3600);
}

function passwordField(label, name, options = {}) {
    const id = options.id || 'field-' + name.replace(/[^a-z0-9_-]/gi, '-');
    const autocomplete = options.autocomplete || 'new-password';
    const min = options.minlength ? ' minlength="' + options.minlength + '"' : '';
    const required = options.required === false ? '' : ' required';
    const placeholder = options.placeholder || 'Masukkan password';
    return '<div class="field ' + (options.className || '') + '">' +
        '<label for="' + id + '">' + escapeHtml(label) + '</label>' +
        '<div class="password-control">' +
        '<input id="' + id + '" name="' + escapeHtml(name) + '" type="password" autocomplete="' + autocomplete + '" placeholder="' + escapeHtml(placeholder) + '"' + min + required + '>' +
        '<button class="password-toggle" type="button" data-password-toggle="' + id + '" aria-label="Tampilkan password" aria-pressed="false">' + eyeIcon + '</button>' +
        '</div></div>';
}

function bindPasswordToggles(root) {
    root.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.onclick = () => {
            const input = root.querySelector('#' + CSS.escape(button.dataset.passwordToggle));
            if (!input) return;
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            button.innerHTML = visible ? eyeOffIcon : eyeIcon;
            button.setAttribute('aria-label', visible ? 'Sembunyikan password' : 'Tampilkan password');
            button.setAttribute('aria-pressed', String(visible));
        };
    });
}

function clearSession() {
    state.token = '';
    state.user = null;
    localStorage.removeItem('pos_token');
}

function showLogin(message = '') {
    app.innerHTML = '<main class="auth-page">' +
        '<section class="auth-story">' +
        '<div class="brand-lockup"><span class="brand-mark">P</span><span>POS Pintar</span></div>' +
        '<div class="auth-copy"><div class="eyebrow">Kasir digital untuk UMKM</div><h1>Usaha rapi.<br>Jualan lebih mudah.</h1><p>Catat transaksi, pantau stok, dan kelola tim kasir dari satu tempat.</p>' +
        '<div class="auth-points"><span>Penjualan tercatat</span><span>Stok terpantau</span><span>Tim lebih teratur</span></div></div>' +
        '<div class="auth-foot">POS Pintar UMKM</div></section>' +
        '<section class="auth-main"><div class="auth-card">' +
        '<div class="brand-lockup"><span class="brand-mark">P</span><span>POS Pintar <small style="display:block;color:#829087;font-size:10px;letter-spacing:.1em;text-transform:uppercase">UMKM</small></span></div>' +
        '<h2>Masuk ke akun</h2><p class="auth-subtitle">Gunakan username dan password akun Anda untuk melanjutkan.</p>' +
        '<div id="auth-error" class="auth-error' + (message ? ' visible' : '') + '">' + escapeHtml(message) + '</div>' +
        '<form id="login-form" novalidate><div class="field"><label for="login-username">Username</label><input class="input" id="login-username" name="username" autocomplete="username" placeholder="Contoh: owner" required autofocus></div>' +
        passwordField('Password', 'password', { id: 'login-password', autocomplete: 'current-password', placeholder: 'Masukkan password' }) +
        '<button class="primary full" id="login-submit" type="submit">Masuk</button></form>' +
        '<p class="auth-note">Sistem kasir untuk usaha Anda</p></div></section></main>';

    bindPasswordToggles(app);
    const form = document.querySelector('#login-form');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.querySelector('#login-submit');
        const errorNode = document.querySelector('#auth-error');
        const formData = new FormData(form);
        button.disabled = true;
        button.textContent = 'Memeriksa akun...';
        errorNode.classList.remove('visible');
        try {
            const result = await api('/login', {
                method: 'POST',
                auth: false,
                body: JSON.stringify(Object.fromEntries(formData)),
            });
            state.token = result.token;
            localStorage.setItem('pos_token', state.token);
            state.user = await api('/me');
            state.cart = [];
            await navigate(state.user.role === 'cashier' ? 'sales' : 'dashboard');
        } catch (error) {
            if (state.token) {
                showFatal('Login diterima, tetapi halaman berikutnya gagal dimuat.', error.message);
                return;
            }
            errorNode.textContent = error.message;
            errorNode.classList.add('visible');
            button.disabled = false;
            button.textContent = 'Masuk';
        }
    });
}

function navItems() {
    if (state.user?.role === 'cashier') {
        return [
            { view: 'sales', label: 'Kasir', icon: '＋' },
            { view: 'products', label: 'Produk & Stok', icon: '▣' },
        ];
    }
    return [
        { view: 'dashboard', label: 'Ringkasan', icon: '▦' },
        { view: 'products', label: 'Produk & Stok', icon: '▣' },
        { view: 'transactions', label: 'Transaksi', icon: '▤' },
        { view: 'cashiers', label: 'Akun Kasir', icon: '♙' },
    ];
}

function pageTitle(view) {
    return ({
        dashboard: 'Ringkasan',
        products: 'Produk & Stok',
        sales: 'Kasir',
        transactions: 'Transaksi',
        cashiers: 'Akun Kasir',
    })[view] || 'POS Pintar';
}

function renderShell(view, content) {
    const nav = navItems().map(item =>
        '<button class="nav-button ' + (item.view === view ? 'active' : '') + '" type="button" data-view="' + item.view + '">' +
        '<span class="nav-icon">' + item.icon + '</span><span>' + item.label + '</span></button>'
    ).join('');

    app.innerHTML = '<div class="layout"><aside class="sidebar">' +
        '<div class="brand-lockup"><span class="brand-mark">P</span><span>POS Pintar</span></div>' +
        '<div class="sidebar-label">Menu utama</div><nav class="nav-list">' + nav + '</nav>' +
        '<div class="sidebar-user"><strong>' + escapeHtml(state.user?.name || '') + '</strong><span>' + escapeHtml(state.user?.store_name || 'Toko UMKM') + '</span></div>' +
        '</aside><main class="workspace"><header class="topbar"><div><h1 class="page-title">' + pageTitle(view) + '</h1>' +
        '<div class="page-subtitle">' + escapeHtml(state.user?.store_name || 'Toko UMKM') + ' · ' + escapeHtml(state.user?.name || '') + '</div></div>' +
        '<div class="top-actions"><span class="role-pill">' + (state.user?.role === 'owner' ? 'Owner' : 'Kasir') + '</span>' +
        '<button class="secondary" id="password-open" type="button">Ubah password</button>' +
        '<button class="danger" id="logout" type="button">Keluar</button></div></header>' +
        '<section class="content" id="page-content">' + content + '</section></main></div>';

    app.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', () => navigate(button.dataset.view));
    });
    document.querySelector('#logout').addEventListener('click', logout);
    document.querySelector('#password-open').addEventListener('click', openPasswordDialog);
}

function showContent(view, content) {
    renderShell(view, content);
    bindPasswordToggles(app);
    bindPage(view);
}

async function navigate(view) {
    if (state.user?.role === 'cashier' && !['sales', 'products'].includes(view)) view = 'sales';
    if (state.user?.role === 'owner' && view === 'sales') view = 'dashboard';
    state.view = view;
    renderShell(view, '<div class="panel"><div class="boot-screen" style="min-height:180px"><span class="spinner"></span><p>Memuat ' + pageTitle(view).toLowerCase() + '...</p></div></div>');
    try {
        const content = await loadView(view);
        showContent(view, content);
    } catch (error) {
        showContent(view, '<div class="error-card"><h2>Halaman belum dapat dimuat</h2><p>' + escapeHtml(error.message) + '</p><button class="secondary" id="retry-view" type="button">Coba lagi</button></div>');
        document.querySelector('#retry-view').addEventListener('click', () => navigate(view));
    }
}

async function loadView(view) {
    if (view === 'dashboard') {
        const results = await Promise.all([api('/dashboard'), api('/products'), api('/transactions')]);
        return dashboardView(results[0], results[1], results[2]);
    }
    if (view === 'products') {
        state.products = await api('/products');
        return productsView(state.products, state.user?.role === 'owner');
    }
    if (view === 'sales') {
        state.products = await api('/products');
        return salesView();
    }
    if (view === 'transactions') {
        const transactions = await api('/transactions');
        return transactionsView(transactions);
    }
    if (view === 'cashiers') {
        const cashiers = await api('/cashiers');
        return cashiersView(cashiers);
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}

function bindPage(view) {
    if (view === 'products') bindProductForm();
    if (view === 'sales') bindSales();
    if (view === 'cashiers') bindCashierForm();
}

function dashboardView(summary, products, transactions) {
    const stats = [
        ['Penjualan hari ini', money(summary.today_total), 'Transaksi yang sudah lunas'],
        ['Transaksi hari ini', summary.today_count, 'Jumlah pembayaran berhasil'],
        ['Produk terdaftar', summary.products, 'Produk di inventaris toko'],
        ['Stok menipis', summary.low_stock, 'Perlu diperiksa atau diisi ulang'],
    ];
    const statCards = stats.map((item, index) =>
        '<article class="stat-card"><div class="stat-label">' + item[0] + '</div><div class="stat-value">' + item[1] + '</div><div class="stat-detail">' + item[2] + '</div></article>'
    ).join('');
    const low = products.filter(product => Number(product.stock) <= Number(product.low_stock_at));
    const lowList = low.length ? '<div class="product-grid">' + low.slice(0, 3).map(productCard).join('') + '</div>' :
        '<div class="empty-state">Semua stok berada di atas batas minimum.</div>';
    return '<div class="stats-grid">' + statCards + '</div>' +
        '<section class="panel"><div class="panel-head"><h2 class="panel-title">Transaksi terbaru</h2><button class="secondary" type="button" data-view="transactions">Lihat semua</button></div>' +
        transactionTable(transactions.slice(0, 6)) + '</section>' +
        '<section class="panel"><div class="panel-head"><h2 class="panel-title">Perhatian stok</h2><span class="muted">' + low.length + ' produk</span></div>' + lowList + '</section>';
}

function productCard(product) {
    const variants = parseVariants(product.variants);
    const isLow = Number(product.stock) <= Number(product.low_stock_at);
    return '<article class="product-card"><div class="product-top"><div><h3>' + escapeHtml(product.name) + '</h3><div class="product-category">' + escapeHtml(product.category || 'Umum') + '</div></div>' +
        '<span class="stock-badge ' + (isLow ? 'low' : '') + '">' + Number(product.stock) + ' stok</span></div>' +
        '<div class="variant-list">' + variants.map(variant => '<span class="variant-chip">' + escapeHtml(variant.name) + ' · ' + money(variant.price) + '</span>').join('') + '</div></article>';
}

function productsView(products, canManage) {
    const form = canManage ? '<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Tambah produk</h2><p class="muted">Catat produk dan harga jualnya.</p></div></div>' +
        '<form id="product-form"><div class="form-grid"><div class="field"><label for="product-name">Nama produk</label><input id="product-name" name="name" placeholder="Contoh: Kopi susu" required></div>' +
        '<div class="field"><label for="product-category">Kategori</label><input id="product-category" name="category" value="Umum"></div>' +
        '<div class="field"><label for="product-stock">Stok awal</label><input id="product-stock" name="stock" type="number" min="0" value="0" required></div>' +
        '<div class="field"><label for="product-low-stock">Batas stok menipis</label><input id="product-low-stock" name="low_stock_at" type="number" min="0" value="10"></div>' +
        '<div class="field"><label for="product-variant">Nama varian</label><input id="product-variant" name="variant" value="Satuan" required></div>' +
        '<div class="field"><label for="product-price">Harga jual (Rupiah)</label><input id="product-price" name="price" type="number" min="1" placeholder="15000" required></div></div>' +
        '<button class="primary" type="submit">Simpan produk</button></form></section>' : '';

    const list = products.length ? '<div class="product-grid">' + products.map(productCard).join('') + '</div>' :
        '<div class="empty-state">Belum ada produk di toko ini.</div>';
    return form + '<section class="panel"><div class="section-heading"><div><h2>Daftar produk</h2><p>' + products.length + ' produk tersimpan</p></div></div>' + list + '</section>';
}

function transactionTable(rows) {
    if (!rows.length) return '<div class="empty-state">Belum ada transaksi.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Kode transaksi</th><th>Waktu</th><th>Item</th><th>Pembayaran</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
        rows.map(transaction => {
            const items = transaction.items || [];
            const statusClass = transaction.status === 'paid' ? '' : transaction.status === 'pending' ? 'pending' : 'failed';
            const statusLabel = transaction.status === 'paid' ? 'Lunas' : transaction.status === 'pending' ? 'Menunggu' : 'Gagal';
            return '<tr><td><span class="table-main">' + escapeHtml(transaction.code) + '</span></td><td>' + formatDate(transaction.created_at) + '</td>' +
                '<td>' + items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) + ' item</td><td>' + (transaction.payment_method === 'qris' ? 'QRIS' : 'Tunai') + '</td>' +
                '<td class="table-main">' + money(transaction.total) + '</td><td><span class="status ' + statusClass + '">' + statusLabel + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
}

function transactionsView(transactions) {
    return '<section class="panel"><div class="section-heading"><div><h2>Riwayat transaksi</h2><p>' + transactions.length + ' transaksi tercatat</p></div></div>' + transactionTable(transactions) + '</section>';
}

function salesView() {
    const productsHtml = state.products.length ? state.products.map(product => {
        const variants = parseVariants(product.variants);
        return '<article class="sell-card"><div class="product-top"><div><h3>' + escapeHtml(product.name) + '</h3><div class="product-category">' + escapeHtml(product.category || 'Umum') + '</div></div>' +
            '<span class="stock-badge">' + Number(product.stock) + ' stok</span></div><div class="variant-actions">' +
            variants.map((variant, index) => '<button class="variant-action" type="button" data-add-product="' + Number(product.id) + '" data-variant-index="' + index + '">' +
                '<span>' + escapeHtml(variant.name) + '</span><span>' + money(variant.price) + '</span></button>').join('') +
            '</div></article>';
    }).join('') : '<div class="empty-state">Belum ada produk. Minta owner menambahkan produk.</div>';

    const cartHtml = state.cart.length ? state.cart.map((item, index) =>
        '<div class="cart-line"><div><div class="cart-line-name">' + escapeHtml(item.product_name) + '</div><div class="cart-line-detail">' + escapeHtml(item.variant) + ' · ' + money(item.price) + '</div></div>' +
        '<div class="cart-controls"><button class="step-button" type="button" data-cart-action="minus" data-cart-index="' + index + '" aria-label="Kurangi jumlah">−</button>' +
        '<span class="cart-qty">' + item.quantity + '</span><button class="step-button" type="button" data-cart-action="plus" data-cart-index="' + index + '" aria-label="Tambah jumlah">+</button>' +
        '<button class="step-button" type="button" data-cart-action="remove" data-cart-index="' + index + '" aria-label="Hapus dari keranjang">×</button></div></div>'
    ).join('') : '<div class="empty-state">Keranjang masih kosong.</div>';

    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return '<div class="sales-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Pilih produk</h2><p class="muted">Pilih harga untuk menambahkan ke keranjang.</p></div></div>' +
        '<div class="sales-products">' + productsHtml + '</div></section><aside class="cart-card"><div class="panel-head"><div><h2 class="panel-title">Keranjang</h2><p class="muted">' + state.cart.reduce((sum, item) => sum + item.quantity, 0) + ' item</p></div></div>' +
        '<div class="cart-list">' + cartHtml + '</div><div class="cart-total"><span>Total belanja</span><strong>' + money(total) + '</strong></div>' +
        '<form id="checkout-form"><div class="field"><label for="payment-method">Metode pembayaran</label><select id="payment-method" name="payment_method"><option value="cash">Tunai</option><option value="qris">QRIS</option></select></div>' +
        '<button class="primary full" type="submit"' + (state.cart.length ? '' : ' disabled') + '>Buat transaksi</button></form></aside></div>';
}

function cashiersView(cashiers) {
    const rows = cashiers.length ? '<div class="cashier-list">' + cashiers.map(cashier =>
        '<div class="cashier-row"><div><div class="cashier-name">' + escapeHtml(cashier.name) + '</div><div class="cashier-user">Username: ' + escapeHtml(cashier.username) + '</div></div><span class="role-pill">Kasir</span></div>'
    ).join('') + '</div>' : '<div class="empty-state">Belum ada akun kasir.</div>';

    return '<div class="sales-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Tambah akun kasir</h2><p class="muted">Kasir dapat membuat transaksi dan melihat stok.</p></div></div>' +
        '<form id="cashier-form"><div class="field"><label for="cashier-name">Nama kasir</label><input id="cashier-name" name="name" required></div>' +
        '<div class="field"><label for="cashier-username">Username</label><input id="cashier-username" name="username" pattern="[A-Za-z0-9_.-]+" required></div>' +
        passwordField('Password sementara · minimal 8 karakter', 'password', { id: 'cashier-password', minlength: 8 }) +
        '<button class="primary" type="submit">Buat akun kasir</button></form></section>' +
        '<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Kasir terdaftar</h2><p class="muted">' + cashiers.length + ' akun</p></div></div>' + rows + '</section></div>';
}

function bindProductForm() {
    const form = document.querySelector('#product-form');
    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await api('/products', {
                method: 'POST',
                body: JSON.stringify({
                    name: data.name,
                    category: data.category || 'Umum',
                    stock: Number(data.stock),
                    low_stock_at: Number(data.low_stock_at || 0),
                    variants: [{ name: data.variant, price: Number(data.price) }],
                }),
            });
            showToast('Produk berhasil disimpan.');
            await navigate('products');
        } catch (error) {
            showToast(error.message);
            button.disabled = false;
        }
    });
}

function bindCashierForm() {
    const form = document.querySelector('#cashier-form');
    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const data = Object.fromEntries(new FormData(form));
            await api('/cashiers', { method: 'POST', body: JSON.stringify(data) });
            showToast('Akun kasir berhasil dibuat.');
            await navigate('cashiers');
        } catch (error) {
            showToast(error.message);
            button.disabled = false;
        }
    });
}

function bindSales() {
    document.querySelectorAll('[data-add-product]').forEach(button => {
        button.addEventListener('click', () => {
            const product = state.products.find(item => Number(item.id) === Number(button.dataset.addProduct));
            const variant = parseVariants(product?.variants)[Number(button.dataset.variantIndex)];
            if (!product || !variant) return;
            const existing = state.cart.find(item => item.product_id === Number(product.id) && item.variant === variant.name);
            if (existing) existing.quantity += 1;
            else state.cart.push({
                product_id: Number(product.id),
                product_name: product.name,
                variant: variant.name,
                price: Number(variant.price),
                quantity: 1,
            });
            showContent('sales', salesView());
        });
    });

    document.querySelectorAll('[data-cart-action]').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.cartIndex);
            const item = state.cart[index];
            if (!item) return;
            if (button.dataset.cartAction === 'plus') item.quantity += 1;
            if (button.dataset.cartAction === 'minus') item.quantity -= 1;
            if (button.dataset.cartAction === 'remove' || item.quantity <= 0) state.cart.splice(index, 1);
            showContent('sales', salesView());
        });
    });

    const form = document.querySelector('#checkout-form');
    form?.addEventListener('submit', async event => {
        event.preventDefault();
        if (!state.cart.length) return;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const result = await api('/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    payment_method: form.elements.payment_method.value,
                    items: state.cart.map(item => ({
                        product_id: item.product_id,
                        variant: item.variant,
                        quantity: item.quantity,
                    })),
                }),
            });
            state.cart = [];
            await navigate('sales');
            if (result.status === 'pending') showQrDialog(result);
            else showToast('Transaksi ' + result.code + ' berhasil.');
        } catch (error) {
            showToast(error.message);
            button.disabled = false;
        }
    });
}

function showQrDialog(transaction) {
    const qr = transaction.qr_code_url ?
        '<img src="' + escapeHtml(transaction.qr_code_url) + '" alt="QRIS pembayaran">' :
        '<p class="muted">QRIS dibuat, tetapi kode QR belum tersedia.</p>';
    dialog.innerHTML = '<h2>Menunggu pembayaran QRIS</h2><p class="dialog-copy">Pindai kode QR untuk menyelesaikan transaksi.</p>' +
        '<div class="qr-result">' + qr + '<strong>' + money(transaction.total) + '</strong><span>' + escapeHtml(transaction.code) + '</span></div>' +
        '<div class="dialog-actions"><button class="primary" id="dialog-close" type="button">Selesai</button></div>';
    dialog.showModal();
    document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
}

function openPasswordDialog() {
    dialog.innerHTML = '<h2>Ubah password</h2><p class="dialog-copy">Masukkan password saat ini dan password baru minimal 8 karakter.</p>' +
        '<form id="password-form">' +
        passwordField('Password saat ini', 'current_password', { id: 'current-password', autocomplete: 'current-password' }) +
        passwordField('Password baru', 'password', { id: 'new-password', minlength: 8 }) +
        passwordField('Konfirmasi password baru', 'password_confirmation', { id: 'confirm-password', minlength: 8 }) +
        '<div class="dialog-actions"><button class="secondary" id="password-cancel" type="button">Batal</button><button class="primary" type="submit">Simpan password</button></div></form>';
    dialog.showModal();
    bindPasswordToggles(dialog);
    document.querySelector('#password-cancel').addEventListener('click', () => dialog.close());
    document.querySelector('#password-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const result = await api('/password', {
                method: 'PATCH',
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
            });
            state.token = result.token;
            localStorage.setItem('pos_token', state.token);
            dialog.close();
            showToast(result.message);
        } catch (error) {
            showToast(error.message);
            button.disabled = false;
        }
    });
}

async function logout() {
    try {
        await api('/logout', { method: 'POST' });
    } catch {}
    clearSession();
    state.cart = [];
    showLogin();
}

function showFatal(title, detail) {
    app.innerHTML = '<main class="fatal-screen"><section class="auth-card"><div class="brand-lockup"><span class="brand-mark">P</span><span>POS Pintar</span></div>' +
        '<h2>' + escapeHtml(title) + '</h2><p class="auth-subtitle">' + escapeHtml(detail || 'Terjadi kesalahan saat memuat halaman.') + '</p>' +
        '<button class="primary full" id="retry-boot" type="button">Coba lagi</button><button class="secondary full" style="margin-top:9px" id="back-to-login" type="button">Kembali ke login</button></section></main>';
    document.querySelector('#retry-boot').addEventListener('click', boot);
    document.querySelector('#back-to-login').addEventListener('click', () => {
        clearSession();
        showLogin();
    });
}

async function boot() {
    if (!state.token) {
        showLogin();
        return;
    }
    try {
        state.user = await api('/me');
        await navigate(state.user.role === 'cashier' ? 'sales' : 'dashboard');
    } catch (error) {
        if (error.status === 401) {
            clearSession();
            showLogin('Sesi berakhir. Silakan masuk kembali.');
        } else {
            showFatal('Aplikasi belum dapat dimuat', error.message);
        }
    }
}

boot();
