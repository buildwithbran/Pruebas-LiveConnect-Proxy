const APP_CONFIG = Object.freeze({
  defaultTransferChannelId: 3918,
  currencyLocale: "es-CO"
});

const CHANNEL_TYPES = Object.freeze({
  1: "WhatsApp QR",
  2: "Sitio Web",
  3: "Facebook",
  4: "Instagram",
  5: "Telegram",
  6: "Email",
  7: "WhatsApp Business API",
  8: "LinkedIn",
  9: "Google My Business"
});

const ALLOWED_FILE_EXTENSIONS = Object.freeze([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt"
]);

const THEME_STORAGE_KEY = "lc_proxy_theme";
const THEMES = Object.freeze(["dark"]);

const UI_TEXT = Object.freeze({
  invalidConversation: "Selecciona una conversacion primero.",
  invalidBalance: "No fue posible interpretar el saldo. Revisa el panel de configuracion.",
  transferSuccess: "Conversacion transferida a LiveConnect.",
  transferError: "No se pudo transferir la conversacion.",
  noConversationTitle: "Selecciona una conversación",
  noConversationMeta: "Las conversaciones entrantes y salientes aparecerán aquí en tiempo real.",
  noConversationHint: "Selecciona una conversación para habilitar la respuesta.",
  emptyConversationTitle: "Aún no hay mensajes en este hilo",
  emptyConversationBody: "Cuando el proveedor entregue mensajes, aparecerán aquí con su contexto, archivos y metadata relevante.",
  emptyInboxTitle: "Tu bandeja está lista",
  emptyInboxBody: "En cuanto lleguen conversaciones desde el webhook o desde pruebas manuales, las verás en esta lista."
});

const SHOW_ARCHIVED = false;

const state = {
  currentConversation: null,
  currentConversationData: null,
  conversations: [],
  conversationMap: new Map(),
  conversationNodes: new Map(),
  messageCache: new Map(),
  messagePages: new Map(),
  messageListLoading: false,
  messageScrollAtBottom: true,
  theme: "dark",
  eventSource: null,
  eventStreamConnected: false,
  conversationActionsOpen: false,
  conversationActionsHideTimer: null,
  mobileNavOpen: false,
  scheduledConversationRefresh: null,
  scheduledMessageRefresh: null,
  relativeTimeUpdater: null
};

const dom = {
  appFrame: document.getElementById("app"),
  sidebarShell: document.getElementById("sidebarShell"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  mobileNavToggle: document.getElementById("mobileNavToggle"),
  mobileNavBackdrop: document.getElementById("mobileNavBackdrop"),
  conversationsPane: document.getElementById("conversationsPane"),
  conversationList: document.getElementById("conversationList"),
  messages: document.getElementById("messages"),
  messageInput: document.getElementById("messageInput"),
  conversationTitle: document.getElementById("conversationTitle"),
  conversationMeta: document.getElementById("conversationMeta"),
  conversationCount: document.getElementById("conversationCount"),
  composerHint: document.getElementById("composerHint"),
  settingsPanel: document.getElementById("settingsPanel"),
  channelSelect: document.getElementById("channelSelect"),
  canalId: document.getElementById("canalId"),
  webhookUrl: document.getElementById("webhookUrl"),
  secret: document.getElementById("secret"),
  webhookCheckSummary: document.getElementById("webhookCheckSummary"),
  webhookResult: document.getElementById("webhookResult"),
  configStatus: document.getElementById("configStatus"),
  balanceDisplay: document.getElementById("balanceDisplay"),
  fileComposer: document.getElementById("fileComposer"),
  imageModal: document.getElementById("imageModal"),
  imageModalImage: document.getElementById("imageModalImage"),
  imageModalOpenLink: document.getElementById("imageModalOpenLink"),
  imageModalCloseBtn: document.getElementById("imageModalCloseBtn"),
  quickAnswerModal: document.getElementById("quickAnswerModal"),
  quickAnswerCloseBtn: document.getElementById("quickAnswerCloseBtn"),
  chatFileUrl: document.getElementById("chatFileUrl"),
  chatFileName: document.getElementById("chatFileName"),
  chatFileExtension: document.getElementById("chatFileExtension"),
  fileUrl: document.getElementById("fileUrl"),
  fileName: document.getElementById("fileName"),
  fileExtension: document.getElementById("fileExtension"),
  quickAnswerId: document.getElementById("quickAnswerId"),
  quickAnswerVariables: document.getElementById("quickAnswerVariables"),
  quickAnswerStatus: document.getElementById("quickAnswerStatus"),
  transferModal: document.getElementById("transferModal"),
  transferCloseBtn: document.getElementById("transferCloseBtn"),
  transferGroup: document.getElementById("transferGroup"),
  transferUser: document.getElementById("transferUser"),
  transferMessage: document.getElementById("transferMessage"),
  transferStatus: document.getElementById("transferStatus"),
  toastViewport: document.getElementById("toastViewport"),
  themeSelect: document.getElementById("themeSelect"),
  themeSwatches: document.getElementById("themeSwatches"),
  sseStatus: document.getElementById("sseStatus"),
  refreshNowBtn: document.getElementById("refreshNowBtn"),
  conversationActionsToggle: document.getElementById("conversationActionsToggle"),
  conversationActionsDropdown: document.getElementById("conversationActionsDropdown")
};

function renderConfigStatus(text, isError = false) {
  if (!dom.configStatus) return;
  dom.configStatus.innerText = text;
  dom.configStatus.className = `status-note ${isError ? "is-error" : "is-ok"}`;
}

function renderQuickAnswerStatus(text, isError = false, isNeutral = false) {
  if (!dom.quickAnswerStatus) return;
  dom.quickAnswerStatus.innerText = text;
  dom.quickAnswerStatus.className = isNeutral
    ? "status-note is-neutral"
    : `status-note ${isError ? "is-error" : "is-ok"}`;
}

function writeWebhookResult(data) {
  if (!dom.webhookResult) return;
  dom.webhookResult.innerText = JSON.stringify(data, null, 2);
}

function showToast(title, message, tone = "info") {
  if (!dom.toastViewport) return;

  const toast = document.createElement("article");
  toast.className = `toast toast--${tone}`;

  const titleNode = document.createElement("p");
  titleNode.className = "toast__title";
  titleNode.innerText = title;

  const bodyNode = document.createElement("p");
  bodyNode.className = "toast__body";
  bodyNode.innerText = message;

  toast.appendChild(titleNode);
  toast.appendChild(bodyNode);
  dom.toastViewport.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3800);
}

function isValidTheme(theme) {
  return THEMES.includes(theme);
}

function readStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(storedTheme) ? storedTheme : null;
  } catch (_error) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_error) {
    // Ignore storage errors on restricted environments.
  }
}

function getInitialTheme() {
  return "dark";
}

function isMobileViewport() {
  try {
    return window.matchMedia("(max-width: 760px)").matches;
  } catch (_error) {
    return window.innerWidth <= 760;
  }
}

function setConversationActionsOpen(isOpen) {
  if (state.conversationActionsHideTimer) {
    window.clearTimeout(state.conversationActionsHideTimer);
    state.conversationActionsHideTimer = null;
  }

  state.conversationActionsOpen = Boolean(isOpen);
  if (dom.conversationActionsMenu) {
    dom.conversationActionsMenu.classList.toggle("is-open", state.conversationActionsOpen);
  }
  if (dom.conversationActionsDropdown) {
    if (state.conversationActionsOpen) {
      dom.conversationActionsDropdown.removeAttribute("hidden");
    } else {
      state.conversationActionsHideTimer = window.setTimeout(() => {
        dom.conversationActionsDropdown?.setAttribute("hidden", "hidden");
        state.conversationActionsHideTimer = null;
      }, 160);
    }
  }
  if (dom.conversationActionsToggle) {
    dom.conversationActionsToggle.setAttribute("aria-expanded", state.conversationActionsOpen ? "true" : "false");
  }
}

function openConversationActionsDropdown() {
  setConversationActionsOpen(true);
}

function closeConversationActionsDropdown() {
  setConversationActionsOpen(false);
}

function toggleConversationActionsDropdown() {
  setConversationActionsOpen(!state.conversationActionsOpen);
}

function setMobileNavOpen(isOpen) {
  state.mobileNavOpen = Boolean(isOpen);
  dom.appFrame?.classList.toggle("is-mobile-nav-open", state.mobileNavOpen);
  if (dom.mobileNavBackdrop) {
    if (state.mobileNavOpen) {
      dom.mobileNavBackdrop.removeAttribute("hidden");
    } else {
      dom.mobileNavBackdrop.setAttribute("hidden", "hidden");
    }
  }
  if (dom.mobileNavToggle) {
    dom.mobileNavToggle.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
  }
}

function openMobileNav() {
  setMobileNavOpen(true);
}

function closeMobileNav() {
  setMobileNavOpen(false);
}

function getSLAStatus(minutes) {
  if (minutes < 2) return "green";
  if (minutes < 5) return "yellow";
  return "red";
}

function getConversationAgeMinutes(conversation) {
  const timestamp = conversation.last_message_at || conversation.updated_at;
  const ms = timestamp ? Date.parse(timestamp) : Date.now();
  const diff = Math.max(0, Date.now() - ms);
  return Math.floor(diff / 60000);
}

function normalizeConversation(raw) {
  if (!raw || !raw.id) return null;

  const lastMessageAt = raw.last_message_at || raw.updated_at || null;
  const lastMessageFrom = String(raw.last_message_from || "client").toLowerCase();
  const unreadCount = Number.isFinite(Number(raw.unread_count)) ? Number(raw.unread_count) : 0;
  const archived = Boolean(raw.archived);
  const lastAgentResponseAt = raw.last_agent_response_at || null;

  const priorityScore = Number.isFinite(Number(raw.priority_score))
    ? Number(raw.priority_score)
    : getConversationAgeMinutes({ last_message_at: lastMessageAt }) * 2 + (lastMessageFrom === "client" ? 50 : 0);

  return {
    id: String(raw.id),
    canal: String(raw.canal || "").trim(),
    contact_name: String(raw.contact_name || ""),
    celular: String(raw.celular || ""),
    archived,
    last_message_at: lastMessageAt,
    last_message_from: lastMessageFrom === "agent" ? "agent" : lastMessageFrom === "system" ? "system" : "client",
    unread_count: unreadCount,
    last_agent_response_at: lastAgentResponseAt,
    updated_at: raw.updated_at || lastMessageAt,
    priority_score: priorityScore,
  };
}

function compareConversations(a, b) {
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  const aTime = Date.parse(a.last_message_at || a.updated_at || "") || 0;
  const bTime = Date.parse(b.last_message_at || b.updated_at || "") || 0;
  return bTime - aTime;
}

function formatWaitTimeLabel(minutes) {
  const rounded = Math.max(0, Math.floor(minutes));
  if (rounded < 60) {
    return `${rounded} min`;
  }
  if (rounded < 1440) {
    const hours = Math.floor(rounded / 60);
    return `${hours} h`;
  }
  if (rounded < 10080) {
    const days = Math.floor(rounded / 1440);
    return `${days} d`;
  }
  const weeks = Math.floor(rounded / 10080);
  if (weeks < 8) {
    return `${weeks} sem`;
  }
  const months = Math.max(1, Math.round(weeks / 4));
  return `${months} ${months === 1 ? "mes" : "meses"}`;
}

function updateConversationAges() {
  if (!state.conversations.length) return;

  state.conversations.forEach((conversation) => {
    const node = state.conversationNodes.get(conversation.id);
    if (!node) return;

    const badge = node.querySelector(".conversation__badge");
    if (!badge) return;

    const waitLabel = formatWaitTimeLabel(getConversationAgeMinutes(conversation));
    badge.innerText = `${normalizeText(conversation.canal || "Canal desconocido")} · Esperando ${waitLabel}`;
  });
}

function startRelativeTimeUpdater() {
  if (state.relativeTimeUpdater) return;
  state.relativeTimeUpdater = window.setInterval(updateConversationAges, 45000);
}

function stopRelativeTimeUpdater() {
  if (!state.relativeTimeUpdater) return;
  window.clearInterval(state.relativeTimeUpdater);
  state.relativeTimeUpdater = null;
}

function syncThemeControls(theme) {
  if (dom.themeSelect) {
    dom.themeSelect.value = theme;
  }

  document.querySelectorAll("[data-theme-value]").forEach((button) => {
    const isActive = button.dataset.themeValue === theme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function applyTheme(theme, persist = true) {
  const nextTheme = isValidTheme(theme) ? theme : "light";
  state.theme = nextTheme;
  document.body.dataset.theme = nextTheme;
  syncThemeControls(nextTheme);

  if (persist) {
    storeTheme(nextTheme);
  }
}

function onThemeSelectChange(event) {
  applyTheme(event.target.value, true);
}

function onThemeSwatchClick(event) {
  const button = event.target.closest('[data-theme-value]');
  if (!button) return;
  applyTheme(button.dataset.themeValue, true);
}

function scheduleConversationRefresh(delayMs = 120) {
  if (state.scheduledConversationRefresh) {
    window.clearTimeout(state.scheduledConversationRefresh);
  }

  state.scheduledConversationRefresh = window.setTimeout(() => {
    state.scheduledConversationRefresh = null;
    loadConversations();
  }, delayMs);
}

function scheduleMessageRefresh(conversationId, delayMs = 120) {
  if (!conversationId) return;

  if (state.scheduledMessageRefresh) {
    window.clearTimeout(state.scheduledMessageRefresh);
  }

  state.scheduledMessageRefresh = window.setTimeout(() => {
    state.scheduledMessageRefresh = null;
    if (state.currentConversation === conversationId) {
      loadMessages(conversationId);
    }
  }, delayMs);
}

function isApiSuccess(res, data) {
  return Boolean(res?.ok) && data?.ok !== false;
}

async function requestJSON(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (_error) {
    data = null;
  }
  return { res, data };
}

function postJSON(url, payload) {
  return requestJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function toNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findAmountDeep(node, depth = 0) {
  if (depth > 8 || node === null || node === undefined) return null;

  const direct = toNumeric(node);
  if (direct !== null) return direct;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findAmountDeep(item, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const preferredKeys = ["balance", "saldo", "available_balance", "amount"];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const found = findAmountDeep(node[key], depth + 1);
      if (found !== null) return found;
    }
  }

  for (const value of Object.values(node)) {
    const found = findAmountDeep(value, depth + 1);
    if (found !== null) return found;
  }

  return null;
}

function getBalanceValue(payload) {
  return findAmountDeep(payload);
}

function findFieldDeep(node, candidateKeys, depth = 0) {
  if (depth > 8 || node === null || node === undefined) return undefined;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFieldDeep(item, candidateKeys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (typeof node !== "object") return undefined;

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      return node[key];
    }
  }

  for (const value of Object.values(node)) {
    const found = findFieldDeep(value, candidateKeys, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function resolveWebhookState(rawState, rawMessage, url) {
  if (typeof rawState === "boolean") {
    return rawState ? "activo" : "inactivo";
  }
  if (typeof rawState === "number") {
    return rawState === 1 ? "activo" : "inactivo";
  }

  const stateText = normalizeText(rawState).toLowerCase();
  if (stateText) {
    if (stateText.includes("eliminad")) return "eliminado";
    if (["1", "true", "on", "activo", "active", "enabled", "habilitado"].includes(stateText)) {
      return "activo";
    }
    if (["0", "false", "off", "inactivo", "inactive", "disabled", "deshabilitado"].includes(stateText)) {
      return "inactivo";
    }
  }

  const messageText = normalizeText(rawMessage).toLowerCase();
  if (messageText.includes("eliminad")) return "eliminado";
  if (!normalizeText(url) && messageText.includes("sin webhook")) return "inactivo";

  return "desconocido";
}

function extractWebhookSummary(payload) {
  const rawState = findFieldDeep(payload, [
    "estado",
    "status",
    "active",
    "activo",
    "enabled",
    "is_active",
    "webhook_status"
  ]);
  const rawUrl = findFieldDeep(payload, [
    "url",
    "webhook_url",
    "webhookUrl",
    "callback_url",
    "uri"
  ]);
  const rawMessage = findFieldDeep(payload, [
    "mensaje",
    "message",
    "detalle",
    "detail",
    "descripcion",
    "description",
    "error"
  ]);

  const url = normalizeText(rawUrl);
  const message = normalizeText(rawMessage);
  const estado = resolveWebhookState(rawState, rawMessage, rawUrl);

  return {
    estado,
    url: url || "(sin URL configurada)",
    mensaje: message || "(sin mensaje de API)"
  };
}

function renderWebhookCheckSummary(summary) {
  if (!dom.webhookCheckSummary || !summary) return;
  dom.webhookCheckSummary.innerText = [
    `Estado actual: ${summary.estado}`,
    `URL configurada: ${summary.url}`,
    `Mensaje API: ${summary.mensaje}`
  ].join("\n");
}

function getChannelTypeLabel(tipo) {
  return CHANNEL_TYPES[tipo] || `Tipo ${tipo}`;
}

function getSelectedChannelId() {
  const selectValue = dom.channelSelect?.value?.trim();
  const manualValue = dom.canalId?.value?.trim();
  const rawValue = selectValue || manualValue;

  if (!rawValue) return null;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureCurrentConversation() {
  if (!state.currentConversation) {
    showToast("Conversación requerida", UI_TEXT.invalidConversation, "info");
    return null;
  }

  return state.currentConversation;
}

async function archiveCurrentConversation() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;
  await toggleArchiveConversation(conversationId);
}

async function markCurrentConversationRead() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;
  await markConversationRead(conversationId);
}

function openConversationActionsMenu() {
  openConversationActionsDropdown();
}

function formatDateLabel(value) {
  if (!value) return "Sin actividad reciente";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Sin actividad reciente";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsedDate);
}

function getConversationLabel(conversation) {
  const contactName = normalizeText(conversation?.contact_name);
  if (contactName) return contactName;

  const conversationId = normalizeText(conversation?.id);
  return conversationId || "Conversación sin ID";
}

function getConversationMetaLine(conversation) {
  const conversationId = normalizeText(conversation?.id);
  const channel = normalizeText(conversation?.canal || "unknown");
  const source = conversation?.last_message_from === "client" ? "Cliente" : conversation?.last_message_from === "agent" ? "Agente" : "Sistema";
  const unread = Number.isFinite(Number(conversation?.unread_count)) ? Number(conversation.unread_count) : 0;
  const pieces = [];

  if (conversationId) pieces.push(conversationId);
  if (channel) pieces.push(`Canal ${channel}`);
  if (source) pieces.push(`Último desde ${source}`);
  if (unread > 0) pieces.push(`${unread} sin leer`);

  return pieces.join(" · ");
}

function setConversationContext(conversation) {
  state.currentConversationData = conversation || null;

  if (!conversation) {
    if (dom.conversationTitle) dom.conversationTitle.innerText = UI_TEXT.noConversationTitle;
    if (dom.conversationMeta) dom.conversationMeta.innerText = UI_TEXT.noConversationMeta;
    if (dom.composerHint) dom.composerHint.innerText = UI_TEXT.noConversationHint;
    syncConversationControls();
    return;
  }

  if (dom.conversationTitle) {
    dom.conversationTitle.innerText = getConversationLabel(conversation);
  }

  if (dom.conversationMeta) {
    const metaParts = [
      getConversationMetaLine(conversation),
      `Actualizado ${formatDateLabel(conversation.updated_at)}`
    ].filter(Boolean);
    dom.conversationMeta.innerText = metaParts.join(" · ");
  }

  if (dom.composerHint) {
    dom.composerHint.innerText = `Responderás en ${getConversationLabel(conversation)}. También puedes adjuntar archivos o disparar quick answers.`;
  }

  syncConversationControls();
}

function updateConversationCount(count) {
  if (!dom.conversationCount) return;
  const total = Number.isFinite(count) ? count : 0;
  dom.conversationCount.innerText = `${total} ${total === 1 ? "conversación" : "conversaciones"}`;
}

function syncConversationControls() {
  const hasConversation = Boolean(state.currentConversation);
  document
    .querySelectorAll("[data-requires-conversation='true']")
    .forEach((element) => {
      element.disabled = !hasConversation;
    });

  if (dom.messageInput) {
    dom.messageInput.disabled = !hasConversation;
  }

  if (dom.chatFileUrl) dom.chatFileUrl.disabled = !hasConversation;
  if (dom.chatFileName) dom.chatFileName.disabled = !hasConversation;
  if (dom.chatFileExtension) dom.chatFileExtension.disabled = !hasConversation;
}

function renderEmptyMessagesState(title, body) {
  if (!dom.messages) return;

  const emptyState = document.createElement("article");
  emptyState.className = "message-empty";

  const heading = document.createElement("h3");
  heading.innerText = title;

  const description = document.createElement("p");
  description.innerText = body;

  emptyState.appendChild(heading);
  emptyState.appendChild(description);
  dom.messages.innerHTML = "";
  dom.messages.appendChild(emptyState);
}

function renderSidebarEmptyState(title, body) {
  if (!dom.conversationList) return;

  const emptyState = document.createElement("article");
  emptyState.className = "message-empty";

  const heading = document.createElement("h3");
  heading.innerText = title;

  const description = document.createElement("p");
  description.innerText = body;

  emptyState.appendChild(heading);
  emptyState.appendChild(description);
  dom.conversationList.innerHTML = "";
  dom.conversationList.appendChild(emptyState);
}

function renderConversationSkeleton() {
  if (!dom.conversationList) return;
  dom.conversationList.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 4; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "conversation conversation--skeleton";
    skeleton.innerHTML = `
      <div class="conversation__row">
        <span class="conversation__skeleton-line conversation__skeleton-line--title"></span>
        <span class="conversation__skeleton-line conversation__skeleton-line--time"></span>
      </div>
      <span class="conversation__skeleton-line conversation__skeleton-line--meta"></span>
      <span class="conversation__skeleton-line conversation__skeleton-line--badge"></span>
    `;
    fragment.appendChild(skeleton);
  }

  dom.conversationList.appendChild(fragment);
}

function createConversationItem(conversation) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "conversation";
  if (conversation.id === state.currentConversation) {
    item.classList.add("active");
  }
  item.dataset.conversationId = conversation.id;
  item.dataset.conversationArchived = conversation.archived ? "1" : "0";

  const header = document.createElement("div");
  header.className = "conversation__row";

  const title = document.createElement("p");
  title.className = "conversation__title";
  title.innerText = getConversationLabel(conversation);

  const time = document.createElement("span");
  time.className = "conversation__time";
  time.innerText = formatDateLabel(conversation.last_message_at || conversation.updated_at);

  header.appendChild(title);
  header.appendChild(time);

  const meta = document.createElement("p");
  meta.className = "conversation__meta";
  meta.innerText = getConversationMetaLine(conversation);

  const slaMinutes = getConversationAgeMinutes(conversation);
  const slaStatus = getSLAStatus(slaMinutes);
  const badge = document.createElement("span");
  badge.className = `conversation__badge conversation__badge--${slaStatus}`;
  badge.innerText = `${normalizeText(conversation.canal || "Canal desconocido")} · Esperando ${formatWaitTimeLabel(slaMinutes)}`;

  const actions = document.createElement("div");
  actions.className = "conversation__actions";
  actions.innerHTML = `
    <button type="button" class="conversation__action conversation__action--menu" data-conversation-action="actions" aria-label="Abrir menú de conversación">⋯</button>
  `;

  item.appendChild(header);
  item.appendChild(meta);
  item.appendChild(badge);
  item.appendChild(actions);

  return item;
}

function updateConversationItem(conversation) {
  const normalized = normalizeConversation(conversation);
  if (!normalized || normalized.archived) {
    removeConversationItem(normalized?.id);
    return;
  }

  const existingIndex = state.conversations.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    state.conversations[existingIndex] = normalized;
  } else {
    state.conversations.push(normalized);
  }

  state.conversations.sort(compareConversations);
  state.conversationMap.set(normalized.id, normalized);
  updateConversationCount(state.conversations.length);

  const existingNode = state.conversationNodes.get(normalized.id);
  if (existingNode) {
    const title = existingNode.querySelector(".conversation__title");
    const time = existingNode.querySelector(".conversation__time");
    const meta = existingNode.querySelector(".conversation__meta");
    const badge = existingNode.querySelector(".conversation__badge");

    if (title) title.innerText = getConversationLabel(normalized);
    if (time) time.innerText = formatDateLabel(normalized.last_message_at || normalized.updated_at);
    if (meta) meta.innerText = getConversationMetaLine(normalized);
    if (badge) badge.innerText = `${normalizeText(normalized.canal || "Canal desconocido")} · Esperando ${formatWaitTimeLabel(getConversationAgeMinutes(normalized))}`;

    const desiredIndex = state.conversations.findIndex((item) => item.id === normalized.id);
    const currentIndex = Array.from(dom.conversationList.children).indexOf(existingNode);
    if (desiredIndex !== currentIndex) {
      const referenceNode = dom.conversationList.children[desiredIndex] || null;
      dom.conversationList.insertBefore(existingNode, referenceNode);
    }
    return;
  }

  const item = createConversationItem(normalized);
  state.conversationNodes.set(normalized.id, item);

  const insertBeforeNode = dom.conversationList.children[state.conversations.findIndex((item) => item.id === normalized.id)] || null;
  dom.conversationList.insertBefore(item, insertBeforeNode);
}

function removeConversationItem(conversationId) {
  if (!conversationId) return;
  state.conversations = state.conversations.filter((item) => item.id !== conversationId);
  state.conversationMap.delete(conversationId);
  const node = state.conversationNodes.get(conversationId);
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
  state.conversationNodes.delete(conversationId);

  if (state.currentConversation === conversationId) {
    state.currentConversation = null;
    setConversationContext(null);
    renderEmptyMessagesState(UI_TEXT.noConversationTitle, UI_TEXT.noConversationMeta);
  }

  updateConversationCount(state.conversations.length);
}

function renderConversationList(conversations) {
  if (!dom.conversationList) return;
  if (!Array.isArray(conversations) || conversations.length === 0) {
    state.conversations = [];
    state.conversationMap.clear();
    state.conversationNodes.clear();
    renderSidebarEmptyState(UI_TEXT.emptyInboxTitle, UI_TEXT.emptyInboxBody);
    updateConversationCount(0);
    return;
  }

  const normalizedConversations = conversations
    .map(normalizeConversation)
    .filter((conversation) => conversation && (!conversation.archived || SHOW_ARCHIVED));

  normalizedConversations.sort(compareConversations);
  state.conversations = normalizedConversations;
  state.conversationMap.clear();
  state.conversationNodes.clear();

  dom.conversationList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  normalizedConversations.forEach((conversation) => {
    const item = createConversationItem(conversation);
    state.conversationMap.set(conversation.id, conversation);
    state.conversationNodes.set(conversation.id, item);
    fragment.appendChild(item);
  });

  dom.conversationList.appendChild(fragment);
  updateConversationCount(normalizedConversations.length);
}

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function parseFileMessage(rawMessage) {
  const normalized = normalizeText(rawMessage);
  if (!normalized.startsWith("[FILE]|")) return null;

  const parts = normalized.split("|");
  const url = normalizeText(parts[1]);
  if (!url) return null;

  const name = normalizeText(parts[2] || "");
  const extension = normalizeFileExtension(parts[3] || "");

  return { url, name, extension };
}

function normalizeMetadata(value) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_error) {
      return { raw: trimmed };
    }
    return { raw: trimmed };
  }
  return null;
}

function extractUrls(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const matches = normalized.match(/https?:\/\/[^\s]+/gi) || [];
  const unique = [];
  matches.forEach((url) => {
    const clean = String(url).trim().replace(/[),.;!?]+$/g, "");
    if (clean && !unique.includes(clean)) unique.push(clean);
  });
  return unique;
}

function getUrlExtension(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/");
    const lastPart = segments[segments.length - 1] || "";
    const dotIndex = lastPart.lastIndexOf(".");
    if (dotIndex === -1) return "";
    return normalizeFileExtension(lastPart.slice(dotIndex + 1));
  } catch (_error) {
    return "";
  }
}

function inferFileUrlFromUrls(urls) {
  for (const url of urls) {
    const extension = getUrlExtension(url);
    if (extension && ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      return url;
    }
  }
  return "";
}

function removeUrlFromText(text, url) {
  const normalizedText = normalizeText(text);
  const normalizedUrl = normalizeText(url);
  if (!normalizedText || !normalizedUrl) return normalizedText;
  const escaped = normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizedText
    .replace(new RegExp(escaped, "g"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isImageExtension(extension) {
  return ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(extension);
}

function openImageModal(url) {
  if (!dom.imageModal || !dom.imageModalImage || !dom.imageModalOpenLink) return;
  if (!url) return;

  dom.imageModalImage.src = url;
  dom.imageModalOpenLink.href = url;
  dom.imageModal.removeAttribute("hidden");
  dom.imageModal.style.display = "flex";
}

function closeImageModal() {
  if (!dom.imageModal || !dom.imageModalImage || !dom.imageModalOpenLink) return;
  dom.imageModal.setAttribute("hidden", "hidden");
  dom.imageModal.style.display = "none";
  dom.imageModalImage.src = "";
  dom.imageModalOpenLink.href = "#";
}

function openQuickAnswerModal() {
  if (!ensureCurrentConversation()) return;
  if (!dom.quickAnswerModal) return;

  renderQuickAnswerStatus("Completa la plantilla y confirma el envío para la conversación activa.", false, true);
  dom.quickAnswerModal.removeAttribute("hidden");
  dom.quickAnswerModal.style.display = "flex";
  dom.quickAnswerModal.setAttribute("aria-hidden", "false");
  dom.quickAnswerId?.focus();
}

function closeQuickAnswerModal() {
  if (!dom.quickAnswerModal) return;

  dom.quickAnswerModal.setAttribute("hidden", "hidden");
  dom.quickAnswerModal.style.display = "none";
  dom.quickAnswerModal.setAttribute("aria-hidden", "true");
  renderQuickAnswerStatus("Selecciona una conversación y prepara la plantilla que quieres enviar.", false, true);
}

function renderTransferStatus(text, isError = false, isNeutral = false) {
  if (!dom.transferStatus) return;
  dom.transferStatus.innerText = text;
  dom.transferStatus.className = isNeutral
    ? "status-note is-neutral"
    : `status-note ${isError ? "is-error" : "is-ok"}`;
}

async function loadGroupsAndUsers() {
  try {
    const [groupsRes, usersRes] = await Promise.all([
      fetch("/groups/list"),
      fetch("/users/list?tipo=2")
    ]);

    const groupsData = await groupsRes.json();
    const usersData = await usersRes.json();

    if (dom.transferGroup) {
      dom.transferGroup.innerHTML = '<option value="">Sin equipo</option>';
      if (groupsData.data) {
        groupsData.data.forEach(group => {
          const option = document.createElement("option");
          option.value = group.id;
          option.textContent = group.nombre;
          dom.transferGroup.appendChild(option);
        });
      }
    }

    if (dom.transferUser) {
      dom.transferUser.innerHTML = '<option value="">Sin agente</option>';
      if (usersData.data) {
        usersData.data.forEach(user => {
          const option = document.createElement("option");
          option.value = user.id;
          option.textContent = user.nombre;
          dom.transferUser.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("Error loading groups/users:", error);
  }
}

async function openTransferModal() {
  if (!ensureCurrentConversation()) return;
  if (!dom.transferModal) return;

  await loadGroupsAndUsers();
  renderTransferStatus("Selecciona equipo y/o agente para transferir.", false, true);
  dom.transferModal.removeAttribute("hidden");
  dom.transferModal.style.display = "flex";
  dom.transferModal.setAttribute("aria-hidden", "false");
  dom.transferGroup?.focus();
}

function closeTransferModal() {
  if (!dom.transferModal) return;

  dom.transferModal.setAttribute("hidden", "hidden");
  dom.transferModal.style.display = "none";
  dom.transferModal.setAttribute("aria-hidden", "true");
  renderTransferStatus("Selecciona una conversación para transferir.", false, true);
}

async function confirmTransfer() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;

  const idCanal = getSelectedChannelId();
  if (!idCanal) {
    renderTransferStatus("Selecciona un canal primero.", true);
    showToast("Canal requerido", "Selecciona un canal para transferir.", "info");
    return;
  }

  const idGrupo = dom.transferGroup?.value;
  const idUsuario = dom.transferUser?.value;
  const mensaje = dom.transferMessage?.value?.trim();

  const conversationData = state.conversations.find(c => c.id === conversationId);
  const contactName = conversationData?.contact_name || "Usuario";
  const celular = conversationData?.celular || "";

  const payload = {
    id_conversacion: conversationId,
    id_canal: Number(idCanal),
    estado: 1,
    contacto: {
      nombre: contactName,
      celular: celular
    }
  };

  if (idGrupo) {
    payload.id_grupo = Number(idGrupo);
  }

  if (idUsuario) {
    payload.usuario = {
      id: String(idUsuario),
      nombre: dom.transferUser.options[dom.transferUser.selectedIndex]?.text || ""
    };
  }

  if (mensaje) {
    payload.mensaje = mensaje;
  }

  renderTransferStatus("Transferiendo...", false, true);

  try {
    const response = await fetch("/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ok !== false && data.status === 1) {
      renderTransferStatus("Transferencia exitosa.", false);
      showToast("Transferencia completada", "La conversación fue transferida a LiveConnect.", "success");
      closeTransferModal();
    } else {
      const errorMsg = data.status_message || data.error || "Error en transferencia";
      renderTransferStatus(errorMsg, true);
      showToast("Transferencia fallida", errorMsg, "error");
    }
  } catch (error) {
    renderTransferStatus(`Error: ${error.message}`, true);
    showToast("Error de red", `No se pudo transferir: ${error.message}`, "error");
  }
}

function appendTextWithLinks(container, text) {
  const normalized = normalizeText(text);
  if (!normalized) return;

  const regex = /https?:\/\/[^\s]+/gi;
  let currentIndex = 0;

  for (const match of normalized.matchAll(regex)) {
    const matchedText = match[0];
    const startIndex = match.index || 0;
    const rawUrl = matchedText.replace(/[),.;!?]+$/g, "");

    if (startIndex > currentIndex) {
      container.appendChild(document.createTextNode(normalized.slice(currentIndex, startIndex)));
    }

    const link = document.createElement("a");
    link.className = "msg__link";
    link.href = rawUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerText = rawUrl;
    container.appendChild(link);

    currentIndex = startIndex + matchedText.length;
  }

  if (currentIndex < normalized.length) {
    container.appendChild(document.createTextNode(normalized.slice(currentIndex)));
  }
}

function buildLinkPreview(url) {
  const card = document.createElement("div");
  card.className = "link-card";

  const label = document.createElement("div");
  label.className = "link-card__label";
  label.innerText = "Enlace";

  const link = document.createElement("a");
  link.className = "link-card__link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.innerText = url;

  card.appendChild(label);
  card.appendChild(link);
  return card;
}

function buildFilePreview({ fileUrl, fileName, fileExt }) {
  const card = document.createElement("div");
  card.className = "file-card";

  const label = document.createElement("p");
  label.className = "file-card__label";
  label.innerText = "Archivo";

  const title = document.createElement("div");
  title.className = "file-card__title";
  title.innerText = fileName || "Archivo compartido";
  card.appendChild(label);
  card.appendChild(title);

  const resolvedExtension = normalizeFileExtension(fileExt || getUrlExtension(fileUrl));
  const extensionBadge = document.createElement("span");
  extensionBadge.className = "file-card__meta";
  extensionBadge.innerText = resolvedExtension ? `.${resolvedExtension.toUpperCase()}` : "Archivo";
  card.appendChild(extensionBadge);

  const isImage = fileUrl && isImageExtension(resolvedExtension);

  if (fileUrl) {
    const urlLink = document.createElement("a");
    urlLink.className = "file-card__link";
    urlLink.href = fileUrl;
    urlLink.target = "_blank";
    urlLink.rel = "noopener noreferrer";
    urlLink.innerText = fileUrl;
    if (isImage) {
      urlLink.addEventListener("click", (event) => {
        event.preventDefault();
        openImageModal(fileUrl);
      });
    }
    card.appendChild(urlLink);

    const actions = document.createElement("div");
    actions.className = "file-card__actions";

    if (isImage) {
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "file-card__button";
      openButton.innerText = "Abrir imagen";
      openButton.addEventListener("click", () => openImageModal(fileUrl));
      actions.appendChild(openButton);
    }

    const downloadLink = document.createElement("a");
    downloadLink.className = "file-card__download";
    downloadLink.href = fileUrl;
    downloadLink.target = "_blank";
    downloadLink.rel = "noopener noreferrer";
    downloadLink.innerText = "Descargar";
    actions.appendChild(downloadLink);

    card.appendChild(actions);
  }

  return card;
}

function buildMetadataPreview(metadata) {
  if (!metadata || typeof metadata !== "object") return null;

  const details = document.createElement("details");
  details.className = "metadata-card";

  const summary = document.createElement("summary");
  summary.innerText = "Detalles";

  const pre = document.createElement("pre");
  const metadataText = JSON.stringify(metadata, null, 2);
  pre.innerText = metadataText.length > 2000 ? `${metadataText.slice(0, 2000)}\n...` : metadataText;

  details.appendChild(summary);
  details.appendChild(pre);
  return details;
}

function buildMessageBubbleFooter(messageItem) {
  const footer = document.createElement("div");
  footer.className = "msg__bubble-meta";
  footer.innerText = formatDateLabel(messageItem.created_at);
  return footer;
}

function renderMessageBubble(item, messageItem) {
  const content = document.createElement("div");
  content.className = "msg__content";

  const rawMessageText = normalizeText(messageItem?.message);
  const parsedFileMessage = parseFileMessage(rawMessageText);

  let messageText = rawMessageText;
  let fileUrl = normalizeText(messageItem?.file_url);
  let fileName = normalizeText(messageItem?.file_name);
  let fileExt = normalizeFileExtension(messageItem?.file_ext || "");

  if (parsedFileMessage) {
    fileUrl = parsedFileMessage.url || fileUrl;
    fileName = parsedFileMessage.name || fileName;
    fileExt = parsedFileMessage.extension || fileExt;
    messageText = "";
  }

  const urls = extractUrls(messageText);
  const detectedFileUrl = inferFileUrlFromUrls(urls);
  if (!fileUrl && detectedFileUrl) {
    fileUrl = detectedFileUrl;
  }
  if (!fileExt) {
    fileExt = normalizeFileExtension(getUrlExtension(fileUrl));
  }

  const metadata = normalizeMetadata(messageItem?.metadata);

  const reportedMessageType = normalizeText(messageItem?.message_type || "text").toLowerCase();
  let messageType = reportedMessageType;
  if (!["text", "file", "link", "structured"].includes(messageType)) {
    messageType = "text";
  }
  if (messageType === "text" && fileUrl) messageType = "file";
  if (messageType === "text" && urls.length > 0) messageType = "link";

  let displayText = messageText;
  if (fileUrl) {
    displayText = removeUrlFromText(displayText, fileUrl);
  }

  if (displayText) {
    const textNode = document.createElement("div");
    textNode.className = "msg__text";
    appendTextWithLinks(textNode, displayText);
    content.appendChild(textNode);
  }

  if (messageType === "link") {
    urls.slice(0, 2).forEach((url) => content.appendChild(buildLinkPreview(url)));
  }

  if (fileUrl) {
    content.appendChild(buildFilePreview({ fileUrl, fileName, fileExt }));
  }

  const metadataNode = buildMetadataPreview(metadata);
  if (metadataNode && reportedMessageType !== "text") {
    content.appendChild(metadataNode);
  }

  item.appendChild(content);

  if (messageType !== "text") {
    const pill = document.createElement("div");
    pill.className = "msg__pill";
    if (messageType === "file") {
      pill.innerText = "Archivo adjunto";
    } else if (messageType === "link") {
      pill.innerText = "Vista previa de enlace";
    } else {
      pill.innerText = "Mensaje estructurado";
    }
    item.appendChild(pill);
  }

  item.appendChild(buildMessageBubbleFooter(messageItem));
}

function buildMessageNode(messageItem, isLast = false) {
  const item = document.createElement("article");
  item.className = `msg msg--bubble ${messageItem.sender === "usuario" ? "user" : "agent"}`;
  if (isLast) {
    item.classList.add("msg--last");
  }
  if (messageItem.isNew) {
    item.classList.add("msg--highlight");
  }
  renderMessageBubble(item, messageItem);
  return item;
}

function updateMessageGroupSummary(group, messages) {
  const summary = group.querySelector(".msg-group__summary");
  if (!summary || !messages.length) return;
  summary.innerText = `${messages.length} mensaje${messages.length === 1 ? "" : "s"} · ${formatDateLabel(messages[messages.length - 1].created_at)}`;
}

function buildMessageGroup(messages) {
  const firstMessage = messages[0];
  const group = document.createElement("section");
  group.className = `msg-group ${firstMessage.sender === "usuario" ? "msg-group--user" : "msg-group--agent"}`;
  group.dataset.sender = firstMessage.sender;
  group.dataset.day = new Date(firstMessage.created_at).toDateString();

  const header = document.createElement("div");
  header.className = "msg-group__header";

  const role = document.createElement("span");
  role.className = "msg-group__role";
  role.innerText = firstMessage.sender === "usuario" ? "Cliente" : "Agente";

  const summary = document.createElement("span");
  summary.className = "msg-group__summary";
  summary.innerText = `${messages.length} mensaje${messages.length === 1 ? "" : "s"} · ${formatDateLabel(messages[messages.length - 1].created_at)}`;

  header.appendChild(role);
  header.appendChild(summary);
  group.appendChild(header);

  messages.forEach((messageItem, index) => {
    group.appendChild(buildMessageNode(messageItem, index === messages.length - 1));
  });

  return group;
}

function buildSystemMessage(messageItem) {
  const item = document.createElement("article");
  item.className = "msg-system";

  const label = document.createElement("span");
  label.className = "msg-system__label";
  label.innerText = "Sistema";

  const body = document.createElement("p");
  body.className = "msg-system__text";
  body.innerText = messageItem.message || "Evento del sistema";

  const meta = document.createElement("span");
  meta.className = "msg-system__meta";
  meta.innerText = formatDateLabel(messageItem.created_at);

  item.appendChild(label);
  item.appendChild(body);
  item.appendChild(meta);
  return item;
}

function renderMessagesSkeleton() {
  if (!dom.messages) return;
  dom.messages.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 6; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "msg msg--skeleton";
    skeleton.innerHTML = `
      <div class="msg__content">
        <span class="skeleton-line skeleton-line--large"></span>
        <span class="skeleton-line skeleton-line--medium"></span>
        <span class="skeleton-line skeleton-line--short"></span>
      </div>
    `;
    fragment.appendChild(skeleton);
  }
  dom.messages.appendChild(fragment);
}

function isScrolledToBottom() {
  if (!dom.messages) return true;
  return dom.messages.scrollTop + dom.messages.clientHeight >= dom.messages.scrollHeight - 16;
}

function scrollMessagesToBottom() {
  if (!dom.messages) return;
  dom.messages.scrollTop = dom.messages.scrollHeight;
}

function buildMessageDateSeparator(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const separator = document.createElement("div");
  separator.className = "msg-separator";
  separator.dataset.day = date.toDateString();
  separator.innerText = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
  return separator;
}

function getNormalizedSender(rawSender) {
  const sender = normalizeText(rawSender).toLowerCase();
  if (sender.includes("system") || sender.includes("sistema")) return "system";
  if (sender.includes("usuario") || sender.includes("client")) return "usuario";
  return "agent";
}

function normalizeMessageItem(messageItem) {
  const normalized = {
    message_id: messageItem?.id || null,
    sender: getNormalizedSender(messageItem?.sender),
    message: normalizeText(messageItem?.message),
    message_type: normalizeText(messageItem?.message_type || "text"),
    file_url: normalizeText(messageItem?.file_url),
    file_name: normalizeText(messageItem?.file_name),
    file_ext: normalizeFileExtension(messageItem?.file_ext || ""),
    metadata: normalizeMetadata(messageItem?.metadata),
    created_at: normalizeText(messageItem?.created_at) || new Date().toISOString()
  };
  return normalized;
}

function mergeMessages(existing, incoming) {
  const bucket = new Map();

  existing.concat(incoming).forEach((item) => {
    if (!item) return;
    const key = item.message_id || `${item.created_at}:${item.sender}:${item.message}`;
    if (!bucket.has(key)) {
      bucket.set(key, item);
    }
  });

  return Array.from(bucket.values()).sort((a, b) => {
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.message_id || 0) - (b.message_id || 0);
  });
}

function createNewMessagesNotice() {
  if (!dom.messages || dom.newMessageNotice) return;
  const notice = document.createElement("button");
  notice.type = "button";
  notice.className = "new-message-notice";
  notice.innerText = "Nuevos mensajes ↓";
  notice.addEventListener("click", () => {
    if (!state.currentConversation) return;
    renderMessageList(state.messageCache.get(state.currentConversation) || []);
    scrollMessagesToBottom();
    hideNewMessagesNotice();
  });
  dom.newMessageNotice = notice;
  dom.messages.parentElement?.appendChild(notice);
}

function showNewMessagesNotice() {
  createNewMessagesNotice();
  if (!dom.newMessageNotice) return;
  dom.newMessageNotice.style.display = "block";
}

function hideNewMessagesNotice() {
  if (!dom.newMessageNotice) return;
  dom.newMessageNotice.style.display = "none";
}

function renderMessageList(messages) {
  if (!dom.messages) return;

  if (!state.currentConversation) {
    renderEmptyMessagesState(UI_TEXT.noConversationTitle, UI_TEXT.noConversationMeta);
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    renderEmptyMessagesState(UI_TEXT.emptyConversationTitle, UI_TEXT.emptyConversationBody);
    return;
  }

  dom.messages.innerHTML = "";
  const fragment = document.createDocumentFragment();
  let previousDay = null;
  let groupBatch = [];
  let groupSender = null;

  const flushGroup = () => {
    if (groupBatch.length === 0) return;
    fragment.appendChild(buildMessageGroup(groupBatch));
    groupBatch = [];
  };

  messages.forEach((messageItem) => {
    const messageDay = new Date(messageItem.created_at).toDateString();
    if (messageDay !== previousDay) {
      flushGroup();
      const separator = buildMessageDateSeparator(messageItem.created_at);
      if (separator) fragment.appendChild(separator);
      previousDay = messageDay;
      groupSender = null;
    }

    if (messageItem.sender === "system") {
      flushGroup();
      fragment.appendChild(buildSystemMessage(messageItem));
      groupSender = null;
      return;
    }

    if (messageItem.sender !== groupSender) {
      flushGroup();
      groupSender = messageItem.sender;
    }
    groupBatch.push(messageItem);
  });

  flushGroup();
  dom.messages.appendChild(fragment);
}

function appendMessageToTimeline(messageItem) {
  if (!dom.messages) return;

  const isEmptyState = dom.messages.querySelector(".message-empty, .msg--skeleton");
  if (isEmptyState || dom.messages.children.length === 0) {
    renderMessageList(state.messageCache.get(state.currentConversation) || []);
    return;
  }

  const messageDay = new Date(messageItem.created_at).toDateString();
  const timelineNodes = Array.from(dom.messages.children);
  const lastSeparator = timelineNodes
    .slice()
    .reverse()
    .find((node) => node.classList?.contains("msg-separator"));
  const lastGroup = timelineNodes
    .slice()
    .reverse()
    .find((node) => node.classList?.contains("msg-group")) || null;
  const lastRenderedDay = lastGroup?.dataset.day || lastSeparator?.dataset.day || "";

  if (!timelineNodes.length) {
    renderMessageList(state.messageCache.get(state.currentConversation) || []);
    return;
  }

  if (messageItem.sender === "system") {
    if (lastGroup) {
      const trailingBubble = lastGroup.querySelector(".msg--last");
      trailingBubble?.classList.remove("msg--last");
    }
    if (lastRenderedDay !== messageDay) {
      const separator = buildMessageDateSeparator(messageItem.created_at);
      if (separator) dom.messages.appendChild(separator);
    }
    dom.messages.appendChild(buildSystemMessage(messageItem));
    return;
  }

  if (!lastGroup || lastGroup.dataset.sender !== messageItem.sender || lastGroup.dataset.day !== messageDay) {
    if (lastRenderedDay !== messageDay) {
      const separator = buildMessageDateSeparator(messageItem.created_at);
      if (separator) dom.messages.appendChild(separator);
    }
    dom.messages.appendChild(buildMessageGroup([messageItem]));
    return;
  }

  const previousLast = lastGroup.querySelector(".msg--last");
  previousLast?.classList.remove("msg--last");

  const existingMessages = Array.from(lastGroup.querySelectorAll(".msg"));
  lastGroup.appendChild(buildMessageNode(messageItem, true));
  updateMessageGroupSummary(lastGroup, existingMessages.concat(messageItem));
}

async function loadMessages(conversationId, { older = false } = {}) {
  if (!dom.messages || !conversationId) return;

  const conversationPages = state.messagePages.get(conversationId) || {
    cursor: null,
    hasMore: true,
    loading: false
  };

  if (conversationPages.loading) return;
  if (older && !conversationPages.hasMore) return;

  const shouldReset = !older || !state.messageCache.has(conversationId);
  const previousScroll = dom.messages.scrollHeight - dom.messages.scrollTop;

  if (shouldReset) {
    state.messageCache.set(conversationId, []);
    state.messagePages.set(conversationId, { cursor: null, hasMore: true, loading: true });
    renderMessagesSkeleton();
  } else {
    state.messagePages.set(conversationId, { ...conversationPages, loading: true });
  }

  try {
    const params = new URLSearchParams({ limit: "20" });
    if (older && conversationPages.cursor) params.set("cursor", conversationPages.cursor);
    const url = `/messages/${encodeURIComponent(conversationId)}?${params.toString()}`;
    const { data } = await requestJSON(url);
    const page = data || {};
    const fetched = Array.isArray(page.messages) ? page.messages : [];

    const normalizedMessages = fetched.map(normalizeMessageItem);
    const existing = shouldReset ? [] : state.messageCache.get(conversationId) || [];
    const merged = mergeMessages(existing, normalizedMessages);
    state.messageCache.set(conversationId, merged);
    state.messagePages.set(conversationId, {
      cursor: page.next_cursor || null,
      hasMore: Boolean(page.has_more),
      loading: false
    });

    if (conversationId === state.currentConversation) {
      renderMessageList(merged);
      if (older) {
        dom.messages.scrollTop = dom.messages.scrollHeight - previousScroll;
      } else if (isScrolledToBottom()) {
        scrollMessagesToBottom();
      }
    }
  } catch (_error) {
    if (!older) {
      renderEmptyMessagesState("No pudimos cargar el historial", "Intenta nuevamente en unos segundos.");
    }
  } finally {
    if (state.messagePages.get(conversationId)) {
      state.messagePages.set(conversationId, { ...state.messagePages.get(conversationId), loading: false });
    }
  }
}

function parseVariablesJSON(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) return {};

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_error) {
    throw new Error("El JSON de variables no es valido.");
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Las variables deben ser un objeto JSON.");
  }

  return parsed;
}

function normalizeFileExtension(value) {
  return String(value || "").trim().toLowerCase().replace(/^\./, "");
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function inferExtensionFromUrl(url) {
  const extension = getUrlExtension(url);
  if (!extension) return "";
  return ALLOWED_FILE_EXTENSIONS.includes(extension) ? extension : "";
}

function pickFirstFilled(values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function getFileFormValues() {
  const url = pickFirstFilled([dom.chatFileUrl?.value, dom.fileUrl?.value]);
  const nombre = pickFirstFilled([dom.chatFileName?.value, dom.fileName?.value]);
  const manualExtension = normalizeFileExtension(
    pickFirstFilled([dom.chatFileExtension?.value, dom.fileExtension?.value])
  );
  const extension = manualExtension || inferExtensionFromUrl(url);

  return { url, nombre, extension };
}

function clearFileFormValues() {
  if (dom.chatFileUrl) dom.chatFileUrl.value = "";
  if (dom.chatFileName) dom.chatFileName.value = "";
  if (dom.chatFileExtension) dom.chatFileExtension.value = "";
  if (dom.fileUrl) dom.fileUrl.value = "";
  if (dom.fileName) dom.fileName.value = "";
  if (dom.fileExtension) dom.fileExtension.value = "";
}

function toggleFileComposer() {
  if (!ensureCurrentConversation()) return;
  if (!dom.fileComposer) return;
  const isHidden = dom.fileComposer.hasAttribute("hidden");
  if (isHidden) {
    dom.fileComposer.removeAttribute("hidden");
    if (dom.chatFileUrl) dom.chatFileUrl.focus();
    return;
  }
  dom.fileComposer.setAttribute("hidden", "hidden");
}

async function loadChannels() {
  if (!dom.channelSelect || !dom.canalId) return;

  dom.channelSelect.innerHTML = '<option value="">Cargando canales...</option>';

  try {
    const { res, data } = await requestJSON("/config/channels?visible=1");
    const channels = Array.isArray(data?.data) ? data.data : [];

    if (!isApiSuccess(res, data)) {
      dom.channelSelect.innerHTML = '<option value="">Error cargando canales</option>';
      renderConfigStatus("No se pudieron cargar los canales.", true);
      showToast("Canales no disponibles", "La API no devolvió canales visibles para configuración.", "error");
      return;
    }

    if (channels.length === 0) {
      dom.channelSelect.innerHTML = '<option value="">No hay canales disponibles</option>';
      renderConfigStatus("No hay canales visibles para configurar webhook.", true);
      showToast("Sin canales visibles", "No encontramos canales disponibles en la cuenta actual.", "info");
      return;
    }

    dom.channelSelect.innerHTML = '<option value="">Selecciona un canal</option>';
    channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = String(channel.id);
      option.innerText = `#${channel.id} - ${getChannelTypeLabel(channel.tipo)} - ${channel.uid || "sin uid"} - ${channel.estado === 1 ? "activo" : "inactivo"}`;
      dom.channelSelect.appendChild(option);
    });

    renderConfigStatus("Canales cargados correctamente.");
    showToast("Canales cargados", `Se cargaron ${channels.length} canales para configurar el proxy.`, "success");
  } catch (error) {
    dom.channelSelect.innerHTML = '<option value="">Error de red</option>';
    renderConfigStatus(`Error de red al cargar canales: ${error.message}`, true);
    showToast("Error de red", `No se pudieron cargar canales: ${error.message}`, "error");
  }
}

async function loadConversations() {
  if (!dom.conversationList) return;
  renderConversationSkeleton();

  try {
    const { data } = await requestJSON("/conversations");
    const conversations = Array.isArray(data) ? data : [];

    renderConversationList(conversations);

    if (state.currentConversation) {
      const refreshedConversation = state.conversationMap.get(state.currentConversation);
      if (refreshedConversation) {
        setConversationContext(refreshedConversation);
      } else {
        state.currentConversation = null;
        setConversationContext(null);
      }
    } else {
      setConversationContext(null);
    }
  } catch (_error) {
    updateConversationCount(0);
    renderSidebarEmptyState("No se pudo cargar la bandeja", "Revisa la conexión con el backend y vuelve a intentarlo.");
  }
}

async function selectConversation(conversationId, element) {
  state.currentConversation = conversationId;
  const selectedConversation = state.conversations.find((conversation) => conversation.id === conversationId) || null;

  document.querySelectorAll(".conversation").forEach((item) => item.classList.remove("active"));
  if (element) {
    element.classList.add("active");
  }

  setConversationContext(selectedConversation);
  closeConversationActionsDropdown();
  if (isMobileViewport()) {
    closeMobileNav();
  }
  await loadMessages(conversationId);
}

async function sendMessage() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId || !dom.messageInput) return;

  const message = dom.messageInput.value.trim();
  if (!message) return;

  const payload = {
    id_conversacion: conversationId,
    mensaje: message
  };

  const { res, data } = await postJSON("/sendMessage", payload);
  if (!isApiSuccess(res, data)) {
    renderConfigStatus("No se pudo enviar el mensaje.", true);
    writeWebhookResult(data);
    showToast("Error al enviar", "No se pudo enviar el mensaje a la conversación activa.", "error");
    return;
  }

  dom.messageInput.value = "";
  renderConfigStatus("Mensaje enviado correctamente.");
  writeWebhookResult(data);
  showToast("Mensaje enviado", "La respuesta se registró correctamente en la conversación.", "success");
  await loadMessages(conversationId);
}

async function sendQuickAnswer() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;

  const rawQuickAnswerId = dom.quickAnswerId?.value?.trim();
  if (!rawQuickAnswerId) {
    renderConfigStatus("Debes ingresar el ID de respuesta para QuickAnswer.", true);
    renderQuickAnswerStatus("Debes ingresar el ID de respuesta para QuickAnswer.", true);
    return;
  }

  const idRespuesta = Number.parseInt(rawQuickAnswerId, 10);
  if (!Number.isFinite(idRespuesta)) {
    renderConfigStatus("El ID de respuesta debe ser numerico.", true);
    renderQuickAnswerStatus("El ID de respuesta debe ser numérico.", true);
    return;
  }

  let variables;
  try {
    variables = parseVariablesJSON(dom.quickAnswerVariables?.value || "{}");
  } catch (error) {
    renderConfigStatus(error.message, true);
    renderQuickAnswerStatus(error.message, true);
    return;
  }

  const payload = {
    id_conversacion: conversationId,
    id_respuesta: idRespuesta,
    variables
  };

  const { res, data } = await postJSON("/sendQuickAnswer", payload);
  if (!isApiSuccess(res, data)) {
    renderConfigStatus("No se pudo enviar el QuickAnswer.", true);
    renderQuickAnswerStatus("No se pudo enviar el QuickAnswer.", true);
    writeWebhookResult(data);
    showToast("QuickAnswer fallido", "No se pudo enviar la respuesta rápida seleccionada.", "error");
    return;
  }

  renderConfigStatus("QuickAnswer enviado correctamente.");
  renderQuickAnswerStatus("QuickAnswer enviado correctamente.", false);
  writeWebhookResult(data);
  showToast("QuickAnswer enviado", "La plantilla se envió correctamente al contacto.", "success");
  closeQuickAnswerModal();
  await loadMessages(conversationId);
}

async function sendFile() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;

  const { url, nombre, extension } = getFileFormValues();

  if (!url) {
    renderConfigStatus("Debes ingresar la URL del archivo.", true);
    return;
  }
  if (!isValidHttpUrl(url)) {
    renderConfigStatus("La URL del archivo debe iniciar con http:// o https://", true);
    return;
  }
  if (!nombre) {
    renderConfigStatus("Debes ingresar el nombre del archivo.", true);
    return;
  }
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    renderConfigStatus("Debes seleccionar una extension valida.", true);
    return;
  }

  const payload = {
    id_conversacion: conversationId,
    url,
    nombre,
    extension
  };

  const { res, data } = await postJSON("/sendFile", payload);
  if (!isApiSuccess(res, data)) {
    renderConfigStatus("No se pudo enviar el archivo.", true);
    writeWebhookResult(data);
    showToast("Archivo no enviado", "No se pudo entregar el archivo a la conversación activa.", "error");
    return;
  }

  clearFileFormValues();
  if (dom.fileComposer) dom.fileComposer.setAttribute("hidden", "hidden");
  renderConfigStatus("Archivo enviado correctamente.");
  writeWebhookResult(data);
  showToast("Archivo enviado", "El archivo se entregó correctamente y quedó visible en el timeline.", "success");
  await loadMessages(conversationId);
}

async function transferConversation() {
  const conversationId = ensureCurrentConversation();
  if (!conversationId) return;

  const { res, data } = await postJSON("/transfer", {
    id_conversacion: conversationId,
    id_canal: APP_CONFIG.defaultTransferChannelId,
    estado: 1,
    mensaje: "Transferido desde Inbox Web"
  });

  if (!isApiSuccess(res, data)) {
    showToast("Transferencia fallida", UI_TEXT.transferError, "error");
    return;
  }

  showToast("Transferencia completada", UI_TEXT.transferSuccess, "success");
}

async function checkBalance() {
  const { data } = await requestJSON("/balance");
  const balance = getBalanceValue(data);

  if (balance === null) {
    showToast("Balance no disponible", UI_TEXT.invalidBalance, "error");
    return;
  }

  showToast(
    "Balance disponible",
    `Saldo estimado: $${balance.toLocaleString(APP_CONFIG.currencyLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    "info"
  );
}

function getWebhookFormValues() {
  const idCanal = getSelectedChannelId();
  const url = dom.webhookUrl?.value?.trim() || "";
  const secret = dom.secret?.value?.trim() || "";
  return { idCanal, url, secret };
}

function buildWebhookPayload({ idCanal, estado, url, secret }) {
  return {
    id_canal: Number.parseInt(String(idCanal), 10),
    estado: Boolean(estado),
    url,
    secret
  };
}

async function submitWebhookState(estado) {
  const { idCanal, url, secret } = getWebhookFormValues();

  if (!idCanal) {
    renderConfigStatus("Debes ingresar un ID de canal valido.", true);
    showToast("Canal requerido", "Selecciona un canal antes de consultar el webhook.", "info");
    return;
  }

  if (estado === true && !url) {
    renderConfigStatus("Debes ingresar la URL del webhook para activar el proxy.", true);
    return;
  }

  const payload = buildWebhookPayload({ idCanal, estado, url, secret });

  try {
    const { res, data } = await postJSON("/config/setWebhook", payload);
    const ok = isApiSuccess(res, data);

    renderConfigStatus(
      ok
        ? (estado ? "Proxy activado correctamente." : "Proxy desactivado correctamente.")
        : (estado ? "No se pudo activar el proxy." : "No se pudo desactivar el proxy."),
      !ok
    );

    writeWebhookResult(data);
    showToast(
      ok ? (estado ? "Proxy activado" : "Proxy desactivado") : "Operación rechazada",
      ok
        ? (estado ? "El webhook quedó configurado para recibir tráfico." : "El webhook quedó desactivado correctamente.")
        : (estado ? "La API no permitió activar el proxy." : "La API no permitió desactivar el proxy."),
      ok ? "success" : "error"
    );
  } catch (error) {
    renderConfigStatus(`Error de red: ${error.message}`, true);
    showToast("Error de red", `No se pudo actualizar el webhook: ${error.message}`, "error");
  }
}

async function activateWebhook() {
  await submitWebhookState(true);
}

async function deactivateWebhook() {
  await submitWebhookState(false);
}

async function checkWebhook() {
  const idCanal = getSelectedChannelId();

  if (!idCanal) {
    renderConfigStatus("Debes ingresar un ID de canal valido.", true);
    return;
  }

  try {
    const { res, data } = await postJSON("/config/getWebhook", { id_canal: idCanal });
    const ok = isApiSuccess(res, data);
    const summary = extractWebhookSummary(data || {});

    renderConfigStatus(
      ok ? `Consulta completada: webhook ${summary.estado}.` : "La consulta de webhook devolvio error.",
      !ok
    );

    renderWebhookCheckSummary(summary);
    writeWebhookResult(data);
    showToast(
      ok ? "Webhook consultado" : "Consulta con advertencias",
      ok ? `Estado actual: ${summary.estado}.` : "La API devolvió un error al consultar el webhook.",
      ok ? "success" : "error"
    );
  } catch (error) {
    renderWebhookCheckSummary({
      estado: "error",
      url: "(sin URL configurada)",
      mensaje: `Error de red: ${error.message}`
    });
    renderConfigStatus(`Error de red: ${error.message}`, true);
    showToast("Error de red", `No se pudo consultar el webhook: ${error.message}`, "error");
  }
}

async function consultBalance() {
  if (!dom.balanceDisplay) return;

  try {
    const { res, data } = await requestJSON("/config/balance");
    const balance = getBalanceValue(data);
    const ok = isApiSuccess(res, data);

    if (balance === null) {
      dom.balanceDisplay.innerText = "No se pudo obtener un valor de saldo valido.";
      writeWebhookResult({ balance_response: data });
      renderConfigStatus("No se pudo interpretar el balance de la API. Revisa la respuesta en el panel oscuro.", true);
      return;
    }

    dom.balanceDisplay.innerText = `Saldo actual: $${balance.toLocaleString(APP_CONFIG.currencyLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    renderConfigStatus(
      ok ? "Balance consultado correctamente." : "Balance consultado con advertencias.",
      !ok
    );
    showToast(
      ok ? "Balance actualizado" : "Balance con advertencias",
      `Saldo actual: $${balance.toLocaleString(APP_CONFIG.currencyLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ok ? "success" : "info"
    );
  } catch (error) {
    dom.balanceDisplay.innerText = "Error de red consultando balance.";
    renderConfigStatus(`Error de red: ${error.message}`, true);
    showToast("Error de red", `No se pudo consultar el balance: ${error.message}`, "error");
  }
}

function openSettings() {
  if (!dom.settingsPanel) return;
  dom.settingsPanel.style.display = "block";
  dom.settingsPanel.setAttribute("aria-hidden", "false");
  loadChannels();
}

function closeSettings() {
  if (!dom.settingsPanel) return;
  dom.settingsPanel.style.display = "none";
  dom.settingsPanel.setAttribute("aria-hidden", "true");
}

function appendIncomingMessage(payload) {
  const conversationId = normalizeText(payload?.conversation_id);
  if (!conversationId) return;

  const existing = state.messageCache.get(conversationId) || [];
  const messageItem = normalizeMessageItem({
    id: payload?.message_id,
    sender: payload?.sender,
    message: payload?.message,
    message_type: payload?.message_type,
    file_url: payload?.file_url,
    file_name: payload?.file_name,
    file_ext: payload?.file_ext,
    metadata: payload?.metadata,
    created_at: payload?.created_at || new Date().toISOString()
  });

  const merged = mergeMessages(existing, [messageItem]);
  state.messageCache.set(conversationId, merged);

  if (conversationId === state.currentConversation) {
    appendMessageToTimeline(messageItem);
  }
}

function handleRealtimeMessage(payload) {
  const conversationId = normalizeText(payload?.conversation_id);
  if (!conversationId) return;

  const currentConversation = state.conversationMap.get(conversationId) || {};
  const sender = String(payload?.sender || "").toLowerCase();
  const lastMessageFrom = sender.includes("agent") || sender.includes("agente") ? "agent" : sender.includes("usuario") || sender.includes("client") ? "client" : "system";
  const lastMessageAt = payload?.created_at || new Date().toISOString();

  const updatedConversation = {
    ...currentConversation,
    id: conversationId,
    canal: payload?.canal || currentConversation.canal || "",
    contact_name: payload?.contact_name || currentConversation.contact_name || "",
    last_message_at: lastMessageAt,
    updated_at: lastMessageAt,
    last_message_from: lastMessageFrom,
    unread_count: conversationId === state.currentConversation ? 0 : (Number(currentConversation.unread_count) || 0) + 1,
    priority_score: getConversationAgeMinutes({ last_message_at: lastMessageAt }) * 2 + (lastMessageFrom === "client" ? 50 : 0),
  };

  if (currentConversation.archived && lastMessageFrom === "client") {
    updatedConversation.archived = false;
    postJSON("/conversation/archive", { id_conversacion: conversationId, archived: false }).catch(() => {});
  }

  updateConversationItem(updatedConversation);

  if (conversationId === state.currentConversation) {
    const wasAtBottom = isScrolledToBottom();
    appendIncomingMessage(payload);
    if (wasAtBottom) {
      scrollMessagesToBottom();
      hideNewMessagesNotice();
    } else {
      showNewMessagesNotice();
    }
  }
}

function updateSSEIndicator() {
  if (!dom.sseStatus) return;
  
  if (state.eventStreamConnected) {
    dom.sseStatus.innerHTML = "🟢 Conectado";
    dom.sseStatus.style.color = "var(--brand)";
  } else {
    dom.sseStatus.innerHTML = "🔴 Sin conexión";
    dom.sseStatus.style.color = "var(--danger)";
  }
}

function connectEventStream() {
  if (typeof window.EventSource !== "function") {
    showToast(
      "Sin SSE",
      "Este navegador no soporta EventSource. Usa el botón 'Actualizar' para refrescar manualmente.",
      "info"
    );
    updateSSEIndicator();
    return;
  }

  if (state.eventSource) {
    state.eventSource.close();
  }

  const eventSource = new window.EventSource("/events/stream");
  state.eventSource = eventSource;

  eventSource.addEventListener("stream.ready", () => {
    state.eventStreamConnected = true;
    updateSSEIndicator();
    console.log("✅ SSE conectado");
  });

  eventSource.addEventListener("stream.heartbeat", () => {
    state.eventStreamConnected = true;
    updateSSEIndicator();
  });

  eventSource.addEventListener("message.updated", (event) => {
    state.eventStreamConnected = true;
    updateSSEIndicator();

    try {
      const payload = JSON.parse(event.data || "{}");
      console.log("📨 Evento recibido:", event.type, payload);
      handleRealtimeMessage(payload);
    } catch (_error) {
      console.error("Error procesando evento:", _error);
      scheduleConversationRefresh(80);
    }
  });

  eventSource.onerror = () => {
    const wasConnected = state.eventStreamConnected;
    state.eventStreamConnected = false;
    updateSSEIndicator();

    if (wasConnected) {
      console.warn("⚠️ SSE desconectado, reconectando...");
      showToast(
        "Conexión perdida",
        "Reconectando... o usa 'Actualizar' para refrescar manualmente.",
        "info"
      );
    }
    
    window.setTimeout(() => connectEventStream(), 3000);
  };
}

function refreshNow() {
  loadConversations();
  if (state.currentConversation) {
    loadMessages(state.currentConversation);
  }
  showToast("Actualizando", "Datos refrescados manualmente.", "info");
}

const actionHandlers = Object.freeze({
  openSettings,
  closeSettings,
  openQuickAnswerModal,
  closeQuickAnswerModal,
  closeImageModal,
  loadChannels,
  activateWebhook,
  deactivateWebhook,
  checkWebhook,
  consultBalance,
  checkBalance,
  toggleFileComposer,
  sendQuickAnswer,
  sendFile,
  openTransferModal,
  closeTransferModal,
  confirmTransfer,
  archiveCurrentConversation,
  markCurrentConversationRead,
  sendMessage,
  toggleConversationActionsDropdown,
  toggleSidebar,
  refreshNow
});

function onActionClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const handler = actionHandlers[action];
  if (!handler) return;

  event.preventDefault();
  if (action !== "toggleConversationActionsDropdown" && target.closest("#conversationActionsDropdown")) {
    closeConversationActionsDropdown();
  }
  handler();
}

function onConversationActionClick(event) {
  const actionButton = event.target.closest("[data-conversation-action]");
  if (!actionButton) return false;

  const item = event.target.closest("[data-conversation-id]");
  if (!item) return false;

  const conversationId = item.dataset.conversationId;
  if (!conversationId) return false;

  const action = actionButton.dataset.conversationAction;
  if (action === "archive") {
    toggleArchiveConversation(conversationId);
  } else if (action === "mark-read") {
    markConversationRead(conversationId);
  } else if (action === "transfer") {
    selectConversation(conversationId, item).then(() => openTransferModal());
  } else if (action === "actions") {
    selectConversation(conversationId, item).then(() => openConversationActionsMenu());
  }

  event.stopPropagation();
  return true;
}

function onConversationClick(event) {
  if (onConversationActionClick(event)) return;

  const item = event.target.closest("[data-conversation-id]");
  if (!item) return;

  const conversationId = item.dataset.conversationId;
  if (!conversationId) return;

  selectConversation(conversationId, item);
}

function onMessagesScroll() {
  if (!dom.messages || !state.currentConversation) return;

  const atTop = dom.messages.scrollTop <= 60;
  const pages = state.messagePages.get(state.currentConversation) || { hasMore: false, loading: false };
  if (atTop && pages.hasMore && !pages.loading) {
    loadMessages(state.currentConversation, { older: true });
  }

  state.messageScrollAtBottom = isScrolledToBottom();
  if (state.messageScrollAtBottom) {
    hideNewMessagesNotice();
  }
}

async function toggleArchiveConversation(conversationId) {
  const conversation = state.conversationMap.get(conversationId);
  if (!conversation) return;

  const newArchived = !conversation.archived;
  try {
    await postJSON("/conversation/archive", { id_conversacion: conversationId, archived: newArchived });
  } catch (_error) {
    showToast("Error", "No se pudo actualizar el estado de archivado.", "error");
  }

  updateConversationItem({ ...conversation, archived: newArchived });
  if (state.currentConversation === conversationId && newArchived) {
    state.currentConversation = null;
    setConversationContext(null);
    renderEmptyMessagesState(UI_TEXT.noConversationTitle, UI_TEXT.noConversationMeta);
  }
}

async function markConversationRead(conversationId) {
  const conversation = state.conversationMap.get(conversationId);
  if (!conversation) return;

  try {
    await postJSON("/conversation/read", { id_conversacion: conversationId });
  } catch (_error) {
    // Ignore if backend fails, update local state anyway.
  }

  updateConversationItem({ ...conversation, unread_count: 0 });
}

function onChannelSelectionChange(event) {
  if (!dom.canalId) return;
  dom.canalId.value = event.target.value || "";
}

function onMessageInputKeyDown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  sendMessage();
}

function onSettingsBackdropClick(event) {
  if (event.target === dom.settingsPanel) {
    closeSettings();
  }
}

function onQuickAnswerBackdropClick(event) {
  if (event.target === dom.quickAnswerModal) {
    closeQuickAnswerModal();
  }
}

function onImageModalClick(event) {
  if (!dom.imageModal) return;
  if (event.target === dom.imageModal) {
    closeImageModal();
  }
}

function onDocumentClick(event) {
  const target = event.target;
  if (!target) return;

  if (!target.closest("#conversationActionsMenu")) {
    closeConversationActionsDropdown();
  }
}

function onDocumentKeyDown(event) {
  if (event.key === "Escape") {
    closeConversationActionsDropdown();
    closeMobileNav();
    closeImageModal();
    closeSettings();
    closeQuickAnswerModal();
  }
}

function onWindowResize() {
  if (!isMobileViewport()) {
    closeMobileNav();
  }
}

function bindEvents() {
  document.addEventListener("click", onActionClick);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeyDown);
  
  if (dom.refreshNowBtn) {
    dom.refreshNowBtn.addEventListener("click", (e) => {
      e.preventDefault();
      refreshNow();
    });
  }
  
  window.addEventListener("beforeunload", () => {
    if (state.eventSource) {
      state.eventSource.close();
    }
    stopRelativeTimeUpdater();
  });
  window.addEventListener("resize", onWindowResize);

  if (dom.conversationList) {
    dom.conversationList.addEventListener("click", onConversationClick);
  }

  if (dom.mobileNavBackdrop) {
    dom.mobileNavBackdrop.addEventListener("click", closeMobileNav);
  }

  if (dom.messages) {
    dom.messages.addEventListener("scroll", onMessagesScroll);
  }

  if (dom.channelSelect) {
    dom.channelSelect.addEventListener("change", onChannelSelectionChange);
  }

  if (dom.messageInput) {
    dom.messageInput.addEventListener("keydown", onMessageInputKeyDown);
  }

  if (dom.settingsPanel) {
    dom.settingsPanel.addEventListener("click", onSettingsBackdropClick);
  }

  if (dom.quickAnswerModal) {
    dom.quickAnswerModal.addEventListener("click", onQuickAnswerBackdropClick);
  }

  if (dom.imageModal) {
    dom.imageModal.addEventListener("click", onImageModalClick);
  }

  if (dom.imageModalCloseBtn) {
    dom.imageModalCloseBtn.addEventListener("click", closeImageModal);
  }

  // Theme listeners
  if (dom.themeSelect) {
    dom.themeSelect.addEventListener("change", onThemeSelectChange);
  }
  if (dom.themeSwatches) {
    dom.themeSwatches.addEventListener("click", onThemeSwatchClick);
  }
}

function toggleSidebar() {
  if (isMobileViewport()) {
    if (state.mobileNavOpen) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
    return;
  }

  const isCollapsed = dom.appFrame?.classList.toggle("is-sidebar-collapsed");
  dom.sidebarShell?.classList.toggle("collapsed", Boolean(isCollapsed));
  dom.sidebarToggle?.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
  try {
    localStorage.setItem("sidebarCollapsed", String(isCollapsed));
  } catch (_) {}
}

function initApp() {
  closeConversationActionsDropdown();
  closeMobileNav();
  closeImageModal();
  closeSettings();
  closeQuickAnswerModal();
  
  // Restore sidebar state
  const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (sidebarCollapsed) {
    dom.appFrame?.classList.add("is-sidebar-collapsed");
    dom.sidebarShell?.classList.add("collapsed");
    dom.sidebarToggle?.setAttribute("aria-expanded", "false");
  }
  
  setConversationContext(null);
  renderEmptyMessagesState(UI_TEXT.noConversationTitle, UI_TEXT.noConversationMeta);
  syncConversationControls();
  
  // Apply stored theme on load
  applyTheme(getInitialTheme(), false);
  
  bindEvents();
  loadConversations();
  connectEventStream();
  startRelativeTimeUpdater();
}

initApp();
