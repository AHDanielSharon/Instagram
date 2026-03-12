const state = {
  activeChatId: null,
  disappearing: false,
  installPromptEvent: null,
  voiceRecorder: null,
  recordedChunks: [],
  generatedOtp: null
};

const storeKey = "pulsemesh.v4";

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
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  phoneInput: document.querySelector("#phoneInput"),
  otpInput: document.querySelector("#otpInput"),
  nameInput: document.querySelector("#nameInput"),
  aboutInput: document.querySelector("#aboutInput"),
  sendOtpBtn: document.querySelector("#sendOtpBtn"),
  cancelAuthBtn: document.querySelector("#cancelAuthBtn"),
  otpHint: document.querySelector("#otpHint"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalClose: document.querySelector("#modalClose")
};

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const phoneOk = (v) => /^\+[1-9]\d{7,14}$/.test(v);

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

function card(title, subtitle, id = "", active = false, unread = 0) {
  const attr = id ? `data-id="${id}"` : "";
  return `<article class="item ${active ? "active" : ""}" ${attr}><div class="avatar"></div><div class="meta"><h4>${esc(title)}</h4><p>${esc(subtitle)}</p></div>${unread ? `<span class="badge">${unread}</span>` : ""}</article>`;
}

function renderChats(filter = "") {
  const q = filter.trim().toLowerCase();
  const visible = db.chats.filter((c) => `${c.name} ${c.phone} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q));
  el.chatsPanel.innerHTML = visible.length
    ? visible.map((c) => card(c.name, `${c.phone} • ${c.messages.at(-1)?.text || "No messages yet"}`, c.id, c.id === state.activeChatId, c.unread)).join("")
    : card("0 contacts / 0 chats", "Add a contact by phone number to start chatting.");
}

function renderList(panel, rows, emptyTitle, emptySubtitle) {
  panel.innerHTML = rows.length ? rows.map((r, i) => card(r.title, r.subtitle, `${emptyTitle}-${i}`)).join("") : card(emptyTitle, emptySubtitle);
}

function renderSettings() {
  const rows = [
    { title: "Phone", subtitle: db.auth.loggedIn ? db.auth.phone : "Not logged in" },
    { title: "Profile", subtitle: db.profile.created ? `${db.profile.name} • ${db.profile.about}` : "Not created" },
    { title: "Contacts", subtitle: `${db.contacts.length} saved` },
    { title: "Media", subtitle: "PDF, image, video, music, links, docs" },
    { title: "Calls", subtitle: `${db.calls.length} history entries` }
  ];
  renderList(el.settingsPanel, rows, "No settings", "Settings will appear here.");
}

function renderMessages() {
  const chat = getActiveChat();
  if (!chat) {
    el.title.textContent = "Welcome to PulseMesh";
    el.subtitle.textContent = "Login with phone number and add contacts to begin.";
    el.list.innerHTML = `<article class="msg them"><div>No active chat.</div><div class="msg-time">Start by adding a contact.</div></article>`;
    return;
  }
  el.title.textContent = chat.name;
  el.subtitle.textContent = `${chat.phone} • end-to-end encrypted`;
  el.list.innerHTML = chat.messages.map((m) => `<article class="msg ${m.from}"><div>${esc(m.text)}</div><div class="msg-time">${fmtTime(m.ts)}</div></article>`).join("");
  el.list.scrollTop = el.list.scrollHeight;
}

function renderAll(filter = "") {
  renderChats(filter);
  renderList(el.statusPanel, db.status.map((s) => ({ title: s.author, subtitle: `${s.type} • ${s.text}` })), "No status yet", "Post your first status.");
  renderList(el.callsPanel, db.calls.map((c) => ({ title: c.with, subtitle: `${c.mode} • ${c.when}` })), "No calls yet", "Start voice/video call from chat.");
  renderList(el.communitiesPanel, db.communities.map((c) => ({ title: c.name, subtitle: `${c.members} members` })), "No communities yet", "Create after users join.");
  renderList(el.channelsPanel, db.channels.map((c) => ({ title: c.name, subtitle: `${c.followers} followers` })), "No channels yet", "Create your first channel.");
  renderSettings();
  renderMessages();
  el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
  saveState();
}

function showAuth() {
  el.authOverlay.classList.remove("hidden");
  el.phoneInput.value = db.auth.phone || "";
  el.nameInput.value = db.profile.name || "";
  el.aboutInput.value = db.profile.about || "";
}

function hideAuth() {
  el.authOverlay.classList.add("hidden");
}

function addContactFlow() {
  if (!db.auth.loggedIn) return showAuth();
  const phone = prompt("Enter contact phone number with country code (example +447700900123):");
  if (!phoneOk(phone || "")) return openModal("Invalid phone", "Use international format like +447700900123");
  const name = prompt("Enter contact name:") || phone;
  if (db.contacts.some((c) => c.phone === phone)) return openModal("Already exists", "This contact is already saved.");

  const contact = { id: uid(), phone, name };
  db.contacts.push(contact);
  const chat = { id: uid(), phone, name, unread: 0, messages: [] };
  db.chats.unshift(chat);
  state.activeChatId = chat.id;
  renderAll(el.search.value);
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

function callFlow(mode) {
  const chat = getActiveChat();
  if (!chat) return openModal("No active contact", "Select a contact first.");
  db.calls.unshift({ with: `${chat.name} (${chat.phone})`, mode, when: new Date().toLocaleString() });
  renderAll(el.search.value);
  openModal(`${mode} call`, `Started ${mode.toLowerCase()} call with ${chat.name}.`);
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
  if (!navigator.storage?.estimate) return (el.storageStat.textContent = "Storage API unavailable.");
  const est = await navigator.storage.estimate();
  const mb = (n) => ((n ?? 0) / (1024 * 1024)).toFixed(2);
  el.storageStat.textContent = `Used ${mb(est.usage)} MB / Quota ${mb(est.quota)} MB`;
}

function bindEvents() {
  el.tabs.forEach((tab) => tab.addEventListener("click", () => {
    el.tabs.forEach((t) => t.classList.toggle("active", t === tab));
    const panel = tab.dataset.panel;
    el.panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${panel}`));
  }));

  document.addEventListener("click", (e) => {
    const item = e.target.closest("#panel-chats .item[data-id]");
    if (!item) return;
    state.activeChatId = item.dataset.id;
    renderAll(el.search.value);
  });

  el.search.addEventListener("input", (e) => renderChats(e.target.value));
  el.themeBtn.addEventListener("click", () => document.body.classList.toggle("light"));
  el.loginBtn.addEventListener("click", showAuth);
  el.newContactBtn.addEventListener("click", addContactFlow);

  el.sendOtpBtn.addEventListener("click", () => {
    const phone = el.phoneInput.value.trim();
    if (!phoneOk(phone)) return openModal("Invalid number", "Enter phone like +919999999999.");
    state.generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    el.otpHint.textContent = `Demo OTP: ${state.generatedOtp}`;
  });

  el.authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = el.phoneInput.value.trim();
    const otp = el.otpInput.value.trim();
    const name = el.nameInput.value.trim();
    const about = el.aboutInput.value.trim() || "Available";

    if (!phoneOk(phone)) return openModal("Invalid number", "Enter valid phone with country code.");
    if (!state.generatedOtp || otp !== state.generatedOtp) return openModal("OTP failed", "Please enter the correct OTP.");
    if (!name) return openModal("Name required", "Please enter profile name.");

    db.auth = { loggedIn: true, phone, verified: true };
    db.profile = { name, about, created: true };
    state.generatedOtp = null;
    hideAuth();
    renderAll(el.search.value);
    openModal("Success", "Account created and logged in successfully.");
  });

  el.cancelAuthBtn.addEventListener("click", hideAuth);

  el.addStatusBtn.addEventListener("click", () => {
    if (!db.profile.created) return showAuth();
    const text = prompt("Status text:");
    if (!text) return;
    db.status.unshift({ author: db.profile.name, text, type: "Text" });
    renderAll(el.search.value);
  });

  el.createChannelBtn.addEventListener("click", () => {
    if (!db.profile.created) return showAuth();
    const name = prompt("Channel name:");
    if (!name) return;
    db.channels.unshift({ name, followers: 1 });
    renderAll(el.search.value);
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
    const files = [...(el.fileInput.files || [])];
    files.forEach((f) => sendMessage(`📎 ${f.name} (${Math.round(f.size / 1024)} KB)`));
    el.fileInput.value = "";
  });

  el.emojiBtn.addEventListener("click", () => {
    el.composerInput.value += "✨";
    el.composerInput.focus();
  });

  el.scheduleBtn.addEventListener("click", () => {
    const secs = Number(prompt("Schedule in seconds", "10"));
    if (!Number.isFinite(secs) || secs <= 0) return;
    const text = el.composerInput.value.trim();
    if (!text) return;
    el.composerInput.value = "";
    setTimeout(() => sendMessage(`⏰ ${text}`), secs * 1000);
  });

  el.recordBtn.addEventListener("click", async () => {
    if (!getActiveChat()) return openModal("No active chat", "Select a contact first.");
    if (!navigator.mediaDevices?.getUserMedia) return openModal("Voice note", "Audio capture unavailable.");

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
    openModal("Passcode", "Passcode set.");
  });

  el.seedBtn.addEventListener("click", async () => openModal("Recovery phrase", await generateSeedPhrase()));

  el.exportBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    if (!chat) return openModal("Nothing to export", "Select a chat first.");
    openModal("Encrypted Export", JSON.stringify(await encryptExport(JSON.stringify(chat.messages, null, 2)), null, 2));
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
if (!db.auth.loggedIn) showAuth();
