const DEFAULT_IMAGE = "https://via.placeholder.com/120?text=G%C3%B6rsel+Yok";

// Firebase'i import et
// <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>
// <script src="firebase-init.js"></script>

// Ürünleri Firestore'dan çek
async function loadProductsFromFirestore() {
    const snapshot = await db.collection('products').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// products dizisini güncelle
let products = [];

// Favoriler
async function getFavorites() {
    const user = getCurrentUser();
    if (!user) return [];
    const doc = await db.collection('favorites').doc(user.uid).get();
    return doc.exists ? doc.data().productIds || [] : [];
}
async function setFavorites(favs) {
    const user = getCurrentUser();
    if (!user) return;
    await db.collection('favorites').doc(user.uid).set({ productIds: favs });
}
async function toggleFavorite(productId) {
    let favs = await getFavorites();
    if (favs.includes(productId)) {
        favs = favs.filter(f => f !== productId);
        showToast("Favorilerden çıkarıldı");
    } else {
        favs.push(productId);
        showToast("Favorilere eklendi");
    }
    await setFavorites(favs);
    renderProducts(lastFilterCategory, lastSearchTerm);
}

// Toast notification
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Ürün ekle (admin panelinden) - Firestore
async function addProduct(product) {
    if (!product.stock) product.stock = 10;
    if (!product.comments) product.comments = [];
    if (!product.rating) product.rating = 5;
    if (!product.description) product.description = "Çok şık ve kaliteli bir ürün!";
    // Firestore'daki "products" koleksiyonuna ekle
    await db.collection('products').add(product);
    products = await loadProductsFromFirestore();
    renderProducts(lastFilterCategory, lastSearchTerm); // Ekleme sonrası tek render
}

// Ürün sil (admin panelinden) - Firestore
async function deleteProduct(productId) {
    await db.collection('products').doc(productId).delete();
    products = await loadProductsFromFirestore();
    renderProducts(lastFilterCategory, lastSearchTerm); // Silme sonrası tek render
}

// Favoriler modalı
async function renderFavoritesModal() {
    const favs = await getFavorites();
    const favList = document.getElementById('favorites-list');
    if (favs.length === 0) {
        favList.innerHTML = "<p>Favori ürününüz yok.</p>";
        return;
    }
    favList.innerHTML = favs.map(id => {
        const p = products.find(pr => pr.id === id);
        if (!p) return '';
        const disabled = p.stock === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '';
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <img src="${p.image}" style="width:48px;height:48px;border-radius:50%;">
            <span>${p.name}</span>
            <span style="margin-left:auto;">${p.price} TL</span>
            <button class="fav-add-to-cart-btn" data-id="${p.id}" ${disabled} style="margin-left:10px;padding:4px 12px;border-radius:8px;background:#bfae9e;color:#fff;border:none;cursor:pointer;">Sepete Ekle</button>
        </div>`;
    }).join('');
    // Favoriler modalında sepete ekle butonları
    document.querySelectorAll('.fav-add-to-cart-btn').forEach(btn => {
        btn.onclick = function() {
            addToCart(this.getAttribute('data-id'));
        };
    });
}

// Profil modalı
async function renderProfileModal() {
    const user = getCurrentUser();
    const info = document.getElementById('profile-info');
    if (!user) {
        info.innerHTML = "<p>Giriş yapmalısınız.</p>";
        return;
    }
    info.innerHTML = `<b>Ad Soyad:</b> ${user.name}<br><b>E-posta:</b> ${user.email}`;
    // Sipariş geçmişi
    const history = await getOrderHistory();
    const historyDiv = document.getElementById('order-history');
    if (!history || history.length === 0) {
        historyDiv.innerHTML = "<p>Henüz siparişiniz yok.</p>";
    } else {
        historyDiv.innerHTML = history.map(o =>
            `<div style="margin-bottom:8px;">
                <b>${o.date}</b> - Toplam: ${o.total} TL
                <ul style="margin:0 0 0 16px;">
                    ${o.items.map(it => `<li>${it.name} x ${it.qty}</li>`).join('')}
                </ul>
            </div>`
        ).join('');
    }
}

// Admin panel modalı (demo)
function renderAdminPanel() {
    const panel = document.getElementById('admin-panel');
    // Ürün ekleme formu (görsel dosyası yerine link)
    panel.innerHTML = `
        <h3>Yeni Ürün Ekle</h3>
        <form id="admin-add-product-form" style="margin-bottom:18px;">
            <input type="text" id="admin-product-name" placeholder="Ürün Adı" required>
            <input type="number" id="admin-product-price" placeholder="Fiyat" required>
            <input type="text" id="admin-product-image-link" placeholder="Görsel Linki (https://...)" required>
            <input type="text" id="admin-product-category" placeholder="Kategori" required>
            <input type="number" id="admin-product-stock" placeholder="Stok" min="0" required>
            <button type="submit">Ekle</button>
        </form>
        <h3>Ürünler</h3>
        <div id="admin-products-list"></div>
    `;
    // Ürünleri listele
    const listDiv = panel.querySelector('#admin-products-list');
    if (products.length === 0) {
        listDiv.innerHTML = "<p>Hiç ürün yok.</p>";
    } else {
        listDiv.innerHTML = products.map(p => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <img src="${p.image}" style="width:36px;height:36px;border-radius:6px;">
                <span>${p.name} (${p.category}) - ${p.price} TL - Stok: ${p.stock}</span>
                <button class="admin-delete-btn" data-id="${p.id}" style="margin-left:auto;background:#e57373;color:#fff;border:none;border-radius:4px;padding:2px 10px;cursor:pointer;">Sil</button>
            </div>
        `).join('');
    }
    // Ürün ekleme formu işlemleri (görsel linki ile)
    panel.querySelector('#admin-add-product-form').onsubmit = async function(e) {
        e.preventDefault();
        const name = panel.querySelector('#admin-product-name').value.trim();
        const price = Number(panel.querySelector('#admin-product-price').value);
        const image = panel.querySelector('#admin-product-image-link').value.trim();
        const category = panel.querySelector('#admin-product-category').value.trim();
        const stock = Number(panel.querySelector('#admin-product-stock').value);
        if (!name || !price || !image || !category) return;
        await addProduct({ name, price, image, category, stock });
        renderAdminPanel(); // Sadece paneli güncelle, renderProducts ÇAĞRILMAYACAK!
        showToast("Ürün eklendi!");
    };
    // Ürün silme işlemi
    panel.querySelectorAll('.admin-delete-btn').forEach(btn => {
        btn.onclick = async function() {
            if (confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
                await deleteProduct(this.getAttribute('data-id'));
                renderAdminPanel(); // Sadece paneli güncelle, renderProducts ÇAĞRILMAYACAK!
                showToast("Ürün silindi!");
            }
        };
    });
}

// Yorum ve puan ekleme
function addComment(productId, comment, rating, user) {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    p.comments.push({ user: user.name, comment, rating: Number(rating) });
    // Ortalama puan güncelle
    p.rating = Math.round(p.comments.reduce((sum, c) => sum + c.rating, 0) / p.comments.length);
}

// Ürün detay modalı güncellemesi
function openProductDetail(product) {
    document.getElementById('detail-image').src = product.image;
    document.getElementById('detail-name').textContent = product.name;
    document.getElementById('detail-category').textContent = product.category;
    document.getElementById('detail-price').textContent = product.price + " TL";
    document.getElementById('detail-description').textContent = product.description || "Ürün açıklaması bulunmamaktadır.";
    document.getElementById('detail-stock').innerHTML = `<b>Stok:</b> ${product.stock > 0 ? product.stock : '<span style="color:red">Tükendi</span>'}`;
    // Puan
    document.getElementById('detail-rating').innerHTML = "Puan: " + "★".repeat(product.rating || 5);
    // Yorumlar
    const commentsDiv = document.getElementById('detail-comments');
    if (product.comments.length === 0) {
        commentsDiv.innerHTML = "<p>Henüz yorum yok.</p>";
    } else {
        commentsDiv.innerHTML = product.comments.map(c =>
            `<div style="margin-bottom:6px;"><b>${c.user}:</b> ${c.comment} <span style="color:#e0c68d;">${"★".repeat(c.rating)}</span></div>`
        ).join('');
    }
    // Yorum formu
    const commentForm = document.getElementById('comment-form');
    commentForm.onsubmit = function(e) {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            showToast("Yorum yapmak için giriş yapmalısınız!");
            return;
        }
        const comment = document.getElementById('comment-input').value.trim();
        const rating = document.getElementById('rating-input').value;
        if (!comment) return;
        addComment(product.id, comment, rating, user);
        openProductDetail(product);
        showToast("Yorumunuz eklendi!");
        commentForm.reset();
    };
    document.getElementById('product-detail-modal').classList.add('active');
}
document.getElementById('close-product-detail').onclick = function() {
    document.getElementById('product-detail-modal').classList.remove('active');
};
window.addEventListener('click', function(event) {
    const modal = document.getElementById('product-detail-modal');
    if (event.target === modal) modal.classList.remove('active');
});

// Arama ve filtreleme için global değişkenler
let lastFilterCategory = "Tüm Ürünler";
let lastSearchTerm = "";

// Ürünleri filtrele ve göster (sıralama eklendi)
async function renderProducts(filterCategory = "Tüm Ürünler", searchTerm = "") {
    console.log("[DEBUG] renderProducts çağrıldı");
    products = await loadProductsFromFirestore();
    console.log("[DEBUG] Firestore'dan gelen ürün id'leri:", products.map(p => p.id));
    const productList = document.getElementById('product-list');
    // Sadece #product-list içindeki .product-card'ları temizle
    productList.querySelectorAll('.product-card').forEach(el => el.remove());
    lastFilterCategory = filterCategory;
    lastSearchTerm = searchTerm;
    let filteredProducts = products;

    // Kategori filtreleme: kategori tam eşleşme (alt menü bozulmaz)
    if (filterCategory && filterCategory !== "Tüm Ürünler") {
        filteredProducts = filteredProducts.filter(p =>
            p.category && p.category.toLowerCase() === filterCategory.toLowerCase()
        );
    }

    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    // Sıralama
    const sortVal = document.getElementById('sort-select')?.value;
    if (sortVal === "price-asc") filteredProducts.sort((a, b) => a.price - b.price);
    if (sortVal === "price-desc") filteredProducts.sort((a, b) => b.price - a.price);
    if (sortVal === "name-asc") filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortVal === "name-desc") filteredProducts.sort((a, b) => b.name.localeCompare(a.name));

    if (filteredProducts.length === 0) {
        productList.innerHTML = "<p>Bu kriterlere uygun ürün bulunamadı.</p>";
        return;
    }
    const favs = await getFavorites();
    filteredProducts.forEach(product => {
        const disabled = product.stock === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '';
        // Görsel URL'si yoksa veya boşsa varsayılan görsel kullan
        let imageUrl = (product.image && product.image.trim()) ? product.image.trim() : DEFAULT_IMAGE;
        let card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-id', product.id); // Her karta ürün id'si ekle
        card.innerHTML = `
            <button class="favorite-btn${favs.includes(product.id) ? ' favorited' : ''}" data-id="${product.id}" title="Favorilere ekle/çıkar">♥</button>
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}';">
            <h2 class="product-name" style="cursor:pointer;" data-id="${product.id}">${product.name}</h2>
            <p>${product.price} TL</p>
            <div style="font-size:0.95rem;color:#bfae9e;margin-bottom:6px;">Stok: ${product.stock > 0 ? product.stock : '<span style=\"color:red\">Tükendi</span>'}</div>
            <button class="add-to-cart-btn" data-id="${product.id}" ${disabled}>Sepete Ekle</button>
        `;
        productList.appendChild(card);
    });
    // Sadece ana ürün listesinde kaç ürün var?
    console.log("[DEBUG] product-card sayısı (sadece ana liste):", productList.querySelectorAll('.product-card').length);

    // Favori butonları
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            toggleFavorite(this.getAttribute('data-id'));
            // Favori butonunun görünümünü güncelle
            if (this.classList.contains('favorited')) {
                this.classList.remove('favorited');
            } else {
                this.classList.add('favorited');
            }
        };
    });

    // Ürün detay açma
    document.querySelectorAll('.product-name, .product-card img').forEach(el => {
        el.onclick = function() {
            const id = String(this.getAttribute('data-id')) || String(this.parentElement.querySelector('.favorite-btn').getAttribute('data-id'));
            const product = products.find(p => String(p.id) === id);
            if (product) openProductDetail(product);
        };
    });

    // Sepete ekle butonları
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            addToCart(this.getAttribute('data-id'));
        });
    });

    // Render sonrası, aynı id'ye sahip birden fazla .product-card var mı kontrol et
    const allCards = Array.from(document.querySelectorAll('#product-list .product-card'));
    const idCounts = allCards.reduce((acc, el) => {
        const id = el.getAttribute('data-id');
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});
    const dups = Object.entries(idCounts).filter(([id, count]) => count > 1);
    if (dups.length > 0) {
        console.warn('[DUPLICATE WARNING] Aynı id ile birden fazla .product-card bulundu:', dups);
    } else {
        console.log('[DUPLICATE CHECK] Her ürün DOM’da sadece bir kez var.');
    }
}

function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

function setCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function isLoggedIn() {
    return !!getCurrentUser();
}

function addToCart(productId) {
    if (!isLoggedIn()) {
        alert("Sepete ürün eklemek için giriş yapmalısınız!");
        return;
    }
    const id = String(productId); // Firestore id'leri string
    let cart = getCart();
    const found = cart.find(item => String(item.id) === id);
    const product = products.find(p => String(p.id) === id);
    if (!product || product.stock <= 0) {
        showToast("Stokta yok!");
        return;
    }
    if (found) {
        if (found.qty >= product.stock) {
            showToast("Stokta daha fazla yok!");
            return;
        }
        found.qty += 1;
    } else {
        cart.push({ id, qty: 1 });
    }
    setCart(cart);
    updateCartCount && updateCartCount();
    showToast("Ürün sepete eklendi!");
    // Sepete ekleme sonrası sepet modalını aç ve güncelle
    if (document.getElementById('cart-modal')) {
        renderCartModal();
        document.getElementById('cart-modal').classList.add('active');
    }
}

// Sepet sayacı fonksiyonu eksikse ekle
if (typeof updateCartCount !== 'function') {
    function updateCartCount() {
        // Eğer bir sepet sayacı varsa güncelle, yoksa atla
        // (isteğe bağlı: navbar'a sepet sayacı eklenebilir)
    }
}

// Kart formu modalını body'ye ekle (sadece bir kez)
if (!document.getElementById('card-form-overlay')) {
    const cardModalHtml = `
    <div id="card-form-overlay" style="display:none;position:fixed;z-index:9999;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);justify-content:center;align-items:center;">
        <div id="card-form-modal" style="background:#fff;padding:28px 22px 18px 22px;border-radius:14px;box-shadow:0 4px 32px #0002;max-width:350px;width:95vw;position:relative;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
                <h3 style="margin:0;font-size:1.2em;">Kart Bilgileri</h3>
                <span id="close-card-form" style="cursor:pointer;font-size:1.5em;line-height:1;">&times;</span>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <img src='https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg' alt='Visa' style='height:22px;'>
                <img src='https://upload.wikimedia.org/wikipedia/commons/0/0e/Mastercard-logo.png' alt='MasterCard' style='height:22px;'>
            </div>
            <form id="card-form" autocomplete="off">
                <div style="margin-bottom:10px;">
                    <label for="card-number" style="font-size:0.97em;">Kart Numarası</label>
                    <input type="text" id="card-number" placeholder="1234 5678 9012 3456" maxlength="19" required style="width:100%;padding:8px 10px;font-size:1em;border-radius:6px;border:1px solid #ccc;outline:none;" inputmode="numeric" pattern="[0-9 ]{19,19}">
                </div>
                <div style="display:flex;gap:8px;margin-bottom:10px;">
                    <div style="flex:1;">
                        <label for="card-expiry" style="font-size:0.97em;">Son Kullanma</label>
                        <input type="text" id="card-expiry" placeholder="AA/YY" maxlength="5" required style="width:100%;padding:8px 10px;font-size:1em;border-radius:6px;border:1px solid #ccc;outline:none;" inputmode="numeric" pattern="[0-9]{2}/[0-9]{2}">
                    </div>
                    <div style="flex:1;">
                        <label for="card-cvc" style="font-size:0.97em;">CVC</label>
                        <input type="text" id="card-cvc" placeholder="123" maxlength="4" required style="width:100%;padding:8px 10px;font-size:1em;border-radius:6px;border:1px solid #ccc;outline:none;" inputmode="numeric" pattern="[0-9]{3,4}">
                    </div>
                </div>
                <div style="margin-bottom:14px;">
                    <label for="card-name" style="font-size:0.97em;">Kart Üzerindeki İsim</label>
                    <input type="text" id="card-name" placeholder="Ad Soyad" required style="width:100%;padding:8px 10px;font-size:1em;border-radius:6px;border:1px solid #ccc;outline:none;" autocomplete="off">
                </div>
                <div id="card-error-msg" style="color:#e57373;font-size:0.98em;min-height:18px;margin-bottom:8px;"></div>
                <div style="text-align:right;">
                    <button type="button" id="cancel-card-form" style="margin-right:8px;padding:7px 18px;border-radius:7px;background:#eee;color:#444;border:none;cursor:pointer;font-size:1em;">İptal</button>
                    <button type="submit" style="padding:7px 18px;border-radius:7px;background:#bfae9e;color:#fff;border:none;cursor:pointer;font-size:1em;font-weight:bold;">Öde</button>
                </div>
            </form>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', cardModalHtml);
}

function renderCartModal() {
    const cart = getCart();
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalDiv = document.getElementById('cart-total');
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = "<p>Sepetiniz boş.</p>";
        cartTotalDiv.textContent = "";
        return;
    }
    let total = 0;
    cartItemsDiv.innerHTML = cart.map(item => {
        const product = products.find(p => String(p.id) === String(item.id));
        if (!product) return '';
        const itemTotal = product.price * item.qty;
        total += itemTotal;
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span>${product.name} x ${item.qty} <span style="color:#bfae9e;font-size:0.95em;">(Stok: ${product.stock})</span></span>
                <span>${itemTotal} TL</span>
                <button class="remove-cart-item-btn" data-id="${item.id}" style="margin-left:8px;">Kaldır</button>
            </div>
        `;
    }).join('');
    cartTotalDiv.innerHTML = `Toplam: ${total} TL <br>
        <button class="checkout-btn" id="checkout-btn">Siparişi Tamamla</button>`;

    // Kaldır butonları
    document.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
        btn.onclick = function() {
            removeFromCart(this.getAttribute('data-id'));
            renderCartModal();
            updateCartCount();
        };
    });

    // Checkout butonu
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.onclick = function() {
            // Kart formunu göster (overlay)
            const overlay = document.getElementById('card-form-overlay');
            if (overlay) overlay.style.display = 'flex';
            // Maskeler ve eventler
            const cardNumber = document.getElementById('card-number');
            const cardExpiry = document.getElementById('card-expiry');
            const cardCvc = document.getElementById('card-cvc');
            const cardName = document.getElementById('card-name');
            const cardError = document.getElementById('card-error-msg');
            // Kart numarası maskesi
            cardNumber.oninput = function() {
                let val = this.value.replace(/[^0-9]/g, '').slice(0,16);
                this.value = val.replace(/(.{4})/g,'$1 ').trim();
            };
            // Son kullanma maskesi
            cardExpiry.oninput = function() {
                let val = this.value.replace(/[^0-9]/g, '').slice(0,4);
                if (val.length > 2) val = val.slice(0,2) + '/' + val.slice(2);
                this.value = val;
            };
            // CVC maskesi
            cardCvc.oninput = function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0,4);
            };
            // Modal kapama (X ve iptal)
            document.getElementById('close-card-form').onclick = function() {
                overlay.style.display = 'none';
                document.getElementById('card-form').reset();
                cardError.textContent = '';
            };
            document.getElementById('cancel-card-form').onclick = function() {
                overlay.style.display = 'none';
                document.getElementById('card-form').reset();
                cardError.textContent = '';
            };
            // Modal dışında tıklama ile kapama
            overlay.onclick = function(e) {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                    document.getElementById('card-form').reset();
                    cardError.textContent = '';
                }
            };
            // Form submit
            const cardForm = document.getElementById('card-form');
            cardForm.onsubmit = async function(e) {
                e.preventDefault();
                cardError.textContent = '';
                // Validasyon
                const number = cardNumber.value.replace(/\s/g,'')
                const expiry = cardExpiry.value;
                const cvc = cardCvc.value;
                const name = cardName.value.trim();
                if (number.length !== 16) {
                    cardError.textContent = 'Kart numarası 16 haneli olmalı.';
                    return;
                }
                if (!/^\d{2}\/\d{2}$/.test(expiry)) {
                    cardError.textContent = 'Son kullanma tarihi AA/YY formatında olmalı.';
                    return;
                }
                if (cvc.length < 3) {
                    cardError.textContent = 'CVC en az 3 haneli olmalı.';
                    return;
                }
                if (!name) {
                    cardError.textContent = 'Kart üzerindeki isim zorunlu.';
                    return;
                }
                // Başarılı ise modalı kapat
                overlay.style.display = 'none';
                cardForm.reset();
                // Siparişi tamamla işlemi
                const cart = getCart();
                for (const item of cart) {
                    const product = products.find(p => String(p.id) === String(item.id));
                    if (product) {
                        product.stock = Math.max(0, product.stock - item.qty);
                        await updateProductStockInFirestore(product.id, product.stock);
                    }
                }
                const user = getCurrentUser();
                if (user) {
                    await addOrderHistory({
                        email: user.email,
                        date: new Date().toLocaleString(),
                        total: cart.reduce((sum, item) => {
                            const product = products.find(p => String(p.id) === String(item.id));
                            return sum + (product ? product.price * item.qty : 0);
                        }, 0),
                        items: cart.map(item => {
                            const product = products.find(p => String(p.id) === String(item.id));
                            return { name: product ? product.name : '', qty: item.qty };
                        })
                    });
                }
                showToast("Siparişiniz başarıyla alındı!");
                setCart([]);
                renderProducts(lastFilterCategory, lastSearchTerm);
                renderCartModal();
                updateCartCount();
            };
        };
    }
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => String(item.id) !== String(productId));
    setCart(cart);
}

function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}

function setUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

let currentUserData = null;
// Sepet kapatma düğmesi
document.addEventListener("DOMContentLoaded", function () {
  const cartCloseBtn = document.querySelector(".cart-close");
  if (cartCloseBtn) {
    cartCloseBtn.addEventListener("click", function () {
      document.getElementById("cart-modal").classList.remove("active");
    });
  }


    // Sepet dışında bir yere tıklanırsa kapansın
    window.addEventListener("click", function (event) {
        const modal = document.getElementById("cart-modal");
        if (event.target === modal) {
            modal.classList.remove("active");
        }
    });
});



function signInWithEmail(email, password) {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      return firebase.auth().signInWithEmailAndPassword(email, password);
    })
    .then((userCredential) => {
      console.log("[Firebase] Giriş başarılı:", userCredential.user.email);
    })
    .catch((error) => {
      console.error("[Firebase] Giriş hatası:", error);
    });
}

window.addEventListener('load', () => {
  // renderProducts burada çağrılmasın, sadece onAuthStateChanged içinde çağrılsın
  firebase.auth().onAuthStateChanged(async function(user) {
    console.log('[Firebase] onAuthStateChanged:', user ? 'Girişli' : 'Çıkış', user);

    const signupLink = document.getElementById('signup-link');
    const loginLink = document.getElementById('login-link');
    const userMenu = document.getElementById('user-menu');
    const userNameSpan = document.getElementById('user-name');
    const adminLink = document.getElementById('admin-link');
    const profileLink = document.getElementById('profile-link');

    if (user) {
      if (signupLink) signupLink.style.display = 'none';
      if (loginLink) loginLink.style.display = 'none';
      if (userMenu) userMenu.style.display = 'inline-block';
      if (userNameSpan) userNameSpan.textContent = user.displayName || user.email;
      if (user.email === 'admin@admin.com' && adminLink) adminLink.style.display = 'inline-block';
      if (profileLink) profileLink.style.display = 'inline-block';
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          currentUserData = {
            uid: user.uid,
            name: doc.data().name,
            email: user.email
          };
        } else {
          currentUserData = {
            uid: user.uid,
            name: user.displayName || "",
            email: user.email
          };
        }
      } catch (e) {
        console.error('[Firebase] Firestore kullanıcı verisi hatası:', e);
      }
    } else {
      if (signupLink) signupLink.style.display = 'inline-block';
      if (loginLink) loginLink.style.display = 'inline-block';
      if (userMenu) userMenu.style.display = 'none';
      if (adminLink) adminLink.style.display = 'none';
      if (profileLink) profileLink.style.display = 'none';
      if (userNameSpan) userNameSpan.textContent = '';
      currentUserData = null;
    }
    renderProducts?.(lastFilterCategory, lastSearchTerm);
  });
});

function getCurrentUser() {
  return currentUserData;
}

// Sipariş geçmişi için localStorage fonksiyonları EKLENDİ
async function addOrderHistory(order) {
    const user = getCurrentUser();
    if (!user) return;
    await db.collection('orders').add({ ...order, uid: user.uid });
}
async function getOrderHistory() {
    const user = getCurrentUser();
    if (!user) return [];
    const snapshot = await db.collection('orders').where('uid', '==', user.uid).get();
    return snapshot.docs.map(doc => doc.data());
}

document.addEventListener('DOMContentLoaded', function() {
    // renderProducts burada çağrılmasın! Sadece bir yerde çağrılsın
    const cartModal = document.getElementById('cart-modal');
    const closeCart = document.getElementById('close-cart');
    // Dropdown menü için JS
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    }

    // Modal açma/kapama ve form işlemleri
    const signupModal = document.getElementById('signup-modal');
    const loginModal = document.getElementById('login-modal');
    const signupLink = document.getElementById('signup-link');
    const loginLink = document.getElementById('login-link');
    const userMenu = document.getElementById('user-menu');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const userNameSpan = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    const profileLink = document.getElementById('profile-link');
    const favoritesLink = document.getElementById('favorites-link');
    const adminLink = document.getElementById('admin-link');
    const cartLinkDropdown = document.getElementById('cart-link-dropdown');

    // Kullanıcı menüsü aç/kapat
    userMenuBtn.onclick = function(e) {
        e.stopPropagation();
        userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.body.addEventListener('click', function() {
        userDropdown.style.display = 'none';
    });
    userDropdown.onclick = function(e) { e.stopPropagation(); };

    // Giriş/çıkış sonrası menü güncelle
    // function updateUserMenu() {...} // Sadece onAuthStateChanged içinde kullanılacak

    // Çıkış butonu
    logoutBtn.onclick = async function() {
        await logoutUser();
        userDropdown.style.display = 'none';
        // updateUserMenu() çağrısı kaldırıldı, çünkü onAuthStateChanged tetikleniyor
    };

    // Modal açma işlemleri (dropdown içinden)
    profileLink.onclick = async function(e) {
        e.preventDefault();
        await renderProfileModal();
        document.getElementById('profile-modal').style.display = 'block';
        userDropdown.style.display = 'none';
    };
    favoritesLink.onclick = async function(e) {
        e.preventDefault();
        await renderFavoritesModal();
        document.getElementById('favorites-modal').style.display = 'block';
        userDropdown.style.display = 'none';
    };
    adminLink.onclick = function(e) {
        e.preventDefault();
        renderAdminPanel();
        document.getElementById('admin-modal').style.display = 'block';
        userDropdown.style.display = 'none';
    };
    cartLinkDropdown.onclick = function(e) {
        e.preventDefault();
        if (!isLoggedIn()) {
            showToast("Sepeti görüntülemek için giriş yapmalısınız!");
            return;
        }
        renderCartModal();
        document.getElementById('cart-modal').classList.add('active');
        userDropdown.style.display = 'none';
    };

    // Üye Ol ve Giriş Yap linklerine tıklayınca modal aç
    signupLink.onclick = function(e) {
        e.preventDefault();
        signupModal.style.display = 'block';
    };
    loginLink.onclick = function(e) {
        e.preventDefault();
        loginModal.style.display = 'block';
    };

    // Modal kapatma butonları
    document.getElementById('close-signup').onclick = function() {
        signupModal.style.display = 'none';
    };
    document.getElementById('close-login').onclick = function() {
        loginModal.style.display = 'none';
    };

    // Modal dışında bir yere tıklanınca modalı kapat
    window.onclick = function(event) {
        if (event.target === signupModal) signupModal.style.display = 'none';
        if (event.target === loginModal) loginModal.style.display = 'none';
        if (event.target === document.getElementById('favorites-modal')) document.getElementById('favorites-modal').style.display = 'none';
        if (event.target === document.getElementById('profile-modal')) document.getElementById('profile-modal').style.display = 'none';
        if (event.target === document.getElementById('admin-modal')) document.getElementById('admin-modal').style.display = 'none';
    };

    // Giriş/çıkış işlemlerinden sonra menüyü güncelle
    document.getElementById('signup-form').onsubmit = async function(e) {
        e.preventDefault();
        const name = this.querySelector('input[type="text"]').value.trim();
        const email = this.querySelector('input[type="email"]').value.trim().toLowerCase();
        const password = this.querySelector('input[type="password"]').value;
        try {
            await signupUser(name, email, password);
            signupModal.style.display = 'none';
            signupLink.style.display = 'none';
            loginLink.style.display = 'none';
            userMenu.style.display = 'inline-block';
            userNameSpan.textContent = name;
            if (email === "admin@admin.com") document.getElementById('admin-link').style.display = 'inline-block';
            document.getElementById('profile-link').style.display = 'inline-block';
            // updateUserMenu(); // KALDIRILDI
            showToast("Kayıt başarılı!");
        } catch (err) {
            alert("Kayıt başarısız: " + (err.message || err));
        }
    };

    document.getElementById('login-form').onsubmit = async function(e) {
        e.preventDefault();
        const email = this.querySelector('input[type="email"]').value.trim().toLowerCase();
        const password = this.querySelector('input[type="password"]').value;
        try {
            // Firebase Auth ile giriş
            const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
            // Firestore'da users koleksiyonunda kontrol
            const userDoc = await db.collection('users').doc(cred.user.uid).get();
            if (!userDoc.exists) {
                // Kullanıcı Auth'ta var ama Firestore'da yoksa çıkış yap ve hata ver
                await firebase.auth().signOut();
                alert("Kullanıcı veritabanında bulunamadı!");
                return;
            }
            const userData = userDoc.data();
            // UI güncelle
            loginModal.style.display = 'none';
            signupLink.style.display = 'none';
            loginLink.style.display = 'none';
            userMenu.style.display = 'inline-block';
            userNameSpan.textContent = userData.name || cred.user.displayName || "";
            if (email === "admin@admin.com") document.getElementById('admin-link').style.display = 'inline-block';
            document.getElementById('profile-link').style.display = 'inline-block';
            // updateUserMenu(); // KALDIRILDI
            showToast("Giriş başarılı!");
        } catch (err) {
            alert("E-posta veya şifre hatalı!");
        }
    };

    // Oturum kontrolü (sayfa yenilendiğinde)
    // updateUserMenu(); // KALDIRILDI

    // Kategori ve alt kategori tıklama desteği (Takı menüsü açılır/kapanır, alt kategoriler filtreler)
    document.querySelectorAll('.categories a').forEach(link => {
        link.addEventListener('click', function(e) {
            // Eğer Takı ana menüsü ise sadece aç/kapat yap
            if (this.classList.contains('dropdown-toggle')) {
                e.preventDefault();
                this.parentElement.classList.toggle('open');
                return;
            }
            // Alt kategori veya diğer kategori ise filtre uygula
            e.preventDefault();
            // Aktif kategori vurgusu
            document.querySelectorAll('.categories a').forEach(l => l.classList.remove('active-category'));
            this.classList.add('active-category');
            // Kategori adını al
            const text = this.textContent.trim();
            lastFilterCategory = text;
            renderProducts(lastFilterCategory, document.getElementById('search-input').value);
        });
    });

    // Takı menüsü ve alt kategoriler için doğru açılır/kapanır ve filtreleme
    document.querySelectorAll('.categories .dropdown-toggle').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            this.parentElement.classList.toggle('open');
        });
    });

    // Sadece kategoriye tıklanınca filtre uygula (Takı ana menüsü hariç!)
    document.querySelectorAll('.categories > li > a:not(.dropdown-toggle), .categories .submenu a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Aktif kategori vurgusu
            document.querySelectorAll('.categories a').forEach(l => l.classList.remove('active-category'));
            this.classList.add('active-category');
            // Kategori adını al
            const text = this.textContent.trim();
            lastFilterCategory = text;
            renderProducts(lastFilterCategory, document.getElementById('search-input').value);
        });
    });

    // Sıralama değişince ürünleri güncelle
    var sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.onchange = function() {
            renderProducts(lastFilterCategory, document.getElementById('search-input').value);
        };
    }

    // Arama kutusu
    document.getElementById('search-input').addEventListener('input', function() {
        renderProducts(lastFilterCategory, this.value);
    });

    // Sepetim linki ve modal işlemleri
    const cartLink = document.querySelector('.navbar-right a[href="#"]:not([id])');
    if (cartModal && closeCart) {
        // Sepet modalı çarpı (kapat) butonunu tamamen kaldır
        if (closeCart) closeCart.remove();
        // Sepet modalı dışında bir yere tıklanınca kapat (her zaman çalışsın)
        if (cartModal) {
            cartModal.addEventListener('mousedown', function(event) {
                if (event.target === cartModal) {
                    cartModal.classList.remove('active');
                }
            });
        }
    }
    if (cartLink && cartModal && closeCart) {
        cartLink.onclick = function(e) {
            e.preventDefault();
            // Diğer açık modalları kapat
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            cartModal.classList.add('active');
            renderCartModal();
        };
    }

    // Sepet modalı dışında bir yere tıklanınca kapat (sadece dışına tıklama!)
    cartModal.addEventListener('mousedown', function(event) {
        if (event.target === cartModal) {
            cartModal.classList.remove('active');
        }
    });

    // Klasik modallar için window.onclick sadece bunları kapatsın!
    window.onclick = function(event) {
        // Sepet modalı hariç!
        if (event.target === signupModal) signupModal.style.display = 'none';
        if (event.target === loginModal) loginModal.style.display = 'none';
        if (event.target === document.getElementById('favorites-modal')) document.getElementById('favorites-modal').style.display = 'none';
        if (event.target === document.getElementById('profile-modal')) document.getElementById('profile-modal').style.display = 'none';
        if (event.target === document.getElementById('admin-modal')) document.getElementById('admin-modal').style.display = 'none';
    };

    // Favoriler modalı aç/kapat
    document.getElementById('favorites-link').onclick = async function(e) {
        e.preventDefault();
        await renderFavoritesModal();
        document.getElementById('favorites-modal').style.display = 'block';
    };
    document.getElementById('close-favorites').onclick = function() {
        document.getElementById('favorites-modal').style.display = 'none';
    };
    document.getElementById('profile-link').onclick = async function(e) {
        e.preventDefault();
        await renderProfileModal();
        document.getElementById('profile-modal').style.display = 'block';
    };
    document.getElementById('close-profile').onclick = function() {
        document.getElementById('profile-modal').style.display = 'none';
    };
    document.getElementById('admin-link').onclick = function(e) {
        e.preventDefault();
        renderAdminPanel();
        document.getElementById('admin-modal').style.display = 'block';
    };
    document.getElementById('close-admin').onclick = function() {
        document.getElementById('admin-modal').style.display = 'none';
    };

    // renderProducts() çağrısı kaldırıldı, sadece arayüz hazırlığı burada olmalı
});

// firebase.auth().onAuthStateChanged ... kısmı aşağıda zaten renderProducts çağırıyor
// Kayıt ol - Firestore'da sadece "users" koleksiyonuna ekle
async function signupUser(name, email, password) {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    // Sadece "users" koleksiyonuna ekle
    await db.collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        name: name,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
}

async function loginUser(email, password) {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    return cred.user;
}

// logoutUser fonksiyonu ekle
async function logoutUser() {
    await firebase.auth().signOut();
}