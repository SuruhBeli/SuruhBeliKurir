// 🔥 GLOBAL CACHE + LISTENER
window.TUGAS_CACHE = {
  aktif: [],
  selesai: []
};

window.LISTENERS = window.LISTENERS || {};

// ===== INIT =====
window.initTugas = function () {
  if (!window.currentUser) return;

  console.log("🔥 initTugas");

  window.currentTabTugas = "aktif";

  startListenerTugas();
  initTabListenerTugas();
  renderTugas();
};

// ===== LISTENER =====
function startListenerTugas() {

  if (window.LISTENERS.tugasAktif || window.LISTENERS.tugasSelesai) return;

  // AKTIF
  window.LISTENERS.tugasAktif = window.db.collection("orders")
    .where("kurir", "==", window.currentUser.uid)
    .where("status", "==", "Diproses")
    .onSnapshot(snapshot => {
      window.TUGAS_CACHE.aktif = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));

      if (window.currentTabTugas === "aktif") renderTugas();
    });

  // SELESAI
  window.LISTENERS.tugasSelesai = window.db.collection("orders")
    .where("kurir", "==", window.currentUser.uid)
    .where("status", "==", "Selesai")
    .onSnapshot(snapshot => {
      window.TUGAS_CACHE.selesai = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));

      if (window.currentTabTugas === "selesai") renderTugas();
    });
}

// ===== RENDER =====
function renderTugas() {
  const container = document.getElementById("ordersContainerTugas");
  const empty = document.getElementById("emptyOrdersTugas");

  if (!container) return;

  const list = window.TUGAS_CACHE[window.currentTabTugas];

  container.innerHTML = "";

  if (!list || list.length === 0) {
    container.style.display = "none";
    empty.style.display = "flex";
    return;
  }

  container.style.display = "block";
  empty.style.display = "none";

  list.forEach(item => {
    const { id, data } = item;

    const card = document.createElement("div");
    card.classList.add("order-card");

    card.innerHTML = `
      <img src="https://i.pravatar.cc/50?u=${id}">
      
      <div class="order-content">
        <div class="order-info">
          <div class="layanan">${data.layanan || "-"}</div>
          <div class="beliDi ${data.tokoId ? 'clickable' : ''}">
            ${data.beliDi || "-"}
          </div>
        </div>
    
        <div class="order-actions"></div>
      </div>
    `;
    // 🔥 HANDLE CLICK BELI DI
    if (data.tokoId && data.lat && data.lng) {
      const beliDiEl = card.querySelector(".beliDi");
    
      beliDiEl.onclick = (e) => {
        e.stopPropagation();
    
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`
        );
      };
    }
    const actions = card.querySelector(".order-actions");

    // ===== BUTTON =====
    if (window.currentTabTugas === "aktif") {

      const btnSelesai = document.createElement("button");
      btnSelesai.classList.add("btn-selesai");
      btnSelesai.innerText = "Selesai";
      btnSelesai.onclick = (e) => {
        e.stopPropagation();
        showConfirmTugas(id);
      };

      const btnChat = document.createElement("button");
      btnChat.classList.add("btn-chat");
      btnChat.innerText = "Chat";
      btnChat.onclick = (e) => {
        e.stopPropagation();
        openChatRoom(data, id);
      };

      actions.appendChild(btnChat);
      actions.appendChild(btnSelesai);
    }

    card.onclick = () => showDetailTugas(id, data);

    container.appendChild(card);
  });
}

// ===== TAB =====
function initTabListenerTugas() {
  document.querySelectorAll("#view-tugas .tab").forEach(tab => {
    tab.onclick = () => {

      document.querySelectorAll("#view-tugas .tab")
        .forEach(t => t.classList.remove("active"));

      tab.classList.add("active");

      window.currentTabTugas = tab.dataset.tab;

      renderTugas();
    };
  });
}

// ===== CONFIRM =====
function showConfirmTugas(orderId) {
  const popup = document.getElementById("confirmPopupTugas");
  const ok = document.getElementById("confirmOkTugas");
  const cancel = document.getElementById("confirmCancelTugas");
  const text = document.getElementById("confirmTextTugas");

  text.innerText = "Selesaikan tugas ini?";
  popup.classList.add("show");

  cancel.onclick = () => popup.classList.remove("show");

  ok.onclick = async () => {
    popup.classList.remove("show");

    const loading = document.getElementById("loadingPopupTugas");
    const loadingText = document.getElementById("loadingTextTugas");

    loadingText.innerText = "Updating...";
    loading.classList.add("show");

    try {
      await window.db.collection("orders").doc(orderId).update({
        status: "Selesai",
        selesaiAt: new Date()
      });

      loadingText.innerText = "Berhasil!";
      setTimeout(() => loading.classList.remove("show"), 800);

    } catch (e) {
      loading.classList.remove("show");
      alert("Gagal update");
    }
  };
}

// ===== DETAIL POPUP (STRUK STYLE) =====
function showDetailTugas(id, data) {
  const popup = document.getElementById("orderPopupTugas");
  const content = document.getElementById("popupContentTugas");
  const btn = document.getElementById("btnClosePopupTugas");

  const createdAt = data.createdAt?.toDate
    ? data.createdAt.toDate()
    : new Date();

  content.innerHTML = `
    <div class="receipt-header">
      <img src="logo.png" class="receipt-logo">
      <div class="receipt-title">SuruhBeli</div>
      <div class="receipt-sub">Struk Pesanan Digital</div>
    </div>

    <div class="row">
      <span class="label">ID Pesanan</span>
      <span class="value">#${id.slice(0,6)}</span>
    </div>

    <div class="row">
      <span class="label">Waktu</span>
      <span class="value">${createdAt.toLocaleString("id-ID")}</span>
    </div>

    <div class="dash"></div>

    <div class="row">
      <span class="label">Layanan</span>
      <span class="value">${data.layanan || "-"}</span>
    </div>

    <div class="row">
      <span class="label">Pesanan</span>
      <span class="value">${data.pesanan || "-"}</span>
    </div>

    <div class="row">
      <span class="label">Beli di</span>
      <span class="value ${data.tokoId ? 'clickable' : ''}" id="popupBeliDi">
        ${data.beliDi || "-"}
      </span>
    </div>

    <div class="row">
      <span class="label">Catatan</span>
      <span class="value">${data.catatan || "-"}</span>
    </div>

    <div class="dash"></div>

    <div class="row">
      <span class="label">Status</span>
      <span class="value">${getStatusBadge(data.status)}</span>
    </div>

    <div class="receipt-footer">
      Terima kasih telah menggunakan SuruhBeli
    </div>
  `;
  // 🔥 CLICK BELI DI DI POPUP
  if (data.tokoId && data.lat && data.lng) {
    const el = document.getElementById("popupBeliDi");
  
    el.onclick = () => {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`
      );
    };
  }
  popup.classList.add("show");

  if (window.currentTabTugas === "aktif") {
    btn.innerText = "Antarkan";
    btn.onclick = () => {
      if (data.lat && data.lng) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`);
      } else {
        alert("Lokasi tidak ada");
      }
    };
  } else {
    btn.innerText = "Tutup";
    btn.onclick = () => popup.classList.remove("show");
  }
}

// ===== STATUS BADGE =====
function getStatusBadge(status){
  if(status === "Diproses") return `<span class="status-badge badge-proses">${status}</span>`;
  if(status === "Selesai") return `<span class="status-badge badge-selesai">${status}</span>`;
  if(status === "Gagal") return `<span class="status-badge badge-gagal">${status}</span>`;
  return status || "-";
}

// ====== CHAT =====
async function openChatRoom(data, orderId) {
  const loading = document.getElementById("loadingPopupTugas");
  const loadingText = document.getElementById("loadingTextTugas");

  loadingText.innerText = "Loading chat...";
  loading.classList.add("show");

  try {
    const userId = data.userId;
    const kurirId = window.currentUser.uid;

    if (!userId) {
      alert("Data user belum siap. Silakan coba sebentar lagi.");
      loading.classList.remove("show");
      return;
    }

    // 🔥 Cari / buat room
    const existingQuery = await window.db.collection("chatRooms")
      .where(`participants.${kurirId}`, "==", true)
      .where(`participants.${userId}`, "==", true)
      .limit(1)
      .get();

    let roomRef;

    if (!existingQuery.empty) {
      roomRef = existingQuery.docs[0].ref;
    } else {
      roomRef = await window.db.collection("chatRooms").add({
        participants: {
          [kurirId]: true,
          [userId]: true
        },
        orderId,
        createdAt: new Date()
      });
    }

    const roomId = roomRef.id;

    // 🔥 set global
    window.activeRoomId = roomId;

    // 🔥 dispatch event (INI KUNCI BIAR CHAT KELOAD)
    window.dispatchEvent(new CustomEvent("goto-chatRoom", {
      detail: {
        roomId: roomId,
        participants: {
          [kurirId]: true,
          [userId]: true
        }
      }
    }));

    // 🔥 pindah view dulu
    showView("chatRoom");

    // 🔥 delay dikit biar DOM siap + listener ga tabrakan
    setTimeout(async () => {
      if (window.initChatRoomView) {
        await window.initChatRoomView(roomId);
      }
    }, 50);

    loading.classList.remove("show");

  } catch (e) {
    console.error("openChatRoom error:", e);
    loading.classList.remove("show");
    alert("Gagal membuka chat");
  }
}

// ===== CLOSE POPUP =====
document.addEventListener("click", (e) => {
  if (e.target.id === "orderPopupTugas") {
    e.target.classList.remove("show");
  }
});