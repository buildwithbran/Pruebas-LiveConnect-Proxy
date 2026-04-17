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
const THEMES = Object.freeze([
  "light",
  "dark",
  "sage",
  "sunset",
  "midnight-blue",
  "neon-industrial"
]);

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

const state = {
  currentConversation: null,
  currentConversationData: null,
  conversations: [],
  theme: "light",
  eventSource: null,
  eventStreamConnected: false,
  scheduledConversationRefresh: null,
  scheduledMessageRefresh: null
};

const dom = {
  appFrame: document.getElementById("app"),
  sidebarShell: document.getElementById("sidebarShell"),
  sidebarToggle: document.getElementById("sidebarToggle"),
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
  refreshNowBtn: document.getElementById("refreshNowBtn")
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
  const storedTheme = readStoredTheme();
  if (storedTheme) return storedTheme;

  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch (_error) {
    // Ignore media query failures.
  }

  return "light";
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
  const pieces = [];

  if (conversationId) pieces.push(conversationId);
  if (channel) pieces.push(`Canal ${channel}`);

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

function renderConversationList(conversations) {
  if (!dom.conversationList) return;

  dom.conversationList.innerHTML = "";

  if (!Array.isArray(conversations) || conversations.length === 0) {
    renderSidebarEmptyState(UI_TEXT.emptyInboxTitle, UI_TEXT.emptyInboxBody);
    return;
  }

  const fragment = document.createDocumentFragment();

  conversations.forEach((conversation) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "conversation";
    if (conversation.id === state.currentConversation) {
      item.classList.add("active");
    }
    item.dataset.conversationId = conversation.id;

    const header = document.createElement("div");
    header.className = "conversation__row";

    const title = document.createElement("p");
    title.className = "conversation__title";
    title.innerText = getConversationLabel(conversation);

    const time = document.createElement("span");
    time.className = "conversation__time";
    time.innerText = formatDateLabel(conversation.updated_at);

    header.appendChild(title);
    header.appendChild(time);

    const meta = document.createElement("p");
    meta.className = "conversation__meta";
    meta.innerText = getConversationMetaLine(conversation);

    const badge = document.createElement("span");
    badge.className = "conversation__badge";
    badge.innerText = normalizeText(conversation?.canal || "Canal desconocido");

    item.appendChild(header);
    item.appendChild(meta);
    item.appendChild(badge);
    fragment.appendChild(item);
  });

  dom.conversationList.appendChild(fragment);
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
      openButton.innerText = "Abrir archivo";
      openButton.addEventListener("click", () => openImageModal(fileUrl));
      actions.appendChild(openButton);
    }

    const downloadLink = document.createElement("a");
    downloadLink.className = "file-card__download";
    downloadLink.href = fileUrl;
    downloadLink.target = "_blank";
    downloadLink.rel = "noopener noreferrer";
    downloadLink.innerText = "Descargar archivo";
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
  summary.innerText = "Metadata";

  const pre = document.createElement("pre");
  const metadataText = JSON.stringify(metadata, null, 2);
  pre.innerText = metadataText.length > 2000 ? `${metadataText.slice(0, 2000)}\n...` : metadataText;

  details.appendChild(summary);
  details.appendChild(pre);
  return details;
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

  messages.forEach((messageItem) => {
    const item = document.createElement("div");
    item.className = `msg ${messageItem.sender === "usuario" ? "user" : "agent"}`;

    renderMessageBubble(item, messageItem);

    const meta = document.createElement("div");
    meta.className = "msg__meta";

    const tag = document.createElement("span");
    tag.className = "msg__tag";
    tag.innerText = messageItem.sender === "usuario" ? "Cliente" : "Agente";

    const time = document.createElement("span");
    time.innerText = formatDateLabel(messageItem.created_at);

    meta.appendChild(tag);
    meta.appendChild(time);
    item.appendChild(meta);
    fragment.appendChild(item);
  });

  dom.messages.appendChild(fragment);
  dom.messages.scrollTop = dom.messages.scrollHeight;
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

  try {
    const { data } = await requestJSON("/conversations");
    const conversations = Array.isArray(data) ? data : [];
    state.conversations = conversations;
    updateConversationCount(conversations.length);

    if (state.currentConversation) {
      const refreshedConversation = conversations.find(
        (conversation) => conversation.id === state.currentConversation
      );
      if (refreshedConversation) {
        setConversationContext(refreshedConversation);
      } else {
        state.currentConversation = null;
        setConversationContext(null);
      }
    } else {
      setConversationContext(null);
    }

    renderConversationList(conversations);
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
  await loadMessages(conversationId);
}

async function loadMessages(conversationId) {
  if (!dom.messages) return;

  try {
    const encodedId = encodeURIComponent(conversationId);
    const { data } = await requestJSON(`/messages/${encodedId}`);
    const messages = Array.isArray(data) ? data : [];

    const normalizedMessages = messages.map((messageItem) => ({
      sender: messageItem?.sender === "usuario" ? "usuario" : "agent",
      message: normalizeText(messageItem?.message),
      message_type: normalizeText(messageItem?.message_type || "text"),
      file_url: normalizeText(messageItem?.file_url),
      file_name: normalizeText(messageItem?.file_name),
      file_ext: normalizeFileExtension(messageItem?.file_ext || ""),
      metadata: normalizeMetadata(messageItem?.metadata),
      created_at: normalizeText(messageItem?.created_at)
    }));

    renderMessageList(normalizedMessages);
  } catch (_error) {
    renderEmptyMessagesState("No pudimos cargar el historial", "Intenta nuevamente en unos segundos.");
  }
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

function handleRealtimeMessage(payload) {
  const conversationId = normalizeText(payload?.conversation_id);
  scheduleConversationRefresh(80);

  if (conversationId && conversationId === state.currentConversation) {
    scheduleMessageRefresh(conversationId, 80);
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
  sendMessage,
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
  handler();
}

function onConversationClick(event) {
  const item = event.target.closest("[data-conversation-id]");
  if (!item) return;

  const conversationId = item.dataset.conversationId;
  if (!conversationId) return;

  selectConversation(conversationId, item);
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

function onDocumentKeyDown(event) {
  if (event.key === "Escape") {
    closeImageModal();
    closeSettings();
    closeQuickAnswerModal();
  }
}

function bindEvents() {
  document.addEventListener("click", onActionClick);
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
  });

  if (dom.conversationList) {
    dom.conversationList.addEventListener("click", onConversationClick);
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
  const isCollapsed = dom.appFrame?.classList.toggle("is-sidebar-collapsed");
  dom.sidebarShell?.classList.toggle("collapsed", Boolean(isCollapsed));
  dom.sidebarToggle?.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
  try {
    localStorage.setItem("sidebarCollapsed", String(isCollapsed));
  } catch (_) {}
}

function initApp() {
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
}

initApp();
