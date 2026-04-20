
// === DOMS === //
const chatContainer = document.getElementById("chatContainer");
const input = document.getElementById("messageInput");
const inputBox = document.querySelector(".input-box");
const inputContainer = document.querySelector('.input-container');
const countEl = document.getElementById("selectionCount");
const headerName = document.getElementById("headerName");
const partnerPhoto = document.getElementById("partnerPhoto");
const replyPopup = document.getElementById("replyPopup");
const replyTextEl = document.getElementById("replyText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");
const scrollBtn = document.getElementById("scrollToBottomBtn");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPopup = document.getElementById("emojiPopup");
const header = document.querySelector('.header');
const inputBar = document.querySelector('.input-container');

// === GLOBAL FLAGS & VARS === //
let roomId = null; // ID chat room aktif
let globalLastMessageDate = null; // untuk date card
let preventAutoScroll = false; // scroll otomatis
let longPressTimer;
let selectedMessages = new Set();
let actionBar = null;
let otherUserId = null;
let lastMessageDate = null;
let typingRefGlobal = null;
let typingInputHandler = null;
let oldestMessageDoc = null;
let loadingOldMessages = false;
let messageBuffer = [];
let bufferTimer = null;
const BUFFER_DELAY = 40;
const VIRTUAL_WINDOW = 120;
const VIRTUAL_BUFFER = 40;
let virtualizeTimer = null;

// Reply state
let replyState = {
  active: false,
  messageId: null,
  text: ""
};

// ===== LOGIN CEK & CHAT INIT ===== //
window.addEventListener('goto-chatRoom', (e)=>{
  const { roomId: newRoomId } = e.detail;
  if(!newRoomId) return;

  if(!window.currentUser){
    const onUserReady = (ev)=>{
      window.removeEventListener('user-ready', onUserReady);
      initChatRoom(newRoomId);
    };
    window.addEventListener('user-ready', onUserReady);
    return;
  }

  initChatRoom(newRoomId);
});
function initChatRoom(newRoomId){
  cleanupRoomListeners(true);

  roomId = newRoomId;

  // 🔥 TAMBAH INI
  window.activeRoomId = roomId;

  showView("chatRoom");

  setupTypingIndicator();
  loadChatRoomInfo();
  setupOnlineStatus();
  setupRealtimeMessagesSafe();
  markAsDeliveredRealtime();
  markAsReadRealtime();
}

// ===== ONLINE STATUS ===== //
function setupOnlineStatus() {
  if(!window.currentUser) return; // pakai window.currentUser dulu
  const userStatusRef = rtdb.ref("status/" + window.currentUser.uid);
  function goOnline(){
    userStatusRef.set({
      online: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
  }
  userStatusRef.onDisconnect().set({
    online: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  goOnline();
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible") goOnline();
  });
}

// ===== TYPING INDICATOR  ===== //
function setupTypingIndicator(){
  const user = window.currentUser;
  if(!user || !roomId || !input) return;

  const typingRef = rtdb.ref(`typing/${roomId}/${user.uid}`);

  // 🔥 FIX double listener
  if (typingInputHandler) {
    input.removeEventListener("input", typingInputHandler);
  }

  typingInputHandler = () => {
    typingRef.set(true);
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(()=> typingRef.set(false), 1200);
  };

  input.addEventListener("input", typingInputHandler);
}
function cleanupTyping(){
  if(typingRefGlobal) typingRefGlobal.set(false);
  clearTimeout(window.typingTimeout);
}
function cleanupRoomListeners(force = false){
  if (!force && window.activeRoomId === roomId) {
    console.log("⚠️ Cleanup skipped (same room)");
    return;
  }

  if (window.unsubscribeMessages){
    window.unsubscribeMessages();
    window.unsubscribeMessages = null;
  }

  if (window.partnerStatusRef){
    window.partnerStatusRef.off();
    window.partnerStatusRef = null;
  }
  window.activeRoomId = null;

  console.log("🧹 Room listeners cleaned:", roomId);
}
window.addEventListener("beforeunload", cleanupRoomListeners);
window.addEventListener("pagehide", cleanupRoomListeners);

// ===== CHAT ROOM INFO ===== //
document.getElementById("backBtn").addEventListener("click", () => {
  cleanupRoomListeners(true);
  window.roomId = null;
  showView("chatlist"); // langsung switch view
});
window.addEventListener('goto-chatlist', () => {
  cleanupRoomListeners(true);
  roomId = null;
});

async function loadChatRoomInfo() {
  if (!roomId || !window.currentUser) return;
  try {
    const roomDoc = await db.collection("chatRooms").doc(roomId).get();
    if (!roomDoc.exists) return;
    const roomData = roomDoc.data();
    const user = window.currentUser;
    if (!user) return;
    // Dapatkan ID partner
    otherUserId = Object.keys(roomData.participants || {}).find(uid => uid !== user.uid);
    if (!otherUserId) return;
    // Default nama & inisial
    let userName = "User";
    let initials = "U";
    document.getElementById("headerName").innerText = userName;
    document.getElementById("partnerPhoto").innerText = initials;
    // Ambil data partner dari Firestore (users atau kurir)
    let userDoc = await db.collection("users").doc(otherUserId).get();
    if (!userDoc.exists) {
      userDoc = await db.collection("kurir").doc(otherUserId).get();
    }
    if (userDoc.exists) {
      const latestName = userDoc.data().nama || "User";
      const latestInitials = latestName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      userName = latestName;
      initials = latestInitials;
      document.getElementById("headerName").innerText = userName;
      document.getElementById("partnerPhoto").innerText = initials;
    }
    // ===== Online status partner (Realtime) =====
    const headerStatus = document.getElementById("headerStatus");
    // Hapus listener lama jika ada supaya tidak dobel
    if (window.partnerStatusRef) {
      window.partnerStatusRef.off();
    }
    const statusRef = rtdb.ref("status/" + otherUserId);
    window.partnerStatusRef = statusRef;
    statusRef.on("value", snapshot => {
      const status = snapshot.val();
      if (status) {
        headerStatus.innerHTML = status.online
          ? '<span class="online-dot"></span>Online'
          : `<span class="offline-dot"></span>Offline (Terakhir: ${new Date(status.lastSeen).toLocaleTimeString()})`;
      } else {
        headerStatus.innerHTML = '<span class="offline-dot"></span>Offline';
      }
    });
  } catch (err) {
    console.error("Gagal load chat room info:", err);
  }
}
function renderMessages(snapshot, options = { appendOnly: false }) {
  const user = window.currentUser;
  if (!user) return;
  const e2ePlaceholder = document.getElementById("e2ePlaceholder");
  if (!options.appendOnly) {
    chatContainer.innerHTML = "";
    if (e2ePlaceholder) chatContainer.appendChild(e2ePlaceholder);
    globalLastMessageDate = null;
  }
  snapshot.forEach(doc => {
    const data = doc.data();
    // skip kalau message dihapus untuk user ini
    if (data.deletedFor && data.deletedFor[user.uid]) return;
    const createdAtRaw = data.createdAt || data.localCreatedAt || Date.now();
    const msgDate = getMessageDate(createdAtRaw);
    // ===== DATE CARD =====
    if (!options.appendOnly && msgDate && isDifferentDay(msgDate, globalLastMessageDate)) {
      const dateCard = document.createElement("div");
      dateCard.className = "date-card";
      dateCard.innerText = formatDateCard(msgDate);
      chatContainer.appendChild(dateCard);
      globalLastMessageDate = msgDate;
    }
    const time = formatTime(createdAtRaw);
    // ===== ROW WRAPPER =====
    const rowEl = document.createElement("div");
    rowEl.classList.add("message-row");
    rowEl.classList.add(data.senderId === user.uid ? "user" : "partner");
    if (options.appendOnly) rowEl.classList.add("new");
    // ===== MESSAGE BUBBLE =====
    const msgEl = document.createElement("div");
    msgEl.classList.add("message");
    msgEl.classList.add(data.senderId === user.uid ? "user" : "partner");
    msgEl.dataset.id = doc.id;
    msgEl.dataset.senderId = data.senderId;
    // ===== DELETED MESSAGE =====
    if (data.deleted === true) {
      msgEl.innerHTML = `
        <div class="deleted-msg">
          <span>Pesan dihapus</span>
        </div>
        <div class="timestamp">${time}</div>
      `;
    } else {
      let replyHtml = "";
      if (data.replyTo && data.replyTo.text) {
        replyHtml = `
          <div class="reply-bubble">
            <div class="reply-author">Membalas pesan</div>
            <div class="reply-text-inline">
              ${data.replyTo.text.replace(/\n/g,'<br>')}
            </div>
          </div>
        `;
      }
      msgEl.innerHTML = `
        <div class="swipe-reply-icon"></div>
        ${replyHtml}
        <div class="message-text">
          ${data.text.replace(/\n/g,'<br>')}
          <div class="timestamp">
            ${time} ${getCheckIcon(data)}
          </div>
        </div>
      `;
    }
    rowEl.appendChild(msgEl);
    chatContainer.appendChild(rowEl);
    if (options.appendOnly) {
      rowEl.addEventListener('animationend', () => rowEl.classList.remove('new'));
    }
    globalLastMessageDate = msgDate;
  });
  // ===== AUTO SCROLL =====
  if (!preventAutoScroll) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  enableLongPressSelection();
}
function updateE2EPlaceholder(){
  const e2eCard = document.getElementById("e2ePlaceholder");
  if(!e2eCard) return;

  e2eCard.style.display = "flex"; // selalu tampil
}

// ===== SEND MESSAGE ===== //
document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", e => {
  if(e.key==="Enter" && e.ctrlKey){
    e.preventDefault();
    sendMessage();
  }
});
async function sendMessage() {
  const user = window.currentUser;
  if (!roomId || !user || !input) return;

  const typingRef = rtdb.ref(`typing/${roomId}/${user.uid}`);
  typingRef.set(false);

  const text = input.value.trim();
  if (!text) return;

  const localTime = Date.now();

  // ===== 🔥 AMBIL NAMA PENGIRIM (users / kurir) =====
  let senderName = "User";
  let senderType = "users";

  try {
    let myDoc = await db.collection("users").doc(user.uid).get();

    if (!myDoc.exists) {
      myDoc = await db.collection("kurir").doc(user.uid).get();
      senderType = "kurir";
    }

    if (myDoc.exists) {
      senderName = myDoc.data().nama || "User";
    }
  } catch (err) {
    console.warn("Ambil nama pengirim gagal:", err);
  }

  // ===== MESSAGE DATA =====
  const messageData = {
    senderId: user.uid,
    senderName,        // 🔥 simpan langsung (biar ringan & cepat)
    senderType,        // 🔥 kurir / users
    text,
    type: "text",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    localCreatedAt: localTime,
    deleted: false,
    deletedFor: {},

    deliveredTo: {
      [user.uid]: true
    },
    readBy: {
      [user.uid]: true
    }
  };

  // ===== REPLY =====
  if (replyState.active) {
    messageData.replyTo = {
      messageId: replyState.messageId,
      text: replyState.text
    };
  }

  // ===== OPTIMISTIC UI =====
  const tempMessage = {
    id: "temp_" + localTime,
    ...messageData,
    createdAt: localTime,
    isTemp: true
  };

  renderMessages({
    forEach: (cb) => cb({
      id: tempMessage.id,
      data: () => tempMessage
    })
  }, { appendOnly: true });

  // ===== RESET ROOM =====
  db.collection("chatRooms")
    .doc(roomId)
    .set({ deletedFor: {} }, { merge: true });

  try {
    // ===== SAVE MESSAGE =====
    await db.collection("chatRooms")
      .doc(roomId)
      .collection("messages")
      .add(messageData);

    // ===== UPDATE LAST MESSAGE =====
    await db.collection("chatRooms")
      .doc(roomId)
      .update({
        lastMessage: text,
        lastSenderId: user.uid,
        lastTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        lastType: "text"
      });

    // ===== 🔔 AMBIL TOKEN LAWAN =====
    let fcmToken = null;

    if (otherUserId) {
      let userDoc = await db.collection("users").doc(otherUserId).get();

      if (!userDoc.exists) {
        userDoc = await db.collection("kurir").doc(otherUserId).get();
      }

      if (userDoc.exists) {
        fcmToken = userDoc.data().fcmToken || null;
      }
    }

    // ===== 🔔 NOTIF WA STYLE =====
    if (fcmToken) {

      const previewText = text.length > 100
        ? text.substring(0, 100) + "..."
        : text;

      fetch("https://fcm-server-production-e176.up.railway.app/send-notif", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: fcmToken,

          notification: {
            title: senderName,     // 🔥 nama pengirim
            body: previewText,     // 🔥 isi pesan
            sound: "default"
          },

          android: {
            notification: {
              tag: "chat_" + roomId, // 🔥 biar notif gabung (WA style)
              channelId: "chat_messages",
              priority: "high"
            }
          },

          data: {
            roomId: roomId,
            senderId: user.uid,
            senderName: senderName,
            senderType: senderType,
            message: previewText
          }
        })
      }).catch(err => console.warn("Notif gagal:", err));
    }

  } catch (err) {
    console.error("Send message error:", err);
  }

  // ===== RESET INPUT =====
  input.value = "";
  input.style.height = "auto";
  cancelReply();
  input.focus();
}

// ===== REALTIME MESSAGES =====
async function loadOlderMessages(){
  if (!roomId || !oldestMessageDoc || loadingOldMessages) return;
  loadingOldMessages = true;
  const previousHeight = chatContainer.scrollHeight;
  const snapshot = await db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .orderBy("localCreatedAt")
    .endBefore(oldestMessageDoc)
    .limitToLast(30)
    .get();
  if (snapshot.empty){
    loadingOldMessages = false;
    return;
  }
  const fragment = document.createDocumentFragment();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const fakeSnapshot = {
      forEach: cb => cb({
        id: doc.id,
        data: () => data
      })
    };
    renderMessages(fakeSnapshot, { appendOnly:false });
  });
  oldestMessageDoc = snapshot.docs[0];
  requestAnimationFrame(()=>{
    const newHeight = chatContainer.scrollHeight;
    chatContainer.scrollTop = newHeight - previousHeight;
  });
  loadingOldMessages = false;
  scheduleVirtualize();
}
function processMessageBuffer(){
  if(messageBuffer.length === 0) return;
  const batch = [...messageBuffer];
  messageBuffer = [];
  batch.forEach(change=>{
    const doc = change.doc;
    const message = { id: doc.id, ...doc.data() };
    if(change.type === "added") appendSingleMessage(message);
    if(change.type === "modified") updateSingleMessage(message);
    if(change.type === "removed") removeSingleMessage(doc.id);
  });
}
function virtualizeMessages(){

  const rows = chatContainer.querySelectorAll(".message-row");

  if(rows.length <= VIRTUAL_WINDOW) return;

  const removeCount = rows.length - VIRTUAL_WINDOW;

  for(let i = 0; i < removeCount; i++){

    const row = rows[i];

    // jangan hapus jika sedang dipilih
    const msg = row.querySelector(".message");
    if(msg && msg.classList.contains("selected")) continue;

    row.remove();

  }

}
function scheduleVirtualize(){
  if(virtualizeTimer) clearTimeout(virtualizeTimer);
  virtualizeTimer = setTimeout(()=>{
    virtualizeMessages();
    virtualizeTimer = null;
  }, 120);
}
function setupRealtimeMessagesSafe(){
  const user = window.currentUser;
  if (!roomId || !user) return;
  // 🔒 Cegah listener dibuat dua kali untuk room yang sama
  if (window.activeRoomId === roomId && window.unsubscribeMessages){
    console.log("⚠️ Listener sudah aktif untuk room:", roomId);
    return;
  }
  console.log("🚀 Setup realtime messages untuk room:", roomId);
  // Matikan listener lama kalau pindah room
  if (window.unsubscribeMessages){
    window.unsubscribeMessages();
    window.unsubscribeMessages = null;
  }

  window.activeRoomId = roomId;

  const ref = db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .orderBy("localCreatedAt")
    .limitToLast(50);

  window.unsubscribeMessages = ref.onSnapshot(snapshot => {
  
    if(snapshot.docChanges().length){
      console.log("📨 Update:", snapshot.docChanges().map(c=>c.type));
    }
  
    if (!snapshot.empty) {
      oldestMessageDoc = snapshot.docs[0]; // 🔥 simpan pesan paling lama
    }
  
    snapshot.docChanges().forEach(change=>{
      messageBuffer.push(change);
    });
    
    if(!bufferTimer){
      bufferTimer = setTimeout(()=>{
        processMessageBuffer();
        bufferTimer = null;
      }, BUFFER_DELAY);
    }
  });
}
function appendSingleMessage(data) {
  if (!data || !data.id) return;
  const user = window.currentUser;
  if (!user) return;
  // 1️⃣ Jangan render jika sudah ada
  if (document.querySelector(`[data-id="${data.id}"]`)) {
    return;
  }
  // 2️⃣ Hapus temp message yang benar-benar cocok
  const tempEl = document.querySelector(`[data-id^="temp_"][data-sender-id="${data.senderId}"]`);
  if (tempEl) {
    const row = tempEl.closest(".message-row");
    if (row) row.remove();
  }
  // 3️⃣ Bungkus data seperti QuerySnapshot palsu
  const fakeSnapshot = {
    forEach(callback) {
      callback({
        id: data.id,
        data: () => data
      });
    }
  };
  // 4️⃣ Render append
  renderMessages(fakeSnapshot, { appendOnly: true });
  // 5️⃣ Update tracker tanggal
  const createdAtRaw = data.createdAt || data.localCreatedAt || Date.now();
  globalLastMessageDate = getMessageDate(createdAtRaw);
  scheduleVirtualize();
}
function updateSingleMessage(data) {
  const oldMsg = document.querySelector(`[data-id="${data.id}"]`);
  if (!oldMsg) return;
  // Hapus row parent (biar render ulang bersih)
  const row = oldMsg.closest(".message-row");
  if (row) row.remove();
  // Render ulang 1 pesan dengan state terbaru
  renderMessages({
    forEach: (cb) => {
      cb({
        id: data.id,
        data: () => data
      });
    }
  }, { appendOnly: true });
}
function removeSingleMessage(id) {
  const msgEl = document.querySelector(`[data-id="${id}"]`);
  if (!msgEl) return;
  const row = msgEl.closest(".message-row");
  if (row) row.remove();
}

// ===== LONG PRESS AND POPUP ACTION ===== //
function showSelectionPopup() {
  // Kalau sudah ada → hanya update counter
  if(actionBar){
    updateSelectionCount();
    return;
  }
  actionBar = document.createElement('div');
  actionBar.classList.add('selection-popup');
  // ===== LEFT SIDE (BACK + COUNT) =====
  const leftDiv = document.createElement('div');
  leftDiv.style.display = 'flex';
  leftDiv.style.alignItems = 'center';
  leftDiv.style.gap = '8px';
  // Tombol batalkan ⬅️
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#FB923C">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>`;
  cancelBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearSelection();
  });
  // 🔥 COUNTER ANGKA (WA STYLE)
  const countText = document.createElement('span');
  countText.id = "selectionCount";
  countText.style.fontWeight = '600';
  countText.style.fontSize = '16px';
  countText.style.color = '#333';
  countText.textContent = selectedMessages.size;
  leftDiv.appendChild(cancelBtn);
  leftDiv.appendChild(countText);
  // ===== RIGHT SIDE (COPY + DELETE) =====
  const rightDiv = document.createElement('div');
  rightDiv.style.display = 'flex';
  rightDiv.style.gap = '8px';
  // Tombol salin 📋
  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#FB923C">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`;
  copyBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const texts = Array.from(selectedMessages)
      .filter(msgEl => !msgEl.classList.contains('deleted'))
      .map(msgEl => msgEl.dataset.text || '')
      .join('\n');
    if(texts){
      navigator.clipboard.writeText(texts);
      if(navigator.vibrate) navigator.vibrate(10);
    }
    clearSelection();
  });
  // Tombol hapus 🗑 (FINAL WA SYSTEM)
  const delBtn = document.createElement('button');
  delBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#FB923C">
      <path d="M3 6h18M9 6v12m6-12v12M5 6l1 14h12l1-14"/>
    </svg>`;
  delBtn.addEventListener('click', e=>{
    e.stopPropagation();
    showDeleteOptions(); // 🔥 sekarang pakai popup pilihan WA
  });
  rightDiv.appendChild(copyBtn);
  rightDiv.appendChild(delBtn);
  actionBar.appendChild(leftDiv);
  actionBar.appendChild(rightDiv);
  document.body.appendChild(actionBar);
  // tampilkan animasi
  requestAnimationFrame(()=> actionBar.classList.add('show'));
  // update jumlah pertama
  updateSelectionCount();
}
function updateSelectionCount(){
  if(!actionBar) return;
  if(!countEl) return;
  const count = selectedMessages.size;
  countEl.textContent = count;
  // Auto vibrate kecil biar kerasa UX premium
  if(navigator.vibrate && count > 0){
    navigator.vibrate(5);
  }
}
function clearSelection() {
  selectedMessages.forEach(msgEl => msgEl.classList.remove('selected'));
  selectedMessages.clear();
  if(actionBar){
    actionBar.classList.remove('show');
    setTimeout(()=> { actionBar.remove(); actionBar=null; }, 200);
  }
}
function showDeleteOptions(){
  if(selectedMessages.size === 0) return;
  let hasOtherUserMsg = false;
  selectedMessages.forEach(msgEl=>{
    if(msgEl.dataset.senderId !== window.currentUser.uid){
      hasOtherUserMsg = true;
    }
  });
  // Overlay (background gelap)
  const overlay = document.createElement("div");
  overlay.className = "delete-overlay";
  // Popup box (tengah layar)
  const popup = document.createElement("div");
  popup.className = "delete-popup";
  // Hitung jumlah pesan yang dipilih
  const selectedCount = selectedMessages.size;
  // Format teks (1 pesan / 2 pesan / 10 pesan)
  const titleText = selectedCount === 1 
    ? `Hapus ${selectedCount} pesan?`
    : `Hapus ${selectedCount} pesan?`;
  popup.innerHTML = `
    <div class="delete-header">
      <div class="delete-title">Hapus ${selectedMessages.size} pesan?</div>
      <div class="delete-actions">
        <button class="delete-btn delete-me" id="deleteMeBtn">
          Hapus untuk saya
        </button>
        ${hasOtherUserMsg ? "" : `
        <button class="delete-btn delete-everyone" id="deleteEveryoneBtn">
          Hapus untuk semua
        </button>
        `}
        <button class="delete-btn delete-cancel" id="cancelDeleteBtn">
          Batal
        </button>
      </div>
    </div>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  // ===== CLICK OUTSIDE = CLOSE (UX MODERN) =====
  overlay.addEventListener("click", (e)=>{
    if(e.target === overlay){
      closeDeletePopup(overlay);
    }
  });
  // Prevent klik dalam popup agar tidak close
  popup.addEventListener("click", (e)=>{
    e.stopPropagation();
  });
  // Tombol batal
  document.getElementById("cancelDeleteBtn").onclick = ()=>{
    closeDeletePopup(overlay);
  };
  // Delete for me
  document.getElementById("deleteMeBtn").onclick = ()=>{
    deleteForMe();
    closeDeletePopup(overlay);
  };
  // Delete for everyone (jika ada)
  const delEveryoneBtn = document.getElementById("deleteEveryoneBtn");
  if(delEveryoneBtn){
    delEveryoneBtn.onclick = ()=>{
      deleteForEveryone();
      closeDeletePopup(overlay);
    };
  }
}
function closeDeletePopup(overlay){
  overlay.style.opacity = "0";
  overlay.style.transition = "0.15s ease";
  setTimeout(()=>{
    overlay.remove();
  },150);
}
function deleteForMe(){
  selectedMessages.forEach(msgEl=>{
    const msgId = msgEl.dataset.id;
    // animasi fade
    msgEl.classList.add("deleting");
    setTimeout(()=>{
      msgEl.remove();
    },200);
    // simpan flag di firestore
    db.collection("chatRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId)
      .update({
        [`deletedFor.${window.currentUser.uid}`]: true
      });
  });
  if(navigator.vibrate) navigator.vibrate(10);
  clearSelection();
}
function deleteForEveryone(){
  selectedMessages.forEach(msgEl=>{
    // BLOCK kalau bukan pesan sendiri
    if(msgEl.dataset.senderId !== currentUser.uid){
      if(navigator.vibrate) navigator.vibrate([20,50,20]);
      return;
    }
    const msgId = msgEl.dataset.id;
    // animasi fade WA
    msgEl.classList.add("deleting");
    setTimeout(()=>{
      msgEl.classList.remove("deleting");
      msgEl.classList.add("deleted");
    },180);
    // update database global
    db.collection("chatRooms")
      .doc(roomId)
      .collection("messages")
      .doc(msgId)
      .update({
        deleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedBy: currentUser.uid
      });
  });
  if(navigator.vibrate) navigator.vibrate([10,30,10]);
  clearSelection();
}
document.addEventListener('click', e=>{
  if(selectedMessages.size === 0) return;

  const clickedMessage = e.target.closest('.message');
  const clickedActionBar = e.target.closest('.selection-popup');
  
  // jangan cancel kalau sedang long press mode
  if(e.target.closest('.message-row')) return;
  
  // Jika klik bubble lain → JANGAN batal (biar bisa multi select)
  if(clickedMessage) return;
  
  // Jika klik action bar → JANGAN batal
  if(clickedActionBar) return;

  // Baru batal kalau klik area kosong
  clearSelection();
});
function enableLongPressSelection() {
  document.querySelectorAll('.message-row').forEach(rowEl => {
    if (rowEl.dataset.listener === "true") return;
    rowEl.dataset.listener = "true";
    const msgEl = rowEl.querySelector('.message');
    if(!msgEl) return;
    // Ambil text untuk reply/copy
    const divs = msgEl.querySelectorAll('div');
    let messageText = "";
    if(divs.length >= 3){
      messageText = divs[divs.length - 2].innerText;
    } else if(divs.length === 2){
      messageText = divs[0].innerText;
    }
    msgEl.dataset.text = messageText;
    let startX = 0, startY = 0, currentX = 0;
    let isSwiping = false, moved = false, longPressTriggered = false, touchStarted = false;
    const MAX_SWIPE = 120, REPLY_THRESHOLD = 60, LONG_PRESS_DELAY = 400;
    // Toggle select
    const toggleSelect = () => {
      longPressTriggered = true;
      const isSelected = msgEl.classList.toggle('selected');
      if(isSelected) selectedMessages.add(msgEl);
      else selectedMessages.delete(msgEl);
      if(selectedMessages.size > 0) showSelectionPopup();
      else clearSelection();
      if(navigator.vibrate) navigator.vibrate(8);
    };
    // Tap saat mode select
    msgEl.addEventListener('click', (e) => {
      if(selectedMessages.size > 0 && !isSwiping){
        e.stopPropagation();
        toggleSelect();
      }
    });
    // ===== TOUCH START =====
    rowEl.addEventListener('touchstart', e => {
      touchStarted = true;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      moved = false;
      isSwiping = false;
      longPressTriggered = false;
      longPressTimer = setTimeout(() => {
        if(!moved && touchStarted) toggleSelect();
      }, LONG_PRESS_DELAY);
    }, {passive:true});
    // ===== TOUCH MOVE =====
    rowEl.addEventListener('touchmove', e => {
      if(!touchStarted) return;
      const touch = e.touches[0];
      currentX = touch.clientX;
      const currentY = touch.clientY;
      const diffX = currentX - startX;
      const diffY = Math.abs(currentY - startY);
      // Scroll vertikal → batal long press
      if(diffY > 30){
        clearTimeout(longPressTimer);
        return;
      }
      // Swipe kanan = reply
      if(diffX > 10){
        moved = true;
        isSwiping = true;
        clearTimeout(longPressTimer);
        const drag = Math.min(diffX, MAX_SWIPE);
        msgEl.style.transform = `translateX(${drag}px)`;
        msgEl.classList.add("swiping");
      }
    }, {passive:true});
    // ===== TOUCH END =====
    rowEl.addEventListener('touchend', () => {
      touchStarted = false;
      clearTimeout(longPressTimer);
      const diffX = currentX - startX;
      // Reset posisi swipe animasi
      msgEl.style.transition = "transform 0.2s ease";
      msgEl.style.transform = "translateX(0)";
      msgEl.classList.remove("swiping");
      setTimeout(()=>{ msgEl.style.transition = ""; }, 200);
      // Trigger reply
      if(isSwiping && diffX > REPLY_THRESHOLD && !longPressTriggered){
        const text = msgEl.dataset.text || "";
        const msgId = msgEl.dataset.id;
        if(text && !msgEl.classList.contains('deleted')){
          if(navigator.vibrate) navigator.vibrate(10);
          showReplyPopup(text, msgId);
        }
      }
      isSwiping = false;
    });
    // ===== DESKTOP SUPPORT =====
    msgEl.addEventListener('mousedown', () => {
      longPressTimer = setTimeout(toggleSelect, LONG_PRESS_DELAY);
    });
    msgEl.addEventListener('mouseup', () => clearTimeout(longPressTimer));
    msgEl.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
  });
}

// ===== FORMAT TIMESTAMP ===== //
function formatTime(createdAt){
  if(!createdAt) return "";
  // 1️⃣ Timestamp Firestore (realtime)
  if(typeof createdAt.toDate === "function"){
    return createdAt.toDate().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  // 2️⃣ Timestamp dari cache (millis number) ← INI BIAR CEPAT
  if(typeof createdAt === "number"){
    const date = new Date(createdAt);
    if(isNaN(date)) return "";
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  // 3️⃣ Format seconds (fallback firestore lama)
  if(createdAt.seconds){
    const date = new Date(createdAt.seconds * 1000);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return "";
}
function getMessageDate(timestamp){
  if (!timestamp) return null;
  // Support Firebase Timestamp & local number
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}
function isDifferentDay(date1, date2){
  if (!date1 || !date2) return true;
  return (
    date1.getDate() !== date2.getDate() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getFullYear() !== date2.getFullYear()
  );
}
function formatDateCard(date){
  const now = new Date();
  const diffTime = now - date;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  // ≤ 7 hari = nama hari (Senin)
  if (diffDays <= 7){
    return date.toLocaleDateString('id-ID', {
      weekday: 'long'
    });
  }

  // > 7 hari = 1 Januari 2026
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// CENTANG WA //
function getCheckIcon(data) {
  const user = window.currentUser;
  if(!user) return "";
  if (data.senderId !== user.uid) return "";
  const deliveredTo = data.deliveredTo || {};
  const readBy = data.readBy || {};
  const deliveredCount = Object.keys(deliveredTo).length;
  const readCount = Object.keys(readBy).length;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" 
         viewBox="0 0 16 16" 
         fill="currentColor" 
         class="check-icon">
      <path fill-rule="evenodd" 
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" 
        clip-rule="evenodd"/>
    </svg>
  `;
  // SENT (baru dikirim)
  if (deliveredCount <= 1) {
    return `<span class="check sent">${svg}</span>`;
  }
  // DELIVERED (sudah sampai device lawan)
  if (deliveredCount > 1 && readCount <= 1) {
    return `<span class="check delivered">${svg}</span>`;
  }
  // READ (sudah dibaca)
  if (readCount > 1) {
    return `<span class="check read">${svg}</span>`;
  }
  return `<span class="check sent">${svg}</span>`;
}
function markAsDeliveredRealtime() {
  const user = window.currentUser;
  if (!user || !roomId) return;
  db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        // skip pesan sendiri
        if (data.senderId === user.uid) return;
        if (!data.deliveredTo?.[user.uid]) {
          doc.ref.update({
            [`deliveredTo.${user.uid}`]: true
          });
        }
      });
    });
}
function markAsReadRealtime() {
  const user = window.currentUser;
  if (!user || !roomId) return;
  db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .onSnapshot(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        // skip pesan sendiri
        if (data.senderId === user.uid) return;
        if (!data.readBy?.[user.uid]) {
          doc.ref.update({
            [`readBy.${user.uid}`]: true
          });
        }
      });
    });
}

// ===== FLOATING BUTTON SCROLL ===== //
function isUserNearBottom() {
  const threshold = 120; // jarak toleransi (px)
  const position = chatContainer.scrollTop + chatContainer.clientHeight;
  const height = chatContainer.scrollHeight;
  return height - position < threshold;
}
chatContainer.addEventListener("scroll", () => {
  if (!chatContainer) return;
  // ===== LOAD PESAN LAMA SAAT SCROLL KE ATAS =====
  if (chatContainer.scrollTop < 80) {
    loadOlderMessages();
  }
  // ===== FLOATING BUTTON =====
  if (isUserNearBottom()) {
    scrollBtn.classList.remove("show");
  } else {
    scrollBtn.classList.add("show");
  }
  scheduleVirtualize();
});
// ===== KLIK BUTTON SCROLL KE BAWAH ===== //
scrollBtn.addEventListener("click", () => {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth"
  });
  // Vibrate kecil (premium UX)
  if (navigator.vibrate) navigator.vibrate(8);
});

// ===== REPLY MESSAGE ===== //
function showReplyPopup(text, msgId){
  replyState.active = true;
  replyState.messageId = msgId;
  replyState.text = text;
  replyTextEl.innerText = text;
  replyPopup.classList.add("show");
  // ❌ NONAKTIFKAN scroll otomatis saat reply popup
  preventAutoScroll = true;
  // Fokus ke textarea supaya keyboard muncul
  input.focus();
  // Taruh cursor di akhir
  const val = input.value;
  input.value = "";
  input.value = val;
  // Tunggu layout stabil baru adjust
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      adjustInputRadius();
      adjustInputHeight();
      adjustChatPadding(false); // forceScroll = false, tetap tidak scroll ke bawah
    });
  });
}
function cancelReply(){
  // Simpan posisi cursor dulu
  const cursorPos = input.selectionStart;
  replyState.active = false;
  replyState.messageId = null;
  replyState.text = "";
  replyPopup.classList.remove("show");
  // Jangan aktifkan scroll dulu
  preventAutoScroll = true;
  // Paksa tetap fokus (ANTI KEYBOARD CLOSE)
  requestAnimationFrame(() => {
    input.focus();
    // Kembalikan posisi cursor
    input.setSelectionRange(cursorPos, cursorPos);
    adjustInputRadius();
    adjustInputHeight();
    adjustChatPadding(false);
    // Aktifkan lagi auto scroll setelah stabil
    setTimeout(() => {
      preventAutoScroll = false;
    }, 150);
  });
}
// 1️⃣ Cegah textarea kehilangan fokus
cancelReplyBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();   // cegah blur
});
// 2️⃣ Logic cancel tetap normal
cancelReplyBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  cancelReply();
  // pastikan tetap fokus
  requestAnimationFrame(() => {
    input.focus();
  });
});

// ===== INPUTBOX AUTO RADIUS ===== //
function adjustInputRadius() {
  const baseRadius = 24;
  const minTopRadius = 14;
  const lineHeight = 20; // samakan dengan textarea CSS
  if (!replyState.active) {
    inputBox.style.borderRadius = "24px";
    return;
  }
  const currentHeight = input.scrollHeight;
  const lines = Math.ceil(currentHeight / lineHeight);
  if (lines <= 1) {
    inputBox.style.borderRadius = "18px 18px 24px 24px";
    return;
  }
  let topRadius = baseRadius - (lines * 8);
  if (topRadius < minTopRadius) topRadius = minTopRadius;
  inputBox.style.borderRadius = `${topRadius}px ${topRadius}px 24px 24px`;
}
// ===== TINGGI TEXTAREA ===== //
function adjustInputHeight() {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}
// ===== PADDING CHAT ===== //
function adjustChatPadding(forceScroll = false) {
  const inputHeight = inputContainer.offsetHeight;
  const headerHeight = header.offsetHeight;
  const extraTop = 8;     // jarak chat pertama ke header
  const extraBottom = 70; // jarak chat terakhir ke input
  const viewportOffset = window.innerHeight - (window.visualViewport?.height || window.innerHeight);
  // Padding dinamis
  chatContainer.style.paddingTop = headerHeight + extraTop + "px";
  chatContainer.style.paddingBottom = inputHeight + extraBottom + viewportOffset + "px";
  if (!preventAutoScroll && (forceScroll || isUserNearBottom())) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// ===== chat & input naik saat keyboard muncul ===== //
function updateOnKeyboard() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportOffset = window.innerHeight - viewportHeight;

  // header tetap di atas
  header.style.top = (window.visualViewport?.offsetTop || 0) + 'px';

  // input container di atas keyboard
  inputContainer.style.bottom = viewportOffset + 'px';

  // chat container ikut naik
  adjustChatPadding(false);

  // reply popup ikut naik
  if (replyPopup && replyState.active) {
    const inputHeight = inputContainer.offsetHeight;
    replyPopup.style.bottom = inputHeight + 16 + viewportOffset + 'px';
  }
}
// event resize viewport (keyboard muncul)
window.visualViewport?.addEventListener('resize', updateOnKeyboard);
// event awal load halaman
window.addEventListener('load', () => {
  adjustChatPadding(true);
});
// juga ketika textarea input berubah
input.addEventListener('input', () => {
  adjustInputHeight();
  adjustInputRadius();
  adjustChatPadding(false);
});
// saat focus, tunggu keyboard muncul dulu
input.addEventListener("focus", () => {
  setTimeout(() => {
    adjustChatPadding(true);
  }, 300);
});

// ===== EMOJI PICKER ===== //
const emojis = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭'];
emojis.forEach(e=>{
  const span = document.createElement('span');
  span.style.cursor='pointer';
  span.style.fontSize='20px';
  span.textContent = e;
  span.addEventListener('click', ()=>{
    input.value += e;
    input.focus();
    input.dispatchEvent(new Event('input'));
  });
  emojiPopup.appendChild(span);
});
emojiBtn.addEventListener('click', e=>{
  e.stopPropagation();
  emojiPopup.classList.toggle('show');
});
document.addEventListener('click', e=>{
  if(!emojiPopup.contains(e.target) && !emojiBtn.contains(e.target)){
    emojiPopup.classList.remove('show');
  }
});