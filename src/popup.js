const STORAGE_KEY = "focusTabsSessions";
const THEME_KEY = "focusTabsTheme";
const DEFAULT_THEME = "ocean";
const ALLOWED_THEMES = new Set(["ocean", "orange", "berry", "green"]);

const sessionNameInput = document.getElementById("sessionName");
const saveSessionBtn = document.getElementById("saveSessionBtn");
const exportSessionsBtn = document.getElementById("exportSessionsBtn");
const importSessionsBtn = document.getElementById("importSessionsBtn");
const importFileInput = document.getElementById("importFileInput");
const sessionsList = document.getElementById("sessionsList");
const emptyState = document.getElementById("emptyState");
const feedback = document.getElementById("feedback");
const themeSwatches = document.querySelectorAll(".theme-swatch");
const expandedSessions = new Set();

init();

async function init() {
  await loadTheme();

  saveSessionBtn.addEventListener("click", saveCurrentSession);
  exportSessionsBtn.addEventListener("click", exportSessionsToJson);
  importSessionsBtn.addEventListener("click", triggerImportPicker);
  importFileInput.addEventListener("change", importSessionsFromFile);

  sessionNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveCurrentSession();
    }
  });

  for (const swatch of themeSwatches) {
    swatch.addEventListener("click", () => {
      const selectedTheme = sanitizeTheme(swatch.dataset.theme);
      handleThemeChange(selectedTheme);
    });
  }

  renderSessions();
}

async function handleThemeChange(selectedTheme) {
  applyTheme(selectedTheme);
  syncThemeSwatches(selectedTheme);

  try {
    await chrome.storage.local.set({ [THEME_KEY]: selectedTheme });
  } catch (error) {
    console.error("Error saving theme:", error);
    setFeedback("Could not save theme.");
  }
}

async function loadTheme() {
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    const theme = sanitizeTheme(stored[THEME_KEY]);
    applyTheme(theme);
    syncThemeSwatches(theme);
  } catch (error) {
    console.error("Error loading theme:", error);
    applyTheme(DEFAULT_THEME);
    syncThemeSwatches(DEFAULT_THEME);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function sanitizeTheme(theme) {
  return ALLOWED_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function syncThemeSwatches(activeTheme) {
  for (const swatch of themeSwatches) {
    const isActive = swatch.dataset.theme === activeTheme;
    swatch.classList.toggle("is-active", isActive);
    swatch.setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

async function saveCurrentSession() {
  const name = sessionNameInput.value.trim();

  if (!name) {
    setFeedback("Please provide a session name.");
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const urls = tabs
      .map((tab) => tab.url)
      .filter((url) => isSavableUrl(url));

    if (urls.length === 0) {
      setFeedback("No valid URLs found to save.");
      return;
    }

    const sessions = await getSessions();
    sessions.unshift({
      id: crypto.randomUUID(),
      name,
      urls,
      createdAt: Date.now()
    });

    await chrome.storage.local.set({ [STORAGE_KEY]: sessions });
    sessionNameInput.value = "";
    setFeedback(`Session saved with ${urls.length} tab(s).`);
    renderSessions();
  } catch (error) {
    console.error("Error saving session:", error);
    setFeedback("Could not save the session.");
  }
}

async function openSession(sessionId) {
  const sessions = await getSessions();
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) {
    setFeedback("Session not found.");
    return;
  }

  const urlsToOpen = session.urls.filter((url) => isOpenableUrl(url));

  if (urlsToOpen.length === 0) {
    setFeedback("This session has no URLs that can be opened automatically.");
    return;
  }

  for (const url of urlsToOpen) {
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      console.warn("URL blocked by Chrome:", url, error);
    }
  }

  if (urlsToOpen.length < session.urls.length) {
    setFeedback("Session opened with security filters applied.");
  } else {
    setFeedback(`Session \"${session.name}\" opened.`);
  }
}

async function closeSessionTabs(sessionId) {
  const sessions = await getSessions();
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) {
    setFeedback("Session not found.");
    return;
  }

  const urlSet = new Set(session.urls);

  try {
    const openTabs = await chrome.tabs.query({});
    const tabIdsToClose = openTabs
      .filter((tab) => tab.id && typeof tab.url === "string" && urlSet.has(tab.url))
      .map((tab) => tab.id);

    if (tabIdsToClose.length === 0) {
      setFeedback("No open tabs from this session were found.");
      return;
    }

    await chrome.tabs.remove(tabIdsToClose);
    setFeedback(`Closed ${tabIdsToClose.length} tab(s) from \"${session.name}\".`);
  } catch (error) {
    console.error("Error closing session tabs:", error);
    setFeedback("Could not close tabs from this session.");
  }
}

async function deleteSession(sessionId) {
  const sessions = await getSessions();
  const nextSessions = sessions.filter((item) => item.id !== sessionId);
  await chrome.storage.local.set({ [STORAGE_KEY]: nextSessions });
  expandedSessions.delete(sessionId);
  setFeedback("Session deleted.");
  renderSessions();
}

async function exportSessionsToJson() {
  try {
    const sessions = await getSessions();

    if (!sessions.length) {
      setFeedback("There are no sessions to export.");
      return;
    }

    const payload = {
      app: "FocusTabs",
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: sessions.map((session) => ({
        id: session.id,
        name: session.name,
        urls: session.urls,
        createdAt: session.createdAt
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `focus-tabs-sessions-${buildExportTimestamp()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);

    setFeedback(`Exported ${sessions.length} session(s).`);
  } catch (error) {
    console.error("Error exporting sessions:", error);
    setFeedback("Could not export sessions.");
  }
}

function triggerImportPicker() {
  importFileInput.click();
}

async function importSessionsFromFile(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const rawSessions = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.sessions)
        ? parsed.sessions
        : null;

    if (!rawSessions) {
      setFeedback("Invalid JSON format. Expected a sessions array.");
      return;
    }

    const normalizedImported = normalizeImportedSessions(rawSessions);

    if (!normalizedImported.length) {
      setFeedback("No valid sessions found in this file.");
      return;
    }

    const existingSessions = await getSessions();
    const mergeResult = mergeSessions(existingSessions, normalizedImported);

    if (mergeResult.addedCount === 0) {
      setFeedback("All imported sessions already exist.");
      return;
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: mergeResult.sessions });
    setFeedback(`Imported ${mergeResult.addedCount} new session(s).`);
    renderSessions();
  } catch (error) {
    console.error("Error importing sessions:", error);
    setFeedback("Could not import this JSON file.");
  } finally {
    importFileInput.value = "";
  }
}

async function renderSessions() {
  const sessions = await getSessions();
  sessionsList.innerHTML = "";

  emptyState.style.display = sessions.length ? "none" : "block";

  for (const session of sessions) {
    const item = document.createElement("li");
    item.className = "session-item";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-expanded", expandedSessions.has(session.id) ? "true" : "false");

    if (expandedSessions.has(session.id)) {
      item.classList.add("expanded");
    }

    const head = document.createElement("div");
    head.className = "session-head";

    const meta = document.createElement("div");
    meta.className = "session-meta";

    const name = document.createElement("p");
    name.className = "session-name";
    name.textContent = `${session.name} - ${session.urls.length} tabs`;

    const date = document.createElement("p");
    date.className = "session-date";
    date.textContent = new Date(session.createdAt).toLocaleString();

    const actions = document.createElement("div");
    actions.className = "session-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "open-btn";
    openBtn.type = "button";
    openBtn.textContent = "Open Session";
    openBtn.addEventListener("click", () => openSession(session.id));

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.type = "button";
    closeBtn.title = "Close tabs from this session";
    closeBtn.setAttribute("aria-label", "Close tabs from this session");
    closeBtn.innerHTML = "&#10006;";
    closeBtn.addEventListener("click", () => closeSessionTabs(session.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete session";
    deleteBtn.setAttribute("aria-label", "Delete session");
    deleteBtn.innerHTML = "&#128465;";

    let deleteConfirmTimer = null;

    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (deleteBtn.classList.contains("confirming")) {
        clearTimeout(deleteConfirmTimer);
        deleteSession(session.id);
      } else {
        deleteBtn.classList.add("confirming");
        deleteBtn.title = "Click again to confirm";
        deleteBtn.textContent = "Sure?";
        deleteConfirmTimer = setTimeout(() => {
          deleteBtn.classList.remove("confirming");
          deleteBtn.title = "Delete session";
          deleteBtn.innerHTML = "&#128465;";
        }, 3000);
      }
    });

    const details = document.createElement("div");
    details.className = "session-details";

    const detailsLabel = document.createElement("p");
    detailsLabel.className = "session-details-label";
    detailsLabel.textContent = "Pages in this session";

    const urlsList = document.createElement("ul");
    urlsList.className = "session-urls";

    for (const url of session.urls) {
      const urlItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = formatUrlLabel(url);
      link.title = url;
      urlItem.append(link);
      urlsList.append(urlItem);
    }

    details.append(detailsLabel, urlsList);
    actions.append(openBtn, closeBtn, deleteBtn);
    meta.append(name, date);
    head.append(meta, actions);
    item.append(head, details);

    let clickTimer = null;

    name.title = "Double-click to rename";

    name.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      clearTimeout(clickTimer);
      startRename(name, session);
    });

    item.addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest("a") || event.target.closest(".rename-input")) {
        return;
      }
      if (event.detail !== 1) return;

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        toggleSessionExpanded(session.id);
        renderSessions();
      }, 220);
    });

    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSessionExpanded(session.id);
        renderSessions();
      }
    });

    sessionsList.append(item);
  }
}

function toggleSessionExpanded(sessionId) {
  if (expandedSessions.has(sessionId)) {
    expandedSessions.delete(sessionId);
  } else {
    expandedSessions.add(sessionId);
  }
}

function startRename(nameEl, session) {
  const input = document.createElement("input");
  input.className = "rename-input";
  input.type = "text";
  input.value = session.name;
  input.maxLength = 80;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (newName && newName !== session.name) {
      await renameSession(session.id, newName);
    } else {
      renderSessions();
    }
  }

  function cancel() {
    if (committed) return;
    committed = true;
    renderSessions();
  }

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      cancel();
    }
  });

  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("dblclick", (event) => event.stopPropagation());
  input.addEventListener("blur", commit);
}

async function renameSession(sessionId, newName) {
  const sessions = await getSessions();
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return;
  target.name = newName;
  await chrome.storage.local.set({ [STORAGE_KEY]: sessions });
  setFeedback(`Renamed to "${newName}".`);
  renderSessions();
}

async function getSessions() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
}

function normalizeImportedSessions(rawSessions) {
  const normalized = [];

  for (let index = 0; index < rawSessions.length; index += 1) {
    const rawSession = rawSessions[index];

    if (!rawSession || typeof rawSession !== "object") {
      continue;
    }

    const rawUrls = Array.isArray(rawSession.urls) ? rawSession.urls : [];
    const urls = [...new Set(
      rawUrls
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter((url) => isSavableUrl(url))
    )];

    if (!urls.length) {
      continue;
    }

    const name = typeof rawSession.name === "string" ? rawSession.name.trim() : "";
    const createdAt = Number.isFinite(rawSession.createdAt) ? Number(rawSession.createdAt) : Date.now();
    const id = typeof rawSession.id === "string" && rawSession.id.trim()
      ? rawSession.id.trim()
      : crypto.randomUUID();

    normalized.push({
      id,
      name: name || `Imported Session ${index + 1}`,
      urls,
      createdAt
    });
  }

  return normalized;
}

function mergeSessions(existingSessions, importedSessions) {
  const sessions = [...existingSessions];
  const existingIds = new Set(existingSessions.map((session) => session.id));
  const signatures = new Set(existingSessions.map((session) => getSessionSignature(session)));
  let addedCount = 0;

  for (let index = importedSessions.length - 1; index >= 0; index -= 1) {
    const importedSession = importedSessions[index];
    const signature = getSessionSignature(importedSession);

    if (signatures.has(signature)) {
      continue;
    }

    const sessionToInsert = { ...importedSession };

    if (existingIds.has(sessionToInsert.id)) {
      sessionToInsert.id = crypto.randomUUID();
    }

    sessions.unshift(sessionToInsert);
    existingIds.add(sessionToInsert.id);
    signatures.add(signature);
    addedCount += 1;
  }

  return { sessions, addedCount };
}

function getSessionSignature(session) {
  return `${session.name}|${session.createdAt}|${session.urls.join("\n")}`;
}

function buildExportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function setFeedback(message) {
  feedback.textContent = message;
}

function formatUrlLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

function isSavableUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();
  const blockedExact = new Set(["about:blank", "chrome://newtab/", "edge://newtab/"]);

  if (blockedExact.has(trimmed)) {
    return false;
  }

  return /^(https?:|file:|ftp:)/i.test(trimmed);
}

function isOpenableUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();

  if (/^(chrome|edge|brave|opera):\/\//i.test(trimmed)) {
    return false;
  }

  return /^(https?:|file:|ftp:)/i.test(trimmed);
}
