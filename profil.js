window.initProfil = async function() {
  // =========================
  // ELEMENT REFERENCES
  // =========================
  const avatarEl = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-name");
  const noHpEl = document.getElementById("profile-noHP"); // Profil card
  const emailEl = document.getElementById("profile-email");
  const previewOverlay = document.getElementById("avatarPreviewOverlay");
  const previewImg = document.getElementById("avatarPreviewImg");
  const bottomSheet = document.getElementById("bottomSheetEditProfile");
  const editAvatarImg = document.getElementById("editAvatarImg");
  const inputAvatarFile = document.getElementById("inputAvatarFile");
  const inputNama = document.getElementById("inputNama");
  const inputNoHp = document.getElementById("inputNoHp");
  const btnSaveProfile = document.getElementById("btnSaveProfile");
  const btnEditProfile = document.getElementById("btnEditProfile");

  // =========================
  // GLOBAL PROFILE DATA
  // =========================
  let profilData = null;

  // =========================
  // CHECK LOGIN
  // =========================
  if (!window.currentUser) {
    nameEl.textContent = "Belum Login";
    noHpEl.textContent = "-";
    avatarEl.innerHTML = "?";
    emailEl.textContent = "";
    return;
  }

  // =========================
  // CREATE OVERLAY FOR BOTTOM SHEET
  // =========================
  let overlay = document.getElementById("bottomSheetOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "bottomSheetOverlay";
    overlay.className = "bottom-sheet-overlay";
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }

  function openBottomSheet() {
    inputNama.value = profilData?.nama || "";
    inputNoHp.value = profilData?.noHP || "";
    const currentImg = avatarEl.querySelector("img");
    editAvatarImg.src = currentImg?.src || "";

    overlay.style.display = "block";
    bottomSheet.classList.add("show");
  }

  function closeBottomSheet() {
    bottomSheet.classList.remove("show");
    overlay.style.display = "none";
  }

  overlay.onclick = closeBottomSheet;
  bottomSheet.onclick = (e) => { if (e.target === bottomSheet) closeBottomSheet(); };

  // =========================
  // BTN EDIT PROFILE (TOGGLE)
  // =========================
  btnEditProfile.onclick = () => {
    if (bottomSheet.classList.contains("show")) closeBottomSheet();
    else openBottomSheet();
  };

  // =========================
  // AVATAR PREVIEW WHEN CHANGE FILE
  // =========================
  inputAvatarFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { editAvatarImg.src = evt.target.result; };
    reader.readAsDataURL(file);
  };

  // =========================
  // SAVE PROFILE CHANGES
  // =========================
  btnSaveProfile.onclick = async () => {
    const originalText = btnSaveProfile.textContent;
    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = "Menyimpan...";

    const fotoBase64 = editAvatarImg.src;
    const updateData = {
      nama: inputNama.value,
      noHP: inputNoHp.value,
      fotoProfil: fotoBase64
    };

    try {
      const uid = window.currentUser.uid;
      await window.db.collection("kurir").doc(uid).update(updateData);

      // Update profilData & profil card
      profilData.nama = inputNama.value;
      profilData.noHP = inputNoHp.value;
      profilData.fotoProfil = fotoBase64;

      nameEl.textContent = inputNama.value;
      noHpEl.textContent = inputNoHp.value;

      let img = avatarEl.querySelector("img");
      if (!img) { img = document.createElement("img"); avatarEl.prepend(img); }
      img.src = fotoBase64;
      img.alt = "Avatar";

      btnSaveProfile.textContent = "Berhasil";
      setTimeout(() => { closeBottomSheet(); btnSaveProfile.textContent = originalText; }, 1000);
    } catch (err) {
      console.error(err);
      btnSaveProfile.textContent = "Gagal";
      setTimeout(() => { btnSaveProfile.textContent = originalText; }, 2000);
    } finally { btnSaveProfile.disabled = false; }
  };

  // =========================
  // LOAD PROFILE DATA
  // =========================
  try {
    const uid = window.currentUser.uid;
    const docSnap = await window.db.collection("kurir").doc(uid).get();

    if (!docSnap.exists) {
      nameEl.textContent = "User Tidak Ditemukan";
      noHpEl.textContent = "-";
      emailEl.textContent = "";
      avatarEl.innerHTML = "?";
      avatarEl.style.cursor = "default";
      return;
    }

    profilData = docSnap.data();
    const nama = profilData.nama || "User";
    const noHP = profilData.noHP || "-";
    const fotoProfil = profilData.fotoProfil || null;
    const email = profilData.email || window.currentUser.email || "-";

    // Update profil card
    nameEl.textContent = nama;
    noHpEl.textContent = noHP;
    emailEl.textContent = email;

    // =========================
    // SET AVATAR
    // =========================
    if (fotoProfil) {
      let img = avatarEl.querySelector("img");
      if (!img) { img = document.createElement("img"); avatarEl.prepend(img); }
      img.src = fotoProfil;
      img.alt = "Avatar";
      avatarEl.style.cursor = "pointer";
      avatarEl.onclick = (e) => {
        if (e.target.tagName === "IMG") {
          previewImg.src = fotoProfil;
          previewOverlay.classList.add("show");
        }
      };
    } else {
      const initials = nama.split(" ").map(n => n[0]).join("").toUpperCase();
      if (!avatarEl.querySelector("img")) avatarEl.textContent = initials;
      avatarEl.style.cursor = "default";
      avatarEl.onclick = null;
    }

    previewOverlay.onclick = () => previewOverlay.classList.remove("show");

  } catch (err) {
    console.error("❌ Error load profil:", err);
    nameEl.textContent = "Error";
    noHpEl.textContent = "-";
    emailEl.textContent = "";
    avatarEl.textContent = "?";
    avatarEl.style.cursor = "default";
  }
  const btnLogout = document.getElementById("btnLogout");
  
  if (btnLogout) {
    btnLogout.onclick = async () => {
      const confirmLogout = confirm("Yakin mau logout?");
      if (!confirmLogout) return;
  
      try {
        await firebase.auth().signOut();
  
        // 🔥 Bersihin state global
        window.currentUser = null;
        window.activeRoomId = null;
  
        // 🔥 Redirect ke login
        window.location.href = "login.html";
  
      } catch (err) {
        console.error("Logout error:", err);
        alert("Gagal logout");
      }
    };
  }
};