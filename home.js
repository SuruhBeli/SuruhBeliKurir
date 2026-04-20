/* ================= GLOBAL LOTTIE STORAGE ================= */
let lottieInstances = [];
let semuaToko = [];
let semuaDesa = []; // pastikan di-load dari firestore sebelum pakai

/* ================= INIT HOME ================= */
window.initHome = function () {

  function initHome() {
    const heroImage = document.getElementById("heroImage");
    const bannerCarousel = document.getElementById("bannerCarousel");
    const bannerDots = document.getElementById("bannerDots");
    const scrollHeader = document.getElementById("scrollHeader");
    const logoTop = document.querySelector(".logo-top");
    const lottieContainer = document.getElementById("lottieAnimation");

    loadStockFoto(heroImage, bannerCarousel, bannerDots);
    initLotties(lottieContainer);
    toggleHomeHeader(true);
    loadDesa().then(()=>loadToko());
  }
  async function loadStockFoto(heroImage, container, dots){
  
    const skeleton = document.getElementById("heroSkeleton");
  
    try{
  
      // 🔥 CACHE FIRST
      let cached = localStorage.getItem("stockfoto");
      let data;
  
      if(cached){
        data = JSON.parse(cached);
      }else{
        const doc = await db.collection("stockfoto").doc("foto").get();
        data = doc.exists ? doc.data() : {};
        localStorage.setItem("stockfoto", JSON.stringify(data));
      }
  
      // ===== HERO =====
      const heroUrl = data.headerhome || "default.png";
      heroImage.src = heroUrl;
      heroImage.onload = ()=> {
        heroImage.style.opacity = 1;
        skeleton?.classList.remove("skeleton");
      };
  
      // ===== BANNER =====
      const banners = Array.isArray(data.bannerhome) ? data.bannerhome : [];
      renderCarousel(container, dots, banners);
  
    }catch(err){
      console.error("Stockfoto error:", err);
    }
  }
  /* ================= LOAD DATA DESA ================= */
async function loadDesa(){

  try{

    // 🔥 cache memory
    if(window.cacheDesa){
      semuaDesa = window.cacheDesa;
      return;
    }

    // 🔥 cache localStorage
    const cached = localStorage.getItem("desa");

    if(cached){
      semuaDesa = JSON.parse(cached);
      window.cacheDesa = semuaDesa;
      return;
    }

    // 🔥 fetch firestore
    const snapshot = await db.collection("desa").get();

    semuaDesa = snapshot.docs.map(d=>({
      id:d.id,
      lat:d.data().lat,
      lng:d.data().lng
    }));

    localStorage.setItem("desa", JSON.stringify(semuaDesa));
    window.cacheDesa = semuaDesa;

  }catch(err){
    console.error("Gagal load desa:", err);
    semuaDesa = [];
  }
}

  /* ================= HERO ================= */
  async function loadHero(heroImage) {
    const skeleton = document.getElementById("heroSkeleton");
    if (!heroImage) return;
    try {
      const doc = await firebase.firestore()
        .collection("stockfoto")
        .doc("foto")
        .get();
      const url = doc.exists ? doc.data().headerhome : null;
      heroImage.src = url || "default.png";
      heroImage.onload = () => { heroImage.style.opacity = 1; skeleton && skeleton.classList.remove("skeleton"); };
      heroImage.onerror = () => { heroImage.src = "default.png"; skeleton && skeleton.classList.remove("skeleton"); };
    } catch (err) {
      heroImage.src = "default.png";
      skeleton && skeleton.classList.remove("skeleton");
    }
  }

  /* ================= BANNERS ================= */
  async function loadBanners(container, dots) {
    if (!container || !dots) return;
    try {
      const doc = await firebase.firestore()
        .collection("stockfoto")
        .doc("foto")
        .get();
      const banners = doc.exists && Array.isArray(doc.data().bannerhome) ? doc.data().bannerhome : [];
      renderCarousel(container, dots, banners);
    } catch (err) {
      console.error("Banner error:", err);
      container.innerHTML = "";
    }
  }

  function renderCarousel(container, dots, banners) {
    container.innerHTML = "";
    dots.innerHTML = "";
    if (!banners.length) { container.innerHTML = `<div style="height:150px;border-radius:10px;background:#eee;"></div>`; return; }
    let currentIndex = 0;
    let interval;
    banners.forEach((url,i)=>{
      const img = document.createElement("img");
      img.src = url || "default.png";
      img.onerror = ()=>img.src="default.png";
      if(i===0) img.classList.add("active");
      container.appendChild(img);
      const dot = document.createElement("span");
      dot.className = "dot"+(i===0?" active":"");
      dot.onclick = ()=>showBanner(i);
      dots.appendChild(dot);
    });
    function showBanner(index){
      const width = container.children[0]?.offsetWidth||0;
      container.scrollTo({left: width*index, behavior:"smooth"});
      currentIndex=index;
      updateDots();
    }
    function updateDots(){ [...dots.children].forEach((d,i)=>d.classList.toggle("active",i===currentIndex)); }
    function startAuto(){ if(banners.length<2) return; interval=setInterval(()=>{ currentIndex=(currentIndex+1)%banners.length; showBanner(currentIndex); },3500); }
    startAuto();
  }

  /* ================= LOTTIE ================= */
function initLotties(mainContainer){
  if(typeof lottie==="undefined") return;

  // 1️⃣ Hapus animasi lama
  lottieInstances.forEach(anim=>anim.destroy());
  lottieInstances=[];

  // 2️⃣ Observer untuk autoplay saat terlihat
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const anim = entry.target._lottie;
        anim?.play();
      } else {
        const anim = entry.target._lottie;
        anim?.pause();
      }
    });
  }, { threshold: 0.3 });

  // 3️⃣ List animasi
  const names=["makanan","belanja","barang","lainnya"];
  names.forEach(name=>{
    const container=document.getElementById(`lottie-${name}`);
    if(!container) return;

    const anim=lottie.loadAnimation({
      container,
      renderer:"svg",
      loop:true,
      autoplay:false, // ❌ autoplay off
      path:`${name}.json`
    });

    // 4️⃣ remove skeleton saat anim siap
    anim.addEventListener("DOMLoaded", ()=>container.classList.remove("skeleton"));

    // 5️⃣ simpan reference & attach ke container
    container._lottie = anim;
    lottieInstances.push(anim);

    // 6️⃣ observe
    observer.observe(container);
  });

  // 7️⃣ animasi utama di home
  if(mainContainer){
    const mainAnim=lottie.loadAnimation({
      container:mainContainer,
      renderer:"svg",
      loop:true,
      autoplay:false,
      path:"ikon-1.json"
    });
    mainAnim.addEventListener("DOMLoaded", ()=>mainContainer.classList.remove("skeleton"));
    mainContainer._lottie = mainAnim;
    lottieInstances.push(mainAnim);
    observer.observe(mainContainer);
  }
}

  /* ================= SCROLL EFFECT ================= */
  function initScrollEffect(scrollHeader, logoTop){
    const viewHome=document.getElementById("view-home");
    if(!viewHome) return;
    function handleScroll(){
      const scrollTop=viewHome.scrollTop;
      if(logoTop) logoTop.classList.toggle("scrolled",scrollTop>10);
      if(scrollHeader) scrollHeader.style.opacity=Math.min(scrollTop/50,1);
    }
    viewHome.addEventListener("scroll",handleScroll);
  }

  initHome();
};

/* ================= GO ORDER ================= */
window.goOrder = function(type){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active","zoom-in","zoom-out"));
  const viewOrder=document.getElementById("view-order");
  if(viewOrder){ viewOrder.classList.add("active","zoom-in"); viewOrder.style.zIndex=2; viewOrder.dataset.type=type; }
  setTimeout(()=>{ if(typeof fokusInputOrder==="function") fokusInputOrder(); },300);
  toggleHomeHeader(false);
  toggleNavbarForOrder(true);
  console.log("SPA Order type:",type);
  const layananMap={umum:"Beli Makanan", belanja:"Beli Belanjaan", antar:"Antar Barang", lainnya:"Suruh Lainnya"};
  const layanan = layananMap[type]||"Beli Makanan";
  if(typeof selectService==="function") selectService(layanan);
};

/* ================= GO ORDER MERCHANT ================= */
window.goOrderMerchant = function(toko){
  if(!toko||!toko.id){ console.error("Toko tidak valid",toko); return; }
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active","zoom-in","zoom-out"));
  const view=document.getElementById("view-orderMerchant");
  if(view){ view.classList.add("active","zoom-in"); view.style.zIndex=2; }
  window.selectedToko=toko;
  toggleHomeHeader(false);
  toggleNavbarForOrder(true);
  if(typeof loadMerchantData==="function") loadMerchantData(toko.id);
  console.log("Merchant order:",toko);
};

/* ================= LIST TOKO ================= */
// ===== HITUNG JARAK (KM) =====
function hitungJarak(lat1,lng1,lat2,lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===== HITUNG DESA TERDEKAT =====
function desaOngkir(lat,lng){
  if(!semuaDesa.length) return [];
  return semuaDesa
    .map(d=>({...d, jarak:hitungJarak(lat,lng,d.lat,d.lng)}))
    .sort((a,b)=>a.jarak-b.jarak);
}

// ===== LOAD TOKO =====
function renderSkeletonToko(){
  const container = document.getElementById("listToko");
  if(!container) return;

  container.innerHTML = "";

  for(let i=0;i<4;i++){
    const sk = document.createElement("div");
    sk.className = "toko-card";

    sk.innerHTML = `
      <div class="skeleton toko-foto"></div>
      <div class="toko-info">
        <div class="skeleton sk-text title"></div>
        <div class="skeleton sk-text desc"></div>
        <div class="skeleton sk-text small"></div>
      </div>
    `;

    container.appendChild(sk);
  }
}
async function loadToko(){

  // 🔥 tampilkan skeleton dulu
  renderSkeletonToko();
  // 🔥 tampilkan cache dulu (instant UI)
  const cached = localStorage.getItem("toko");
  
  if(cached){
    semuaToko = JSON.parse(cached);
    renderTokoTerdekat();
  }
  const snapshot = await db.collection("dataToko")
    .where("status","==","approved")
    .limit(10)
    .get();
  localStorage.setItem("toko", JSON.stringify(semuaToko));
  semuaToko=[];
  snapshot.forEach(doc=>{
    semuaToko.push({
      id:doc.id,
      lat:doc.data().lat||null,
      lng:doc.data().lng||null,
      ...doc.data()
    });
  });

  requestAnimationFrame(()=>{
    renderTokoTerdekat();
  });
}

// ===== RENDER TOKO TERDEKAT / SEARCH =====
function renderTokoTerdekat(keyword=""){
  let filtered = semuaToko.filter(t=> (t.tokoNama||"").toLowerCase().includes(keyword.toLowerCase()));
  filtered = filtered.filter(t=>t.lat && t.lng);
  if(userLat && userLng){
    filtered.forEach(t=>t.jarak=hitungJarak(userLat,userLng,t.lat,t.lng));
    filtered.sort((a,b)=>a.jarak-b.jarak);
  } else {
    filtered.sort(()=>Math.random()-0.5);
  }
  renderToko(filtered.slice(0,5));
}

// ===== RENDER KE DOM (ALAMAT + ONGKIR + CLICK CARD) =====
function renderToko(list){
  const container=document.getElementById("listToko");
  container.innerHTML="";
  if(list.length===0){
    container.innerHTML=`<div style="text-align:center;padding:20px;color:#777">Toko tidak ditemukan</div>`;
    return;
  }
  let delay=0;
  list.forEach(data=>{
    const card=document.createElement("div");
    card.className="toko-card";

    // ✅ Hitung ongkir berdasarkan desa terdekat
    let alamatOngkir = data.tokoAlamat || "";
    if(data.lat && data.lng && semuaDesa.length){
      const desaRanked = desaOngkir(data.lat,data.lng);
      if(desaRanked && desaRanked.length){
        const ranking = 0; // ambil desa terdekat ranking pertama
        const ongkir = 3000 + ranking*2000;
        alamatOngkir += ` (ongkir sekitar Rp ${ongkir.toLocaleString()})`;
      }
    }

    // ✅ Card tanpa tombol, klik card = goOrderMerchant
    card.innerHTML = `
      <img class="toko-foto" src="${data.tokoFotoBase64||''}">
      <div class="toko-info">
        <div class="toko-nama">${data.tokoNama||'-'}</div>
        <div class="toko-deskripsi">${data.tokoDeskripsi||'Toko lokal terpercaya'}</div>
        ${alamatOngkir ? `
          <div class="toko-alamat-ongkir">
            <svg class="icon-location" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/>
            </svg>
            ${alamatOngkir}
          </div>
        ` : ""}
      </div>
    `;

    container.appendChild(card);
    setTimeout(()=>card.classList.add("show"),delay);
    delay+=120;

    // ✅ Klik card = buka merchant
    card.addEventListener("click",()=>goOrderMerchant({id:data.id,nama:data.tokoNama}));
  });
}

// ===== SEARCH =====
const searchInput=document.getElementById("searchToko");
if(searchInput){
  searchInput.addEventListener("input",function(){ renderTokoTerdekat(this.value); });
}