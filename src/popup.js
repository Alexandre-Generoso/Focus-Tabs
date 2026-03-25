const STORAGE_KEY = "focusTabsSessions";
const THEME_KEY = "focusTabsTheme";
const DEFAULT_THEME = "ocean";
const ALLOWED_THEMES = new Set(["ocean", "orange", "berry", "green"]);

const sessionNameInput = document.getElementById("sessionName");
const saveSessionBtn = document.getElementById("saveSessionBtn");
const sessionsList = document.getElementById("sessionsList");
const emptyState = document.getElementById("emptyState");
const feedback = document.getElementById("feedback");
const themeSwatches = document.querySelectorAll(".theme-swatch");
const expandedSessions = new Set();

init();

async function init() {
  await loadTheme();

  saveSessionBtn.addEventListener("click", saveCurrentSession);
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
    deleteBtn.addEventListener("click", () => deleteSession(session.id));

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

    item.addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest("a")) {
        return;
      }

      toggleSessionExpanded(session.id);
      renderSessions();
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

async function getSessions() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
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
