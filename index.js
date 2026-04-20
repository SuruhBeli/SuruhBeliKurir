
// ====== FIREBASE INIT (Hanya sekali) ======  //
if (!window.firebaseInitialized) {
  const firebaseConfig = {
    apiKey: "AIzaSyByQl0BXZoSMzrULUNA6l7UVFQjXmvsdJE",
    authDomain: "suruhbeli-e8ae8.firebaseapp.com",
    databaseURL: "https://suruhbeli-e8ae8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "suruhbeli-e8ae8",
    storageBucket: "suruhbeli-e8ae8.firebasestorage.app",
    messagingSenderId: "5783247867",
    appId: "1:5783247867:web:8f57e09a7dc4565378c95e",
    measurementId: "G-W68JP10CG9",
  };
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
  window.rtdb = firebase.database();
  window.firebaseInitialized = true;
  console.log("✅ Firebase initialized");
}

// ====== DOMS ====== //
const navItems = document.querySelectorAll('.nav-item');
const navCircle = document.getElementById('navCircle');
const app = document.getElementById('app');
const navbarBottom = document.querySelector('.navbar-bottom');
const navActiveCircle = document.querySelector('.nav-active-circle');

// ====== FLAG ====== //
let appStarted = false;
let spaInternalNav = false;
let authReadySent = false;
let activeView = null;
// ===== GLOBAL CACHE =====
window.APP_CACHE = {
  toko: null,
  desa: null,
  user: null,
};
window.roomId = null;

// 🔥 FUNCTION KIRIM UID KE ANDROID (ANTI GAGAL + RETRY)
function sendUidToAndroid(uid) {
  let retry = 0;

  const interval = setInterval(() => {

    console.log("⏳ Coba kirim UID ke Android...", retry);

    if (window.Android && typeof window.Android.setUserId === "function") {
      window.Android.setUserId(uid);
      console.log("✅ UID terkirim ke Android:", uid);
      clearInterval(interval);
    }

    retry++;
    if (retry > 20) {
      console.log("❌ Gagal kirim UID ke Android");
      clearInterval(interval);
    }

  }, 500);
}

// ====== AUTH (FINAL FIX NATIVE LOGIN) ======
firebase.auth().onAuthStateChanged(user => {

  if (!appStarted) {
    initApp();
  }

  // =========================
  // ✅ USER SUDAH LOGIN (VALID FIREBASE)
  // =========================
  if (user) {

    const uid = user.uid;
    const email = user.email || "";

    window.currentUser = {
      uid: uid,
      email: email,
      displayName: user.displayName || "User"
    };

    window.userId = uid;

    console.log("🔥 Firebase User Login:", uid);

    // 🔥 SIMPAN (opsional, buat cache saja)
    localStorage.setItem("realUid", uid);
    localStorage.setItem("realEmail", email);

    // 🔥 KIRIM UID KE ANDROID (FCM)
    setTimeout(() => {
      sendUidToAndroid(uid);
    }, 1000);

    // 🔥 HILANGKAN OVERLAY LOGIN
    if (typeof hideAuthOverlay === "function") {
      hideAuthOverlay();
    }

    // 🔥 EVENT READY
    window.dispatchEvent(
      new CustomEvent("user-ready", {
        detail: { currentUser: window.currentUser }
      })
    );

    if (!authReadySent) {
      authReadySent = true;
      window.dispatchEvent(new Event("app-ready"));
    }

    // 🔥 LOAD DATA
    if (typeof window.loadOrders === "function") {
      window.loadOrders();
    }

  } 
  // =========================
  // ❌ BELUM LOGIN
  // =========================
  else {

    console.log("❌ User belum login");

    // 🔥 HAPUS CACHE LAMA (penting!)
    localStorage.removeItem("realUid");
    localStorage.removeItem("realEmail");

    window.currentUser = null;
    window.userId = null;

    // 🔥 TAMPILKAN LOGIN
    if (typeof showAuthOverlay === "function") {
      showAuthOverlay();
    }
  }

});

// 🔥 BACKUP TRIGGER (ANTI GAGAL TOTAL)
window.addEventListener("app-ready", () => {
  setTimeout(() => {
    if (window.currentUser?.uid) {
      console.log("🔥 FORCE SEND UID (app-ready)");
      sendUidToAndroid(window.currentUser.uid);
    }
  }, 1500);
});
function showAuthOverlay() {
  if (document.getElementById("authOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.innerHTML = `
    <div class="auth-box">
  
      <div class="auth-icon">
        🔐
      </div>
  
      <div class="auth-title">
        Login Diperlukan
      </div>
  
      <div class="auth-desc">
        Untuk menggunakan fitur aplikasi SuruhBeli
        silakan masuk atau daftar terlebih dahulu
      </div>
  
      <button class="auth-btn" id="btnMasuk">
        Masuk / Daftar
      </button>
  
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("btnMasuk").onclick = () => {
    window.location.href = "register.html";
  };
}
function hideAuthOverlay() {
  const el = document.getElementById("authOverlay");
  if (el) el.remove();
}

// ====== INIT APP ====== //
function initApp() {
  if (appStarted) return;
  window.appStarted = true;
  // Nav click
  navItems.forEach((item, idx) => {
    item.addEventListener('click', () => setActive(idx));
  });
  // Tentukan view awal dari hash atau home
  let initialView = 'home';
  const hashView = window.location.hash.replace('#', '');
  if (document.getElementById(`view-${hashView}`)) {
    initialView = hashView;
  }
  const idx = navIndex(initialView);
  if (idx !== null) setActive(idx, true);
  if (app) app.style.visibility = 'visible';
  // Hash routing
  window.addEventListener("hashchange", handleHashRouting);
  // Resize nav circle
  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-item.active');
    if (active) updateNavCircle(Array.from(navItems).indexOf(active));
  });

  // ===== POPSTATE BACK BUTTON ===== //
  window.addEventListener("popstate", (e) => {
    // 🔥 PAKSA SEMUA BACK KE CUSTOM LOGIC
    handleBackButton();
  });
  // state awal
  history.replaceState({root:true}, "", location.pathname);
}
function handleBackButton() {
  let currentView = document.querySelector(".view.active")?.id?.replace("view-", "") || "home";

  // ===== PRIORITAS 1: POPUP =====
  const openPopups = document.querySelectorAll(".popup-overlay.show, .popup.show");
  if (openPopups.length > 0) {
    openPopups.forEach(p => p.classList.remove("show"));
    document.body.classList.remove("popup-open");
    return true;
  }

  if (currentView === "chatRoom") {
    const idx = navIndex("chatlist");
    if (idx !== null) setActive(idx);
    return true;
  }

  if (currentView !== "home") {
    const idx = navIndex("home");
    if (idx !== null) setActive(idx);
    return true;
  }

  if (currentView === "home") {
    const ok = confirm("Apakah Anda ingin keluar aplikasi?");
    if (!ok) return true;

    window.close?.();
    navigator.app?.exitApp?.();
    return false;
  }

  return false;
}
// Back button fisik Android (Cordova / WebView)
document.addEventListener("backbutton", handleBackButton);

function initGlobalScrollHeader(viewId){
  const view = document.getElementById(viewId);
  const scrollHeader = document.getElementById("scrollHeader");
  const logoTop = document.querySelector(".logo-top");
  if(!view) return;
  view.addEventListener("scroll", () => {
    const scrollTop = view.scrollTop;
    if(logoTop){
      logoTop.classList.toggle("scrolled", scrollTop > 10);
    }
    if(scrollHeader){
      scrollHeader.style.opacity = Math.min(scrollTop / 50, 1);
    }
  });
}
function setHeaderTitle(viewName){

  const header = document.getElementById("headerTop");
  if(!header) return;
  // view yang tidak pakai header global
  const hideHeaderViews = ["home","order","profil","chatRoom"];

  // sembunyikan header
  if(hideHeaderViews.includes(viewName)){
    header.classList.add("hidden");
    return;
  }

  // tampilkan header
  header.classList.remove("hidden");

  const titles = header.querySelectorAll(".header-title");

  titles.forEach(el=>{
    el.classList.remove("active");

    if(el.dataset.view === viewName){
      el.classList.add("active");
    }
  });

}
function showView(viewName){
  const target = document.getElementById(`view-${viewName}`);
  if(!target) return;

  const views = document.querySelectorAll(".view");

  views.forEach(v => {
    v.classList.remove("active");
  });
  views.forEach(v => {
    v.style.zIndex = 0;
  });
  // kasih delay 1 frame biar fade kepicu
  requestAnimationFrame(() => {
    target.classList.add("active");
  });

  activeView = target;

  // system lain tetap
  setHeaderTitle(viewName);

  const homeHeaderViews = ["home","profil","order"];
  toggleHomeHeader(homeHeaderViews.includes(viewName));

  toggleNavbarForOrder(viewName === "chatRoom");

  const viewFlag = `_${viewName}Inited`;
  if(!window[viewFlag]){
    switch(viewName){
      case "home": 
        window.initHome?.(); 
        initGlobalScrollHeader("view-home");
        break;
      case "profil": 
        window.initProfil?.(); 
        initGlobalScrollHeader("view-profil");
        break;
      case "order": 
        window.initOrder?.(); 
        initGlobalScrollHeader("view-order");
        break;
      case "aktivitas": 
        window.initAktivitas?.(); 
        break;
      case "chatlist": 
        window.initChatList?.(); 
        break;
      case "chatRoom":
        window.initChatRoomView?.(); 
        break;
    }
    window[viewFlag] = true;
  }
}
function setActive(idx, fromPop=false){

  const viewName = navItems[idx].dataset.view;

  // nav highlight
  navItems.forEach(i => i.classList.remove('active'));
  navItems[idx].classList.add('active');

  updateNavCircle(idx);

  // tampilkan view
  showView(viewName);

  // update URL TANPA menambah history
  if(!fromPop){
    history.pushState(
      { view: viewName },
      "",
      "#"+viewName
    );
  }

}
function toggleHomeHeader(show) {
  const logoTop = document.querySelector(".logo-top");
  const scrollHeader = document.getElementById("scrollHeader");
  if (!logoTop || !scrollHeader) return;
  if (show) {
    logoTop.style.opacity = "1";
    scrollHeader.style.opacity = "0"; 
    logoTop.style.pointerEvents = "auto";
    scrollHeader.style.pointerEvents = "auto";
  } else {
    logoTop.style.opacity = "0";
    scrollHeader.style.opacity = "0";
    logoTop.style.pointerEvents = "none";
    scrollHeader.style.pointerEvents = "none";
  }
}

// ====== NAVBAR ====== //
function updateNavCircle(idx) {
  const item = navItems[idx];
  if (!item || !navCircle) return;
  const rect = item.getBoundingClientRect();
  const parentRect = item.parentElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2 - parentRect.left;
  navCircle.style.left = `${centerX - navCircle.offsetWidth / 2}px`;
  navCircle.style.transform = 'scale(1.15)';
  setTimeout(() => navCircle.style.transform = 'scale(1)', 200);
  navCircle.style.willChange = "left, transform";
}
function navIndex(viewName) {
  const item = Array.from(navItems).find(i => i.dataset.view === viewName);
  return item ? Array.from(navItems).indexOf(item) : 0;
}
function handleHashRouting() {
  const hashView = window.location.hash.replace('#','');
  if (!hashView) return;
  const idx = navIndex(hashView);
  if (idx !== null) setActive(idx, true);
}

// ====== TOGGLE NAVBAR UNTUK ORDER VIEW ====== //
function toggleNavbarForOrder(isHidden){

  if(isHidden){

    navbarBottom?.classList.add("hidden");
    navActiveCircle?.classList.add("hidden");
    navItems.forEach(i => i.classList.add("hidden"));

  }else{

    navbarBottom?.classList.remove("hidden");
    navActiveCircle?.classList.remove("hidden");
    navItems.forEach(i => i.classList.remove("hidden"));

  }

}

// ====== SPA CUSTOM EVENTS ===== //
window.addEventListener('goto-aktivitas', () => {
  const idx = navIndex('aktivitas');
  if (idx !== null) setActive(idx);
});

window.addEventListener('goto-chatlist', () => {
  const idx = navIndex('chatlist');
  if (idx !== null) setActive(idx);
});

// ===== GLOBAL POPUP CONTROLLER ======= //
function openPopup(id){
  const popup = document.getElementById(id);
  if(!popup) return;

  popup.classList.add("show");
  document.body.classList.add("popup-open");
}
function closePopup(id){
  const popup = document.getElementById(id);

  if(popup){
    popup.classList.remove("show");
  }

  document.body.classList.remove("popup-open");
}
// CLICK OUTSIDE CLOSE
document.addEventListener("click", function(e){
  const overlay = e.target.closest(".popup-overlay");
  if(overlay && e.target === overlay){
      overlay.classList.remove("show");
      document.body.classList.remove("popup-open");
  }

});
// ESC CLOSE
document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    document.querySelectorAll(".popup-overlay.show")
      .forEach(p => p.classList.remove("show"));
    document.body.classList.remove("popup-open");
  }
});
const CLOUD_NAME = "dim42m83n";
const UPLOAD_PRESET = "profil_upload";

async function uploadToCloudinary(file){
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try{
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{
      method: "POST",
      body: formData
    });

    const data = await res.json();
    console.log("CLOUDINARY:", data);

    if(data.secure_url){
      return data.secure_url;
    }

    return null;

  }catch(err){
    console.error("Upload error:", err);
    return null;
  }
}
// ====== GLOBAL POPUP MANAGER ====== //
window.PopupManager = (function(){
  // DOM references
  const popups = {
    detail: document.getElementById("popupDetail"),
    edit: document.getElementById("popupEdit"),
    editProfile: document.getElementById("popupEditProfile"),
    alert: document.getElementById("popupAlert"),
    service: document.getElementById("servicePopup"),
    desa: document.getElementById("desaPopup"),
    custom: document.getElementById("customPopup"),
    photoOption: document.getElementById("popupPhotoOption")
  };
  // ==================== SHOW & CLOSE UTILITY ====================
  function closeAll(){
    Object.values(popups).forEach(p => {
      if(p) p.classList.remove("show");
    });
    document.body.classList.remove("popup-open");
  }
  // Swipe down close (iOS style)
  let startY = 0;
  document.addEventListener("touchstart", e => startY = e.touches[0].clientY);
  document.addEventListener("touchend", e => {
    let endY = e.changedTouches[0].clientY;
    if(endY - startY > 120) closeAll();
  });
  // ==================== DETAIL POPUP ====================
  function showDetail(content){
    if(!popups.detail) return;
    const popupContent = popups.detail.querySelector("#popupContent");
    popupContent.innerHTML = content || '';
    popups.detail.classList.add("show");
  }
  function closeDetail(){ if(popups.detail) popups.detail.classList.remove("show"); }
  // ==================== EDIT POPUP ====================
  function showEdit(pesanan='', catatan=''){
    if(!popups.edit) return;
    document.getElementById("editPesanan").value = pesanan;
    document.getElementById("editCatatan").value = catatan;
    popups.edit.classList.add("show");
  }
  function closeEdit(){ if(popups.edit) popups.edit.classList.remove("show"); }
  // ==================== ALERT / CONFIRM POPUP ====================
  function showAlert(message){
    if(!popups.alert) return;
    document.getElementById("popupAlertMessage").innerText = message;
    popups.alert.classList.add("show");
  }
  function showConfirm(message, onOk){
    if(!popups.alert) return;
    document.getElementById("popupAlertMessage").innerText = message;
    const btnOk = document.getElementById("popupOk");
    const btnCancel = document.getElementById("popupCancel");
    popups.alert.classList.add("show");
    btnOk.onclick = () => { closeAll(); onOk?.(); };
    btnCancel.onclick = closeAll;
  }
  // ==================== SERVICE POPUP ====================
  function showService(){ if(popups.service) popups.service.classList.add("show"); }
  function closeService(){ if(popups.service) popups.service.classList.remove("show"); }
  // ==================== DESA POPUP ====================
  function showDesa(){ if(popups.desa) popups.desa.classList.add("show"); }
  function closeDesa(){ if(popups.desa) popups.desa.classList.remove("show"); }
  // ==================== CUSTOM POPUP ====================
  function showCustom(message, showActions = false, onOk) {
    if (!popups.custom) return;
    const msg = popups.custom.querySelector("#popupMessage");
    const actions = popups.custom.querySelector("#popupActions");
    const btnOk = document.getElementById("btnOkPopup");
    const btnBatal = document.getElementById("btnBatalPopup");
    msg.innerText = message;
    actions.style.display = showActions ? "flex" : "none";
    popups.custom.classList.add("show");
    if (showActions) {
      btnOk.onclick = () => { actions.style.display = "none"; onOk?.(); };
      btnBatal.onclick = () => { popups.custom.classList.remove("show"); };
    } else {
      // otomatis hilang setelah 3 detik
      setTimeout(() => { popups.custom.classList.remove("show"); }, 2000);
    }
  }
  function closeCustom(){ if(popups.custom) popups.custom.classList.remove("show"); }
// =====EDIT PROFIL ===== //
function showEditProfile(userData) {
  const popup = document.getElementById("popupEditProfile");
  if (!popup) return;

  // ===== INPUT DATA =====
  const inputNama = document.getElementById("editNama");
  const inputNoHP = document.getElementById("editNoHP");

  if (inputNama) inputNama.value = userData?.nama || "";
  if (inputNoHP) inputNoHP.value = userData?.noHP || userData?.phone || "";

  // ===== PREVIEW AVATAR =====
  const editPreview = document.getElementById("editAvatarPreview");

  if (editPreview) {
    if (userData?.photoURL) {
      editPreview.innerHTML = `
        <img src="${userData.photoURL}" 
        style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
      `;
    } else if (userData?.nama && userData.nama.length > 0) {
      editPreview.textContent = userData.nama.charAt(0).toUpperCase();
    } else {
      editPreview.textContent = "U";
    }
  }

  // ===== BUTTON UPLOAD (BUKA PILIHAN) =====
  const btnUpload = document.getElementById("btnUploadPhoto");
  if (btnUpload) {
    btnUpload.onclick = () => {
      if (typeof PopupManager !== "undefined") {
        PopupManager.showPhotoOption();
      }
    };
  }

  // ===== RESET TEMP PHOTO (PENTING) =====
  localStorage.removeItem("tempProfilePhoto");

  // ===== SHOW POPUP =====
  popup.classList.add("show");
  document.body.classList.add("popup-open");
}
  function closeEditProfile() {
    if (popups.editProfile) popups.editProfile.classList.remove("show");
    document.body.classList.remove("popup-open");
  }
  // ====== PHOTO OPTION POPUP ====== //
  // Event upload foto
  const inputPhoto = document.getElementById("inputPhoto");
  const editPreview = document.getElementById("editAvatarPreview");
  function showPhotoOption(){
    if(!popups.photoOption) return;
    popups.photoOption.classList.add("show");
    document.body.classList.add("popup-open");
  }
  function closePhotoOption(){
    if(!popups.photoOption) return;
    popups.photoOption.classList.remove("show");
  }
  const btnGallery = document.getElementById("btnChooseGallery");
  const btnDelete = document.getElementById("btnDeletePhoto");
  const btnCancel = document.getElementById("btnCancelPhotoOption");
  if(btnGallery){
    btnGallery.onclick = () => {
      closePhotoOption();
      document.getElementById("inputPhoto").click();
    };
  }
  if(btnDelete){
    btnDelete.onclick = () => {
      closePhotoOption();
      localStorage.setItem("tempProfilePhoto","delete");
      const preview = document.getElementById("editAvatarPreview");
      const nama = document.getElementById("editNama")?.value || "U";
      if(preview){
        preview.textContent = nama.charAt(0).toUpperCase();
      }
    };
  }
  if(btnCancel){
    btnCancel.onclick = closePhotoOption;
  }
  if (inputPhoto) {
    inputPhoto.onchange = async function () {
      const file = this.files[0];
      if (!file) return;
  
      const editPreview = document.getElementById("editAvatarPreview");
  
      // ✅ preview cepat
      const previewURL = URL.createObjectURL(file);
      if (editPreview) {
        editPreview.innerHTML = `<img src="${previewURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      }
  
      // 🔥 upload ke cloudinary
      const url = await uploadToCloudinary(file);
  
      if(url){
        console.log("✅ Upload sukses:", url);
        localStorage.setItem("tempProfilePhoto", url);
      }else{
        console.log("❌ Upload gagal");
        alert("Upload gagal 😔");
      }
    };
  }
    // ==================== PUBLIC API ====================
  return {
    closeAll,
    showDetail, closeDetail,
    showEdit, closeEdit,
    showAlert, showConfirm,
    showService, closeService,
    showDesa, closeDesa,
    showCustom, closeCustom,
    showEditProfile, closeEditProfile,
    showPhotoOption, closePhotoOption
  };
})();
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  console.log("💡 Bisa install PWA");

  // contoh tombol manual
  const btn = document.getElementById("btnInstall");
  if(btn){
    btn.style.display = "block";

    btn.onclick = async () => {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log(choice.outcome);
      deferredPrompt = null;
    };
  }
});
// REGISTER SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(reg => {
        console.log("✅ Service Worker aktif", reg);
      })
      .catch(err => {
        console.log("❌ Service Worker gagal", err);
      });
  });
}