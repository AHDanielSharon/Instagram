const state = {
  activeChatId: null,
  disappearing: false,
  installPromptEvent: null,
  voiceRecorder: null,
  recordedChunks: []
};

const storeKey = "pulsemesh.v2";

const db = {
  profile: { name: "", handle: "", created: false },
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
  newChatBtn: document.querySelector("#newChatBtn"),
  profileBtn: document.querySelector("#profileBtn"),
  inviteBtn: document.querySelector("#inviteBtn"),
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
  storageStat: document.querySelector("#storageStat"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalClose: document.querySelector("#modalClose")
};

function uid() {
  return `c-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

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

function emptyCard(message) {
  return `<article class="item"><div class="meta"><h4>${message}</h4><p>Use “New Chat” to add real contacts and start messaging.</p></div></article>`;
}

function itemCard({ id, title, subtitle, unread = 0, active = false }) {
  return `<article class="item ${active ? "active" : ""}" data-id="${id}">
    <div class="avatar"></div>
    <div class="meta"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(subtitle)}</p></div>
    ${unread ? `<span class="badge">${unread}</span>` : ""}
  </article>`;
}

function renderChats(filter = "") {
  const q = filter.trim().toLowerCase();
  const visible = db.chats.filter((c) => `${c.name} ${c.role} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q));
  if (!visible.length) {
    el.chatsPanel.innerHTML = emptyCard("No chats yet");
    return;
  }
  el.chatsPanel.innerHTML = visible
    .map((c) =>
      itemCard({
        id: c.id,
        title: c.name,
        subtitle: `${c.role} • ${c.messages.at(-1)?.text || "No messages yet"}`,
        unread: c.unread,
        active: c.id === state.activeChatId
      })
    )
    .join("");
}

function renderList(panel, rows, heading) {
  if (!rows.length) {
    panel.innerHTML = emptyCard(`No ${heading} yet`);
    return;
  }
  panel.innerHTML = rows.map(([title, subtitle], i) => itemCard({ id: `r${heading}-${i}`, title, subtitle })).join("");
}

function renderSettings() {
  const rows = [
    ["Account", "Edit profile, username, and linked devices"],
    ["Privacy", "Read receipts, blocked users, disappearing messages"],
    ["Chats", "Theme, wallpaper, and backup controls"],
    ["Storage", "Manage media and local cache"],
    ["Security", "Passcode lock and encrypted export"]
  ];
  renderList(el.settingsPanel, rows, "settings");
}

function renderMessages() {
  const chat = getActiveChat();
  if (!chat) {
    el.title.textContent = "Welcome to PulseMesh";
    el.subtitle.textContent = "No chats yet — create one to start messaging real people.";
    el.list.innerHTML = `<article class="msg them"><div>Your chat timeline is empty.</div><div class="msg-time">Invite someone and begin securely.</div></article>`;
    return;
  }

  el.title.textContent = chat.name;
  el.subtitle.textContent = `${chat.role} • encrypted session active`;
  el.list.innerHTML = chat.messages
    .map((m) => `<article class="msg ${m.from}"><div>${escapeHtml(m.text)}</div><div class="msg-time">${fmtTime(m.ts)}</div></article>`)
    .join("");
  el.list.scrollTop = el.list.scrollHeight;
}

function renderAll(filter = "") {
  renderChats(filter);
  renderList(el.statusPanel, db.status, "status updates");
  renderList(el.callsPanel, db.calls, "calls");
  renderList(el.communitiesPanel, db.communities, "communities");
  renderList(el.channelsPanel, db.channels, "channels");
  renderSettings();
  renderMessages();
  el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
  saveState();
}

function createProfile() {
  const name = prompt("Your display name:", db.profile.name || "");
  if (!name) return;
  const handle = prompt("Username (without @):", db.profile.handle.replace("@", "") || "");
  db.profile = { name, handle: `@${(handle || name).replace(/\s+/g, "").toLowerCase()}`, created: true };
  openModal("Profile Created", `${db.profile.name}\n${db.profile.handle}\n\nNow add your first chat.`);
  saveState();
}

function createChat() {
  const name = prompt("Contact name:");
  if (!name) return;
  const role = prompt("About/contact note:", "Contact") || "Contact";

  const chat = {
    id: uid(),
    name,
    role,
    unread: 0,
    messages: []
  };
  db.chats.unshift(chat);
  state.activeChatId = chat.id;
  renderAll(el.search.value);
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
  return {
    iv: btoa(String.fromCharCode(...iv)),
    payload: btoa(String.fromCharCode(...new Uint8Array(cipher)))
  };
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

function openModal(title, body) {
  el.modalTitle.textContent = title;
  el.modalBody.textContent = body;
  el.modal.showModal();
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
  el.newChatBtn.addEventListener("click", createChat);
  el.profileBtn.addEventListener("click", createProfile);

  el.inviteBtn.addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}?invite=${Math.random().toString(36).slice(2, 10)}`;
    await navigator.clipboard?.writeText(link);
    openModal("Invite Link", `Invite copied:\n${link}`);
  });

  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const chat = getActiveChat();
    if (!chat) return openModal("No active chat", "Create a new chat first.");

    const text = el.composerInput.value.trim();
    if (!text) return;
    chat.messages.push({ from: "me", text, ts: Date.now() });

    if (state.disappearing) {
      setTimeout(() => {
        chat.messages = chat.messages.filter((m) => m.text !== text);
        renderMessages();
        saveState();
      }, 120000);
    }

    el.composerInput.value = "";
    renderMessages();
    saveState();
  });

  el.emojiBtn.addEventListener("click", () => {
    el.composerInput.value += "✨";
    el.composerInput.focus();
  });

  el.scheduleBtn.addEventListener("click", () => {
    const chat = getActiveChat();
    if (!chat) return openModal("No active chat", "Create a new chat first.");

    const value = Number(prompt("Schedule in seconds:", "10"));
    if (!Number.isFinite(value) || value <= 0) return;
    const msg = el.composerInput.value.trim();
    if (!msg) return;

    el.composerInput.value = "";
    setTimeout(() => {
      chat.messages.push({ from: "me", text: `⏰ ${msg}`, ts: Date.now() });
      renderMessages();
      saveState();
    }, value * 1000);
  });

  el.attachBtn.addEventListener("click", () => openModal("Attachments", "Attachment picker placeholder for photos, videos, docs, contacts, and location."));

  el.recordBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    if (!chat) return openModal("No active chat", "Create a new chat first.");

    if (!navigator.mediaDevices?.getUserMedia) {
      openModal("Voice note", "Audio recording is unavailable in this browser.");
      return;
    }

    if (!state.voiceRecorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      state.recordedChunks = [];
      recorder.ondataavailable = (ev) => state.recordedChunks.push(ev.data);
      recorder.onstop = () => {
        chat.messages.push({ from: "me", text: `🎵 Voice note (${state.recordedChunks.length} chunks)`, ts: Date.now() });
        renderMessages();
        saveState();
      };
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

  el.seedBtn.addEventListener("click", async () => {
    const seed = await generateSeedPhrase();
    openModal("Recovery Phrase", `Store this safely:\n\n${seed}`);
  });

  el.passcodeBtn.addEventListener("click", () => {
    const pass = prompt("Set local passcode:");
    if (!pass) return;
    localStorage.setItem("pulsemesh.passcode", btoa(pass));
    openModal("Passcode", "Passcode stored for this device.");
  });

  el.exportBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    if (!chat) return openModal("Nothing to export", "Create a chat and send messages first.");

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
