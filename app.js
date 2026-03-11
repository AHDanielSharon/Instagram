const state = {
  activeChatId: null,
  disappearing: false,
  installPromptEvent: null,
  voiceRecorder: null,
  recordedChunks: []
};

const storeKey = "pulsemesh.v3";

const db = {
  auth: { loggedIn: false, phone: "", verified: false },
  profile: { name: "", about: "", created: false },
  contacts: [],
  chats: [],
  status: [],
  calls: [],
  communities: [],
  channels: []
};

const el = {
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".panel")],
  chatsPanel: document.querySelector("#panel-chats"),
  statusPanel: document.querySelector("#panel-status"),
  callsPanel: document.querySelector("#panel-calls"),
  communitiesPanel: document.querySelector("#panel-communities"),
  channelsPanel: document.querySelector("#panel-channels"),
  settingsPanel: document.querySelector("#panel-settings"),
  search: document.querySelector("#globalSearch"),
  list: document.querySelector("#messageList"),
  title: document.querySelector("#activeTitle"),
  subtitle: document.querySelector("#activeSubtitle"),
  composer: document.querySelector("#composer"),
  composerInput: document.querySelector("#composerInput"),
  themeBtn: document.querySelector("#themeBtn"),
  installBtn: document.querySelector("#installBtn"),
  newContactBtn: document.querySelector("#newContactBtn"),
  loginBtn: document.querySelector("#loginBtn"),
  profileBtn: document.querySelector("#profileBtn"),
  addStatusBtn: document.querySelector("#addStatusBtn"),
  createChannelBtn: document.querySelector("#createChannelBtn"),
  passcodeBtn: document.querySelector("#passcodeBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  toggleDisappear: document.querySelector("#toggleDisappear"),
  disappearingBadge: document.querySelector("#disappearingBadge"),
  emojiBtn: document.querySelector("#emojiBtn"),
  attachBtn: document.querySelector("#attachBtn"),
  scheduleBtn: document.querySelector("#scheduleBtn"),
  recordBtn: document.querySelector("#recordBtn"),
  voiceCallBtn: document.querySelector("#voiceCallBtn"),
  videoCallBtn: document.querySelector("#videoCallBtn"),
  fileInput: document.querySelector("#fileInput"),
  storageStat: document.querySelector("#storageStat"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalClose: document.querySelector("#modalClose")
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const esc = (t) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify({ db, state: { activeChatId: state.activeChatId, disappearing: state.disappearing } }));
}

function loadState() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.db) Object.assign(db, parsed.db);
    if (parsed?.state?.activeChatId) state.activeChatId = parsed.state.activeChatId;
    if (typeof parsed?.state?.disappearing === "boolean") state.disappearing = parsed.state.disappearing;
  } catch {
    localStorage.removeItem(storeKey);
  }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getActiveChat() {
  return db.chats.find((c) => c.id === state.activeChatId) || null;
}

function openModal(title, body) {
  el.modalTitle.textContent = title;
  el.modalBody.textContent = body;
  el.modal.showModal();
}

function emptyCard(title, subtitle) {
  return `<article class="item"><div class="meta"><h4>${esc(title)}</h4><p>${esc(subtitle)}</p></div></article>`;
}

function itemCard({ id, title, subtitle, unread = 0, active = false }) {
  return `<article class="item ${active ? "active" : ""}" data-id="${id}">
    <div class="avatar"></div>
    <div class="meta"><h4>${esc(title)}</h4><p>${esc(subtitle)}</p></div>
    ${unread ? `<span class="badge">${unread}</span>` : ""}
  </article>`;
}

function ensureChatForContact(contact) {
  let chat = db.chats.find((c) => c.phone === contact.phone);
  if (!chat) {
    chat = { id: uid(), phone: contact.phone, name: contact.name, role: contact.phone, unread: 0, messages: [] };
    db.chats.unshift(chat);
  }
  return chat;
}

function renderChats(filter = "") {
  const q = filter.trim().toLowerCase();
  const visible = db.chats.filter((c) => `${c.name} ${c.phone} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q));
  if (!visible.length) {
    el.chatsPanel.innerHTML = emptyCard("0 contacts / 0 chats", "Add a contact by phone number to start.");
    return;
  }
  el.chatsPanel.innerHTML = visible
    .map((c) =>
      itemCard({
        id: c.id,
        title: c.name,
        subtitle: `${c.phone} • ${c.messages.at(-1)?.text || "No messages yet"}`,
        unread: c.unread,
        active: c.id === state.activeChatId
      })
    )
    .join("");
}

function renderStatus() {
  if (!db.status.length) {
    el.statusPanel.innerHTML = emptyCard("No status yet", "Post your first text/photo/video status.");
    return;
  }
  el.statusPanel.innerHTML = db.status.map((s, i) => itemCard({ id: `s-${i}`, title: s.author, subtitle: `${s.type} • ${s.text}` })).join("");
}

function renderCalls() {
  if (!db.calls.length) {
    el.callsPanel.innerHTML = emptyCard("No calls yet", "Start a voice or video call from a chat.");
    return;
  }
  el.callsPanel.innerHTML = db.calls.map((c, i) => itemCard({ id: `call-${i}`, title: c.with, subtitle: `${c.mode} • ${c.when}` })).join("");
}

function renderChannels() {
  if (!db.channels.length) {
    el.channelsPanel.innerHTML = emptyCard("No channels yet", "Create a channel to publish updates.");
    return;
  }
  el.channelsPanel.innerHTML = db.channels.map((c, i) => itemCard({ id: `ch-${i}`, title: c.name, subtitle: `${c.followers} followers` })).join("");
}

function renderCommunities() {
  if (!db.communities.length) {
    el.communitiesPanel.innerHTML = emptyCard("No communities yet", "Create a community when your members join.");
    return;
  }
  el.communitiesPanel.innerHTML = db.communities.map((c, i) => itemCard({ id: `co-${i}`, title: c.name, subtitle: `${c.members} members` })).join("");
}

function renderSettings() {
  const rows = [
    ["Phone Login", db.auth.loggedIn ? `Logged in as ${db.auth.phone}` : "Not logged in"],
    ["Profile", db.profile.created ? `${db.profile.name} • ${db.profile.about}` : "Not created"],
    ["Privacy", "Passcode, disappearing messages, export"],
    ["Media", "Send PDF, images, videos, music, links, documents"],
    ["Calls", "Voice and video calling controls"]
  ];
  el.settingsPanel.innerHTML = rows.map((r, i) => itemCard({ id: `set-${i}`, title: r[0], subtitle: r[1] })).join("");
}

function renderMessages() {
  const chat = getActiveChat();
  if (!chat) {
    el.title.textContent = "Welcome to PulseMesh";
    el.subtitle.textContent = "0 contacts. Login, add contact by phone, then chat.";
    el.list.innerHTML = `<article class="msg them"><div>No active chat.</div><div class="msg-time">Add a contact to start.</div></article>`;
    return;
  }

  el.title.textContent = chat.name;
  el.subtitle.textContent = `${chat.phone} • encrypted session`;
  el.list.innerHTML = chat.messages
    .map((m) => `<article class="msg ${m.from}"><div>${esc(m.text)}</div><div class="msg-time">${fmtTime(m.ts)}</div></article>`)
    .join("");
  el.list.scrollTop = el.list.scrollHeight;
}

function renderAll(filter = "") {
  renderChats(filter);
  renderStatus();
  renderCalls();
  renderCommunities();
  renderChannels();
  renderSettings();
  renderMessages();
  el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
  saveState();
}

function loginFlow() {
  const phone = prompt("Enter phone number with country code (example +919999999999):", db.auth.phone || "");
  if (!phone) return;
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const entered = prompt(`OTP sent to ${phone}. Demo OTP: ${otp}\nEnter OTP:`);
  if (entered !== otp) {
    openModal("Login failed", "Incorrect OTP.");
    return;
  }
  db.auth = { loggedIn: true, phone, verified: true };
  openModal("Login successful", `Logged in as ${phone}`);
  renderAll(el.search.value);
}

function profileFlow() {
  if (!db.auth.loggedIn) return openModal("Login required", "Please login with phone number first.");
  const name = prompt("Profile name:", db.profile.name || "");
  if (!name) return;
  const about = prompt("About:", db.profile.about || "Available") || "Available";
  db.profile = { name, about, created: true };
  renderAll(el.search.value);
}

function addContactFlow() {
  if (!db.auth.loggedIn) return openModal("Login required", "Please login with phone number first.");
  const phone = prompt("Enter contact phone number:");
  if (!phone) return;
  const name = prompt("Save contact name:", phone) || phone;
  if (db.contacts.some((c) => c.phone === phone)) return openModal("Contact exists", "This phone number is already saved.");

  const contact = { id: uid(), phone, name };
  db.contacts.push(contact);
  const chat = ensureChatForContact(contact);
  state.activeChatId = chat.id;
  renderAll(el.search.value);
}

function callFlow(mode) {
  const chat = getActiveChat();
  if (!chat) return openModal("No active contact", `Add/select a contact before starting ${mode.toLowerCase()} call.`);
  db.calls.unshift({ with: `${chat.name} (${chat.phone})`, mode, when: new Date().toLocaleString() });
  openModal(`${mode} Call`, `${mode} call started with ${chat.name}.\n\nIn production this requires realtime signaling + media servers.`);
  renderCalls();
  saveState();
}

async function generateSeedPhrase() {
  const words = ["pulse", "mesh", "anchor", "orbit", "neon", "cipher", "vault", "signal", "lumen", "secure", "bridge", "node"];
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return [...arr].map((n) => words[n % words.length]).join(" ");
}

async function encryptExport(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const encoded = new TextEncoder().encode(text);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { iv: btoa(String.fromCharCode(...iv)), payload: btoa(String.fromCharCode(...new Uint8Array(cipher))) };
}

async function updateStorageStats() {
  if (!navigator.storage?.estimate) {
    el.storageStat.textContent = "Storage API unavailable in this browser.";
    return;
  }
  const est = await navigator.storage.estimate();
  const mb = (n) => ((n ?? 0) / (1024 * 1024)).toFixed(2);
  el.storageStat.textContent = `Used ${mb(est.usage)} MB / Quota ${mb(est.quota)} MB`;
}

function sendMessage(text) {
  const chat = getActiveChat();
  if (!chat) return openModal("No active chat", "Add and select a contact first.");
  chat.messages.push({ from: "me", text, ts: Date.now() });
  if (state.disappearing) {
    setTimeout(() => {
      chat.messages = chat.messages.filter((m) => m.text !== text);
      renderMessages();
      saveState();
    }, 120000);
  }
  renderMessages();
  renderChats(el.search.value);
  saveState();
}

function bindEvents() {
  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      el.tabs.forEach((t) => t.classList.toggle("active", t === tab));
      const panel = tab.dataset.panel;
      el.panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${panel}`));
    });
  });

  document.addEventListener("click", (e) => {
    const item = e.target.closest("#panel-chats .item[data-id]");
    if (!item) return;
    state.activeChatId = item.dataset.id;
    renderAll(el.search.value);
  });

  el.search.addEventListener("input", (e) => renderChats(e.target.value));
  el.themeBtn.addEventListener("click", () => document.body.classList.toggle("light"));
  el.loginBtn.addEventListener("click", loginFlow);
  el.profileBtn.addEventListener("click", profileFlow);
  el.newContactBtn.addEventListener("click", addContactFlow);

  el.createChannelBtn.addEventListener("click", () => {
    const name = prompt("Channel name:");
    if (!name) return;
    db.channels.unshift({ name, followers: 1 });
    renderChannels();
    saveState();
  });

  el.addStatusBtn.addEventListener("click", () => {
    if (!db.profile.created) return openModal("Create profile first", "Set your profile before posting status.");
    const text = prompt("Status text:");
    if (!text) return;
    db.status.unshift({ author: db.profile.name || db.auth.phone, text, type: "Text Status" });
    renderStatus();
    saveState();
  });

  el.voiceCallBtn.addEventListener("click", () => callFlow("Voice"));
  el.videoCallBtn.addEventListener("click", () => callFlow("Video"));

  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.composerInput.value.trim();
    if (!text) return;
    sendMessage(text);
    el.composerInput.value = "";
  });

  el.attachBtn.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", () => {
    const files = [...el.fileInput.files || []];
    files.forEach((f) => sendMessage(`📎 ${f.name} (${Math.round(f.size / 1024)} KB)`));
    el.fileInput.value = "";
  });

  el.emojiBtn.addEventListener("click", () => {
    el.composerInput.value += "✨";
    el.composerInput.focus();
  });

  el.scheduleBtn.addEventListener("click", () => {
    const value = Number(prompt("Schedule in seconds:", "10"));
    if (!Number.isFinite(value) || value <= 0) return;
    const msg = el.composerInput.value.trim();
    if (!msg) return;
    el.composerInput.value = "";
    setTimeout(() => sendMessage(`⏰ ${msg}`), value * 1000);
  });

  el.recordBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    if (!chat) return openModal("No active chat", "Add/select a contact first.");
    if (!navigator.mediaDevices?.getUserMedia) return openModal("Voice note", "Audio recording unavailable in this browser.");

    if (!state.voiceRecorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      state.recordedChunks = [];
      recorder.ondataavailable = (ev) => state.recordedChunks.push(ev.data);
      recorder.onstop = () => sendMessage(`🎵 Voice note (${state.recordedChunks.length} chunks)`);
      recorder.start();
      state.voiceRecorder = recorder;
      el.recordBtn.textContent = "⏹";
    } else {
      state.voiceRecorder.stop();
      state.voiceRecorder = null;
      el.recordBtn.textContent = "🎙";
    }
  });

  el.toggleDisappear.addEventListener("click", () => {
    state.disappearing = !state.disappearing;
    el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
    saveState();
  });

  el.passcodeBtn.addEventListener("click", () => {
    const pass = prompt("Set local passcode:");
    if (!pass) return;
    localStorage.setItem("pulsemesh.passcode", btoa(pass));
    openModal("Passcode", "Passcode set successfully.");
  });

  el.seedBtn.addEventListener("click", async () => {
    const seed = await generateSeedPhrase();
    openModal("Recovery phrase", seed);
  });

  el.exportBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    if (!chat) return openModal("Nothing to export", "No active chat to export.");
    const payload = await encryptExport(JSON.stringify(chat.messages, null, 2));
    openModal("Encrypted Export", JSON.stringify(payload, null, 2));
  });

  el.clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all local app data?")) return;
    localStorage.clear();
    location.reload();
  });

  el.installBtn.addEventListener("click", () => state.installPromptEvent?.prompt());
  el.modalClose.addEventListener("click", () => el.modal.close());
}

function setupPWA() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPromptEvent = e;
    el.installBtn.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    state.installPromptEvent = null;
    el.installBtn.classList.add("hidden");
  });
}

loadState();
if (db.chats.length && !state.activeChatId) state.activeChatId = db.chats[0].id;
renderAll();
bindEvents();
setupPWA();
updateStorageStats();
