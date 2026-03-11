const state = {
  activeChatId: "c1",
  disappearing: false,
  installPromptEvent: null,
  voiceRecorder: null,
  recordedChunks: []
};

const storeKey = "pulsemesh.v1";

const db = {
  profile: { name: "You", handle: "@founder", secureMode: true },
  chats: [
    {
      id: "c1",
      name: "Ava Knight",
      role: "Design Lead",
      unread: 3,
      pinned: true,
      muted: false,
      messages: [
        { from: "them", text: "I shipped the motion refresh with 120fps effects.", ts: Date.now() - 600000 },
        { from: "me", text: "Beautiful. Ship to production after QA.", ts: Date.now() - 420000 },
        { from: "them", text: "Done. Users are loving the smooth transitions ✨", ts: Date.now() - 120000 }
      ]
    },
    {
      id: "c2",
      name: "Core Engineering",
      role: "Team Space",
      unread: 8,
      pinned: true,
      muted: false,
      messages: [
        { from: "them", text: "Mesh relay fallback latency is now 38ms avg.", ts: Date.now() - 520000 },
        { from: "me", text: "Great. Keep all calls under 100ms startup.", ts: Date.now() - 310000 }
      ]
    },
    {
      id: "c3",
      name: "Growth Ops",
      role: "Marketing",
      unread: 0,
      pinned: false,
      muted: true,
      messages: [{ from: "them", text: "New invite conversion is +14%.", ts: Date.now() - 860000 }]
    }
  ],
  status: [
    ["Nina", "2 min ago • Product launch storyboard"],
    ["Rahul", "44 min ago • New voice note waveforms"],
    ["Alex", "1h ago • Dark/light design teaser"]
  ],
  calls: [
    ["Ava Knight", "Video • 18 min • End-to-end encrypted"],
    ["Core Engineering", "Voice group • 31 min • Crystal HD"],
    ["Parent Group", "Missed • 3 ring attempts"]
  ],
  communities: [
    ["PulseMesh Beta", "10,204 members • Announcements + Events"],
    ["Founders Hub", "2,011 members • Private room network"],
    ["Creators Grid", "55,300 members • Monetized channels"]
  ],
  channels: [
    ["Product Updates", "4.8M followers • Official release notes"],
    ["AI Security Feed", "184k followers • Threat intelligence"],
    ["Open Source Labs", "92k followers • Community builds"]
  ]
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
  typing: document.querySelector("#typingIndicator"),
  themeBtn: document.querySelector("#themeBtn"),
  lockBtn: document.querySelector("#lockBtn"),
  installBtn: document.querySelector("#installBtn"),
  passcodeBtn: document.querySelector("#passcodeBtn"),
  aiSummaryBtn: document.querySelector("#aiSummaryBtn"),
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

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify({ db, state: { disappearing: state.disappearing, activeChatId: state.activeChatId } }));
}

function loadState() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.db?.chats) db.chats = parsed.db.chats;
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
  return db.chats.find((c) => c.id === state.activeChatId) ?? db.chats[0];
}

function itemCard({ id, title, subtitle, unread = 0, active = false, extra = "" }) {
  return `<article class="item ${active ? "active" : ""}" data-id="${id}">
    <div class="avatar"></div>
    <div class="meta"><h4>${title}</h4><p>${subtitle}</p></div>
    ${extra}
    ${unread ? `<span class="badge">${unread}</span>` : ""}
  </article>`;
}

function renderChats(filter = "") {
  const q = filter.toLowerCase().trim();
  const sorted = [...db.chats].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const visible = sorted.filter((c) => `${c.name} ${c.role} ${c.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q));
  el.chatsPanel.innerHTML = visible
    .map((c) =>
      itemCard({
        id: c.id,
        title: `${c.pinned ? "📌 " : ""}${c.name}`,
        subtitle: `${c.role} • ${c.messages.at(-1)?.text ?? "No messages yet"}`,
        unread: c.unread,
        active: c.id === state.activeChatId,
        extra: c.muted ? `<span class="badge">Muted</span>` : ""
      })
    )
    .join("");
}

function renderList(panel, rows) {
  panel.innerHTML = rows
    .map(([title, subtitle], i) => itemCard({ id: `r${i}`, title, subtitle }))
    .join("");
}

function renderSettings() {
  const rows = [
    ["Account & Identity", "Phone alias, usernames, devices"],
    ["Privacy Controls", "Blocked users, read receipts, online visibility"],
    ["Security & Encryption", "Biometric lock, session keys, passcode vault"],
    ["Storage & Data", "Manage cached media, exports, backups"],
    ["Decentralized Mesh", "Peer identity phrase, direct tunnel mode"]
  ];
  renderList(el.settingsPanel, rows);
}

function renderMessages() {
  const chat = getActiveChat();
  state.activeChatId = chat.id;
  el.title.textContent = chat.name;
  el.subtitle.textContent = `${chat.role} • Last sync just now • ${chat.muted ? "Muted" : "Active"}`;

  el.list.innerHTML = chat.messages
    .map(
      (m, idx) => `<article class="msg ${m.from}" data-msg-index="${idx}" title="Click to react">
        <div>${m.text}</div>
        <div class="msg-time">${fmtTime(m.ts)}${m.secure ? " • secure" : ""}</div>
      </article>`
    )
    .join("");

  el.list.scrollTop = el.list.scrollHeight;
  saveState();
}

function renderAll(filter = "") {
  renderChats(filter);
  renderList(el.statusPanel, db.status);
  renderList(el.callsPanel, db.calls);
  renderList(el.communitiesPanel, db.communities);
  renderList(el.channelsPanel, db.channels);
  renderSettings();
  renderMessages();
  el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
}

function syntheticReply(chat) {
  const replies = [
    "Mesh-delivered. Zero central relay in local mode 🛰",
    "Great — your message is now synced with encrypted local backup.",
    "Received. Would you like me to generate action items?",
    "Confirmed. UX feels even smoother than before ⚡"
  ];
  const text = replies[Math.floor(Math.random() * replies.length)];
  chat.messages.push({ from: "them", text, ts: Date.now(), secure: true });
  chat.unread = 0;
  renderChats(el.search.value);
  renderMessages();
}

async function generateSeedPhrase() {
  const words = ["aurora", "zero", "mesh", "quantum", "vault", "pulse", "nebula", "cipher", "orbit", "signal", "anchor", "neon"];
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

function closeModal() {
  el.modal.close();
}

function installPWA() {
  if (!state.installPromptEvent) return;
  state.installPromptEvent.prompt();
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
    const item = e.target.closest("#panel-chats .item");
    if (item) {
      state.activeChatId = item.dataset.id;
      db.chats.forEach((c) => {
        if (c.id === state.activeChatId) c.unread = 0;
      });
      renderChats(el.search.value);
      renderMessages();
      return;
    }

    const msg = e.target.closest(".msg");
    if (msg) {
      msg.querySelector("div").textContent += " 💙";
      saveState();
    }
  });

  el.search.addEventListener("input", (e) => renderChats(e.target.value));

  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.composerInput.value.trim();
    if (!text) return;

    const chat = getActiveChat();
    chat.messages.push({ from: "me", text, ts: Date.now(), secure: true });
    if (state.disappearing) {
      setTimeout(() => {
        chat.messages = chat.messages.filter((m) => !(m.from === "me" && m.text === text));
        renderMessages();
      }, 120000);
    }

    el.composerInput.value = "";
    renderMessages();

    el.typing.classList.remove("hidden");
    setTimeout(() => {
      el.typing.classList.add("hidden");
      syntheticReply(chat);
    }, 900);
  });

  el.emojiBtn.addEventListener("click", () => {
    el.composerInput.value += "✨";
    el.composerInput.focus();
  });

  el.scheduleBtn.addEventListener("click", () => {
    const t = prompt("Schedule message in seconds (e.g., 10):", "10");
    const secs = Number(t);
    if (!Number.isFinite(secs) || secs <= 0) return;
    const msg = el.composerInput.value.trim();
    if (!msg) return;
    el.composerInput.value = "";
    setTimeout(() => {
      const chat = getActiveChat();
      chat.messages.push({ from: "me", text: `⏰ Scheduled: ${msg}`, ts: Date.now(), secure: true });
      renderMessages();
    }, secs * 1000);
  });

  el.attachBtn.addEventListener("click", () => openModal("Attachment", "Attachment picker stub: photos, docs, contacts, location, polls, and payments can be integrated here."));

  el.recordBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      openModal("Voice Note", "Media capture is not available in this browser.");
      return;
    }

    if (!state.voiceRecorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      state.recordedChunks = [];
      recorder.ondataavailable = (ev) => state.recordedChunks.push(ev.data);
      recorder.onstop = () => {
        const chat = getActiveChat();
        chat.messages.push({ from: "me", text: `🎵 Voice note (${state.recordedChunks.length} chunks)`, ts: Date.now(), secure: true });
        renderMessages();
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

  el.themeBtn.addEventListener("click", () => document.body.classList.toggle("light"));

  el.toggleDisappear.addEventListener("click", () => {
    state.disappearing = !state.disappearing;
    el.disappearingBadge.textContent = `⏱ Disappearing: ${state.disappearing ? "On (2 min)" : "Off"}`;
    saveState();
  });

  el.aiSummaryBtn.addEventListener("click", () => {
    const chat = getActiveChat();
    const recent = chat.messages.slice(-20).map((m) => `- ${m.from === "me" ? "You" : chat.name}: ${m.text}`).join("\n");
    openModal("AI Summary (On-device style)", `Conversation summary for ${chat.name}:\n\n${recent || "No messages."}\n\nSuggested next action:\n- Follow up with clear deadline.\n- Convert key points into tasks.`);
  });

  el.seedBtn.addEventListener("click", async () => {
    const seed = await generateSeedPhrase();
    openModal("Decentralized Identity Seed", `Store this recovery phrase safely:\n\n${seed}\n\nThis phrase can restore your decentralized identity on another device.`);
  });

  el.passcodeBtn.addEventListener("click", () => {
    const pass = prompt("Set local vault passcode:");
    if (!pass) return;
    localStorage.setItem("pulsemesh.passcode", btoa(pass));
    openModal("Passcode Set", "Passcode stored locally for demo. Use platform secure storage in production.");
  });

  el.lockBtn.addEventListener("click", () => {
    const expected = localStorage.getItem("pulsemesh.passcode");
    if (!expected) return openModal("Vault", "No passcode set yet. Use 'Set Passcode'.");
    const entered = prompt("Enter passcode to unlock vault:");
    if (btoa(entered || "") === expected) {
      openModal("Vault", "Vault unlocked successfully ✅");
    } else {
      openModal("Vault", "Incorrect passcode ❌");
    }
  });

  el.exportBtn.addEventListener("click", async () => {
    const chat = getActiveChat();
    const plain = JSON.stringify(chat.messages, null, 2);
    const secured = await encryptExport(plain);
    openModal("Encrypted Export", JSON.stringify(secured, null, 2));
  });

  el.clearBtn.addEventListener("click", () => {
    if (!confirm("Delete all local app data?")) return;
    localStorage.clear();
    location.reload();
  });

  el.installBtn.addEventListener("click", installPWA);
  el.modalClose.addEventListener("click", closeModal);
}

function setupPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }

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
renderAll();
bindEvents();
setupPWA();
updateStorageStats();
