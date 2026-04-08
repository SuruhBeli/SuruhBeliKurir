// ====== FIREBASE INIT ====== //
if (!window.firebaseInitialized) {
  const firebaseConfig = {
    apiKey: "AIzaSyByQl0BXZoSMzrULUNA6l7UVFQjXmvsdJE",
    authDomain: "suruhbeli-e8ae8.firebaseapp.com",
    projectId: "suruhbeli-e8ae8",
    storageBucket: "suruhbeli-e8ae8.appspot.com",
    messagingSenderId: "5783247867",
    appId: "1:5783247867:web:8f57e09a7dc4565378c95e",
    measurementId: "G-W68JP10CG9",
    databaseURL: "https://suruhbeli-e8ae8-default-rtdb.asia-southeast1.firebasedatabase.app",
  };

  firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
  window.rtdb = firebase.database();
  window.auth = firebase.auth();

  window.firebaseInitialized = true;
  console.log("✅ Firebase initialized");
}

// ====== DOM ====== //
const navItems = document.querySelectorAll('.nav-item');
const navCircle = document.getElementById('navCircle');
const app = document.getElementById('app');
const navbarBottom = document.querySelector('.navbar-bottom');

// ====== FLAGS ====== //
window.APP_CACHE = {};
window.viewInitialized = {}; // 🔥 kunci utama anti reload
let activeView = null;

// ====== AUTH ====== //
firebase.auth().onAuthStateChanged(user => {

    if (user) {

      if (!window.appStarted) initApp();

      window.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "User"
      };

      hideAuthOverlay();

      // 🔥 tampilkan app
      if (app) app.style.visibility = "visible";

      const hash = window.location.hash.replace('#','');
      const view = hash ? hash.split('?')[0] : "home";

      const idx = navIndex(view);
      setActive(idx, true);

    } else {

      window.currentUser = null;

      // 🔥 sembunyikan app
      if (app) app.style.visibility = "hidden";

      showAuthOverlay();
    }
  });

  // ====== AUTH UI ====== //
  function showAuthOverlay() {
    if (document.getElementById("authOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "authOverlay";

    overlay.innerHTML = `
      <div class="auth-box">
        <div class="auth-icon">🔐</div>
        <div class="auth-title">Akses Dibatasi</div>
        <div class="auth-desc">
          Kamu harus login sebagai kurir untuk mengakses aplikasi ini
        </div>
        <button class="auth-btn" id="btnLoginNow">
          Login Sekarang
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnLoginNow").onclick = () => {
      window.location.href = "login.html";
    };
  }

  function hideAuthOverlay() {
    document.getElementById("authOverlay")?.remove();
  }

// ====== INIT APP ====== //
function initApp() {
  if (window.appStarted) return;
  window.appStarted = true;

  // 🔥 Nav click
  navItems.forEach((item, idx) => {
    item.addEventListener('click', () => setActive(idx));
  });

  if (app) app.style.visibility = 'visible';

  window.addEventListener("hashchange", handleHashRouting);

  window.addEventListener('resize', () => {
    const active = document.querySelector('.nav-item.active');
    if (active) {
      updateNavCircle(Array.from(navItems).indexOf(active));
    }
  });

  history.replaceState({app:true}, "", location.pathname);
}
// ====== ANDROID BACK HANDLER ====== //
window.addEventListener('popstate', (event) => {
  // 🔥 Ambil view dari activeView atau default home
  const currentView = activeView?.id?.replace('view-', '') || 'home';

  // 🔥 Jika sedang di chatRoom, kembali ke chatlist
  if (window.activeRoomId || currentView === 'chatRoom') {
    cleanupRoomListeners(true);
    roomId = null;
    window.activeRoomId = null;
    showView("chatlist");
    history.replaceState({ view: 'chatlist' }, "", "#chatlist");
  } 
  // 🔥 Jika di view lain selain home, kembali ke home
  else if(currentView !== 'home') {
    const homeIdx = navIndex('home');
    setActive(homeIdx, true); // fromPop = true
    history.replaceState({ view: 'home' }, "", "#home");
  } 
  else {
    // 🔥 Di home: biarkan default, keluar aplikasi
  }
});

// ====== BACK BUTTON ANDROID ======
document.addEventListener('backbutton', (e) => {
  e.preventDefault(); // cegah default exit app
  if(window.activeRoomId){
    // 🔥 Sedang di chatRoom → kembali ke chatList
    cleanupRoomListeners(true);
    window.roomId = null;
    window.activeRoomId = null;
    showView("chatlist");
    history.replaceState({ view: 'chatlist' }, "", "#chatlist");
  } else {
    navigator.app.exitApp(); // di luar chatRoom → keluar app
  }
}, false);
// ====== VIEW HANDLER ====== //
function showView(viewName) {

  // 🔥 HIDE semua view (fix double view)
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
    v.style.display = "none";
  });

  const target = document.getElementById(`view-${viewName}`);
  if (!target) return;

  target.style.display = "block";
  requestAnimationFrame(() => target.classList.add("active"));

  activeView = target;

  toggleNavbar(viewName !== 'chatRoom'); // pastikan id view = view-chatRoom

  // 🔥 INIT SEKALI SAJA (INI KUNCI OPTIMASI)
  if (window.viewInitialized[viewName]) return;
  window.viewInitialized[viewName] = true;

  console.log("🚀 Init view:", viewName);

  switch(viewName){
    case "home": window.initHome?.(); break;
    case "tugas": window.initTugas?.(); break;
    case "chatlist": window.initChatList?.(); break;
    case "chat": window.initChatRoomView?.(); break;
    case "profil": window.initProfil?.(); break;
  }
}

// ====== NAVIGATION ====== //
function setActive(idx, fromPop=false) {
  if (idx === null || idx === undefined) return;

  const viewName = navItems[idx].dataset.view;

  navItems.forEach(i => i.classList.remove('active'));
  navItems[idx].classList.add('active');

  updateNavCircle(idx);
  showView(viewName);

  if (!fromPop) {
    history.pushState({ view: viewName }, "", "#"+viewName);
  }
}

function navIndex(viewName) {
  const item = Array.from(navItems).find(i => i.dataset.view === viewName);
  return item ? Array.from(navItems).indexOf(item) : 0;
}

// ====== HASH ROUTING ====== //
function handleHashRouting() {
  let hash = window.location.hash.replace('#','');
  if (!hash) return;

  const [viewName] = hash.split('?');
  const idx = navIndex(viewName);

  if (idx !== null) setActive(idx, true);
}

// ====== NAVBAR UI ====== //
function updateNavCircle(idx){
  const item = navItems[idx];
  if (!item || !navCircle) return;

  const rect = item.getBoundingClientRect();
  const parentRect = item.parentElement.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2 - parentRect.left;

  navCircle.style.left = `${centerX - navCircle.offsetWidth/2}px`;
}

// ====== TOGGLE NAVBAR ====== //
function toggleNavbar(show){
  navbarBottom?.classList.toggle("hidden", !show);
  navItems.forEach(i => i.classList.toggle("hidden", !show));
}

// ====== POPUP MANAGER ====== //
window.PopupManager = (function(){
  const popups = {
    detail: document.getElementById("popupDetail"),
    edit: document.getElementById("popupEdit"),
    alert: document.getElementById("popupAlert"),
    profil: document.getElementById("popupEditProfile"),
  };

  function closeAll(){
    Object.values(popups).forEach(p => p?.classList.remove("show"));
    document.body.classList.remove("popup-open");
  }

  function showDetail(content){
    popups.detail?.classList.add("show");
    if(popups.detail){
      popups.detail.querySelector("#popupContent").innerHTML = content || '';
    }
    document.body.classList.add("popup-open");
  }

  function closeDetail(){
    popups.detail?.classList.remove("show");
    document.body.classList.remove("popup-open");
  }

  function showEdit(){
    popups.edit?.classList.add("show");
    document.body.classList.add("popup-open");
  }

  function closeEdit(){
    popups.edit?.classList.remove("show");
    document.body.classList.remove("popup-open");
  }

  function showAlert(msg){
    if(!popups.alert) return;
    popups.alert.classList.add("show");
    popups.alert.querySelector("#popupAlertMessage").innerText = msg;
    document.body.classList.add("popup-open");
  }

  return { closeAll, showDetail, closeDetail, showEdit, closeEdit, showAlert };
})();

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