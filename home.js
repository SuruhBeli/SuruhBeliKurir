// ===== INIT HOME ===== //
window.initHome = function() {
  if (!window.currentUser) return;

  console.log("🔥 initHome (sekali saja)");

  listenOrdersHome();
};

// ===== REALTIME LISTENER ===== //
function listenOrdersHome() {
  const ordersContainer = document.getElementById("ordersContainer");
  const emptyOrders = document.getElementById("emptyOrders");
  const summaryCard = document.getElementById("summaryCard");
  const headerFoto = document.getElementById("headerFoto");

  if (!ordersContainer || !emptyOrders || !summaryCard) return;

  headerFoto.src = "header.png";

  if (!window.USER_CACHE) window.USER_CACHE = {};

  // 🔥 Stop listener lama biar ga dobel
  if (window.LISTENERS?.home) {
    window.LISTENERS.home();
  }

  window.LISTENERS.home = window.db.collection("orders")
    .where("status", "==", "Dibuat")
    .orderBy("createdAt", "desc")
    .limit(5)
    .onSnapshot(async snapshot => {

      ordersContainer.innerHTML = "";

      if (snapshot.empty) {
        ordersContainer.style.display = "none";
        emptyOrders.style.display = "flex";
        summaryCard.innerText = "Belum ada pesanan masuk";
        return;
      }

      ordersContainer.style.display = "block";
      emptyOrders.style.display = "none";
      summaryCard.innerText = `Pesanan terbaru: ${snapshot.size}`;

      const orders = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        let fotoSrc = "https://via.placeholder.com/50/FB923C/ffffff?text=U";

        if (data.userId) {
          if (window.USER_CACHE[data.userId]) {
            return { docId: doc.id, data, fotoSrc: window.USER_CACHE[data.userId] };
          }

          try {
            const userDoc = await window.db.collection("users").doc(data.userId).get();

            if (userDoc.exists) {
              const userData = userDoc.data();

              if (userData.fotoProfil) {
                fotoSrc = userData.fotoProfil;
              } else if (userData.nama) {
                const inisial = userData.nama.split(" ")
                  .map(n => n[0].toUpperCase())
                  .join("");

                fotoSrc = `https://via.placeholder.com/50/FB923C/ffffff?text=${encodeURIComponent(inisial)}`;
              }
            }

            window.USER_CACHE[data.userId] = fotoSrc;

          } catch (e) {
            console.error("User fetch error:", e);
          }
        }

        return { docId: doc.id, data, fotoSrc };
      }));

      // ===== RENDER ===== //
      orders.forEach(({ docId, data, fotoSrc }) => {
        const card = document.createElement("div");
        card.classList.add("order-card");

        card.innerHTML = `
          <img class="order-avatar" src="${fotoSrc}">
          <div class="order-info">
            <div class="judul">${data.judul || "Pesanan Baru"}</div>
            <div class="layanan">${data.layanan || "-"}</div>
          </div>
        `;

        // 🔥 BUTTON LOKASI
        const btnLokasi = document.createElement("button");
        btnLokasi.classList.add("btn-lokasi");
        btnLokasi.innerText = "Cek Lokasi";

        btnLokasi.onclick = (e) => {
          e.stopPropagation();
          if (data.lat && data.lng) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`);
          } else {
            window.PopupManager.showAlert("Lokasi belum tersedia!");
          }
        };

        card.appendChild(btnLokasi);

        // ===== CLICK CARD ===== //
        card.onclick = () => {
          window.selectedOrderId = docId;
          window.selectedOrderData = data;

          const btnAmbil = document.getElementById("btnAmbil");

          // 🔥 RESET EVENT
          btnAmbil.onclick = null;

          // ===== EVENT AMBIL ===== //
          btnAmbil.onclick = async () => {
            console.log("🔥 tombol diklik");

            if (!window.selectedOrderId || !window.currentUser) return;

            const loading = document.getElementById("loadingPopup");
            const loadingText = document.getElementById("loadingText");

            loadingText.innerText = "Sedang memproses...";
            loading.classList.add("show");

            try {
              const kurirDoc = await window.db.collection("kurir").doc(window.currentUser.uid).get();
              if (!kurirDoc.exists) throw new Error("Data kurir tidak ditemukan!");

              const noKurir = kurirDoc.data().noHP || "";

              const orderRef = window.db.collection("orders").doc(window.selectedOrderId);
              const orderDoc = await orderRef.get();
              if (!orderDoc.exists) throw new Error("Order tidak ditemukan!");

              const orderData = orderDoc.data();

              if (orderData.kurir && orderData.kurir !== window.currentUser.uid) {
                throw new Error("Order sudah diambil kurir lain!");
              }

              const updatePayload = {};

              if (!orderData.kurir) {
                updatePayload.kurir = window.currentUser.uid;
                updatePayload.status = "Diproses";
                updatePayload.noKurir = noKurir;
              }

              await orderRef.update(updatePayload);

              console.log("✅ ORDER BERHASIL DIAMBIL");

              loadingText.innerText = "Pesanan berhasil diambil!";

              setTimeout(() => {
                loading.classList.remove("show");
                document.getElementById("orderPopup").classList.remove("show");
                window.location.hash = "tugas";
              }, 800);

            } catch (e) {
              console.error("❌ Ambil error:", e);
              loadingText.innerText = e.message || "Gagal mengambil pesanan!";
              setTimeout(() => loading.classList.remove("show"), 2000);
            }
          };

          // ===== STATE BUTTON ===== //
          if (data.kurir && data.kurir !== window.currentUser.uid) {
            btnAmbil.disabled = true;
            btnAmbil.innerText = "Sudah diambil kurir lain";
          } else if (data.kurir === window.currentUser.uid) {
            btnAmbil.disabled = true;
            btnAmbil.innerText = "Anda mengambil order ini";
          } else {
            btnAmbil.disabled = false;
            btnAmbil.innerText = "Ambil Pesanan";
          }

          // ===== SET POPUP ===== //
          document.getElementById("popupJudul").innerText = data.layanan || "-";
          document.getElementById("popupPesanan").innerText = data.pesanan || "-";
          document.getElementById("popupCatatan").innerText = data.catatan || "-";
          document.getElementById("popupBeliDi").innerText = data.beliDi || "-";

          document.getElementById("orderPopup").classList.add("show");
        };

        ordersContainer.appendChild(card);
      });

    }, err => {
      console.error("❌ Listener home error:", err);
      summaryCard.innerText = "Gagal memuat data";
    });
}

// ===== CLOSE POPUP ===== //
document.getElementById("orderPopup").addEventListener("click", e => {
  if (e.target.id === "orderPopup") {
    e.target.classList.remove("show");
  }
});