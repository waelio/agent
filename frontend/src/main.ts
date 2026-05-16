import "./style.css";
import { setupPwa } from "./pwa";

const APP_NAME = import.meta.env.VITE_AGENT_APP_NAME?.trim() || "@waelio/agent";
const BACKEND_URL_STORAGE_KEY = "waelio-agent-backend-url";
const USER_ID_STORAGE_KEY = "waelio-agent-user-id";
const THEME_STORAGE_KEY = "waelio-agent-theme";

type Theme = "dark" | "dim" | "light";

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    const iconMap = { dark: "🌑", dim: "🌗", light: "☀️" };
    toggleBtn.textContent = `${iconMap[theme]} Theme`;
  }
}

function initTheme(): void {
  let saved: Theme = "dark";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "dim" || raw === "light") saved = raw;
  } catch { /* ignore */ }
  applyTheme(saved);
}

initTheme();

const toggleBtn = document.getElementById("theme-toggle");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") as Theme || "dark";
    const nextMap: Record<Theme, Theme> = { dark: "dim", dim: "light", light: "dark" };
    applyTheme(nextMap[current]);
  });
}

type BackendSource = "saved" | "env" | "local" | "unset";

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function readStoredBackendUrl(): string {
  try {
    return normalizeBackendUrl(window.localStorage.getItem(BACKEND_URL_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

function writeStoredBackendUrl(backendUrl: string): void {
  try {
    if (backendUrl) {
      window.localStorage.setItem(BACKEND_URL_STORAGE_KEY, backendUrl);
    } else {
      window.localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function getConfiguredBackend(ignoreSaved = false): { url: string; source: BackendSource } {
  const savedUrl = ignoreSaved ? "" : readStoredBackendUrl();
  if (savedUrl) {
    return { url: savedUrl, source: "saved" };
  }

  const envUrl = normalizeBackendUrl(import.meta.env.VITE_API_BASE_URL ?? "");
  if (envUrl) {
    return { url: envUrl, source: "env" };
  }

  if (isLocalhost(window.location.hostname)) {
    return { url: "http://localhost:8000", source: "local" };
  }

  return { url: "", source: "unset" };
}

function getOrCreateUserId(): string {
  try {
    const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY)?.trim();
    if (existing) {
      return existing;
    }

    const nextUserId = window.crypto.randomUUID();
    window.localStorage.setItem(USER_ID_STORAGE_KEY, nextUserId);
    return nextUserId;
  } catch {
    return window.crypto.randomUUID();
  }
}

function getBackendProblem(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "Enter the backend URL.";
  }

  if (/\s/.test(trimmed)) {
    return "Paste the backend URL without spaces or line breaks.";
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Use an http:// or https:// backend URL.";
    }
  } catch {
    return "Enter a valid absolute backend URL.";
  }

  return null;
}

interface AgentPart {
  text?: string;
}

interface SessionResponse {
  id?: string;
}

interface BackendErrorResponse {
  error?: string;
  detail?: string;
}

interface AgentEvent {
  content?: {
    parts?: AgentPart[];
  };
  error?: string;
  finishReason?: string;
}

interface RunSseRequest {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: {
    role: "user";
    parts: Array<{ text: string }>;
  };
  streaming: boolean;
  model: string;
}

interface ModelsResponse {
  models: string[];
  default: string;
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function parseBackendError(bodyText: string): string {
  if (!bodyText.trim()) {
    return "";
  }

  try {
    const payload = JSON.parse(bodyText) as BackendErrorResponse;
    return payload.error?.trim() || payload.detail?.trim() || "";
  } catch {
    return bodyText.trim();
  }
}

function syncDrawerLinks(activePath: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>(".drawer-link[data-path]");

  links.forEach((link) => {
    const isActive = link.dataset.path === activePath;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderEmptySocialPage(): void {
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");

  if (chat instanceof HTMLDivElement) {
    chat.hidden = false;
    chat.innerHTML = `<div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
      <h2>Social</h2>
      <p>Social features and models are coming soon.</p>
    </div>`;
  }

  if (form instanceof HTMLFormElement) {
    form.hidden = true;
  }

  document.title = "Social";
}

function extractEventText(event: AgentEvent | undefined): string {
  const parts = event?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("");
}

function getFriendlyBackendError(status: number, bodyText: string): string {
  const detailedMessage = parseBackendError(bodyText);

  if (status === 400) {
    return detailedMessage || "The backend rejected that request.";
  }

  if (status === 401 || status === 403) {
    return detailedMessage || "The backend refused that request. Check access and CORS settings.";
  }

  if (status === 404) {
    return detailedMessage || "Couldn't find the backend endpoint. Check the backend URL and try again.";
  }

  if (status >= 500) {
    return detailedMessage || "The backend hit an internal error. Please try again in a moment.";
  }

  return detailedMessage || "Couldn't get a response from the backend right now.";
}

function parseSseEvents(bodyText: string): AgentEvent[] {
  const events: AgentEvent[] = [];

  for (const block of bodyText.split(/\n\n+/)) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const payloadText = dataLines.join("\n").trim();
    if (!payloadText || payloadText === "[DONE]") {
      continue;
    }

    try {
      events.push(JSON.parse(payloadText) as AgentEvent);
    } catch {
      // Ignore malformed event chunks.
    }
  }

  return events;
}

async function createSession(backendUrl: string, userId: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(joinUrl(backendUrl, `apps/${encodeURIComponent(APP_NAME)}/users/${encodeURIComponent(userId)}/sessions`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({}),
    });
  } catch {
    throw new Error("Couldn't reach the backend. Check the URL and try again.");
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(getFriendlyBackendError(response.status, bodyText));
  }

  let payload: SessionResponse;

  try {
    payload = JSON.parse(bodyText) as SessionResponse;
  } catch {
    throw new Error("The backend returned an unreadable session response.");
  }

  const sessionId = payload.id?.trim();
  if (!sessionId) {
    throw new Error("The backend did not return a session ID.");
  }

  return sessionId;
}

async function fetchModels(backendUrl: string): Promise<ModelsResponse> {
  try {
    const res = await fetch(joinUrl(backendUrl, "models"), {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) throw new Error();
    return (await res.json()) as ModelsResponse;
  } catch {
    return { models: [], default: "" };
  }
}

async function generateReply(backendUrl: string, userId: string, sessionId: string, text: string, model: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(joinUrl(backendUrl, "run_sse"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        app_name: APP_NAME,
        user_id: userId,
        session_id: sessionId,
        new_message: {
          role: "user",
          parts: [{ text }],
        },
        streaming: false,
        model,
      } satisfies RunSseRequest),
    });
  } catch {
    throw new Error("Couldn't reach the backend. Check the URL and try again.");
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(getFriendlyBackendError(response.status, bodyText));
  }

  const events = parseSseEvents(bodyText);
  const replyText = events
    .map((event) => extractEventText(event))
    .join("")
    .trim();

  if (replyText) {
    return replyText;
  }

  const eventError = events
    .map((event) => event.error?.trim() ?? "")
    .find((message) => message.length > 0);

  if (eventError) {
    throw new Error(eventError);
  }

  throw new Error("The backend returned no answer.");
}

async function renderChatPage(): Promise<void> {
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const btn = document.getElementById("btn");
  const modelSelect = document.getElementById("model-select");

  if (!(chat instanceof HTMLDivElement)) throw new Error("Missing #chat container.");
  if (!(form instanceof HTMLFormElement)) throw new Error("Missing #form element.");
  if (!(input instanceof HTMLInputElement)) throw new Error("Missing #input field.");
  if (!(btn instanceof HTMLButtonElement)) throw new Error("Missing #btn button.");
  if (!(modelSelect instanceof HTMLSelectElement)) throw new Error("Missing #model-select.");

  chat.hidden = false;
  form.hidden = false;
  document.title = APP_NAME;

  const defaultComposerPlaceholder = input.placeholder;
  const userId = getOrCreateUserId();
  const backendUrl = import.meta.env.VITE_API_BASE_URL?.trim() ||
    (isLocalhost(window.location.hostname) ? "http://localhost:8000" : window.location.origin);
  let sessionId = "";
  let isBusy = false;

  // ── In-memory history ──────────────────────────────────────────
  const sentHistory: string[] = [];    // user messages sent this session
  let historyIndex = -1;               // -1 = not navigating
  let historyDraft = "";              // saves typed-but-unsent text
  const answerWrappers: HTMLDivElement[] = []; // agent answer wrappers
  let answerIndex = -1;               // which answer we're viewing

  // ── Answer nav elements ────────────────────────────────────────
  const answerNav    = document.getElementById("answer-nav");
  const ansPrev      = document.getElementById("ans-prev") as HTMLButtonElement | null;
  const ansNext      = document.getElementById("ans-next") as HTMLButtonElement | null;
  const ansCounter   = document.getElementById("ans-counter");

  const refreshAnswerNav = (): void => {
    const count = answerWrappers.length;
    if (!answerNav) return;
    answerNav.hidden = count === 0;
    if (ansCounter) ansCounter.textContent = count === 0 ? "" : `${answerIndex + 1} / ${count}`;
    if (ansPrev)  ansPrev.disabled  = answerIndex <= 0;
    if (ansNext)  ansNext.disabled  = answerIndex >= count - 1;
  };

  const scrollToAnswer = (idx: number): void => {
    if (idx < 0 || idx >= answerWrappers.length) return;
    answerIndex = idx;
    answerWrappers[idx].scrollIntoView({ behavior: "smooth", block: "start" });
    refreshAnswerNav();
  };

  ansPrev?.addEventListener("click", () => scrollToAnswer(answerIndex - 1));
  ansNext?.addEventListener("click", () => scrollToAnswer(answerIndex + 1));

  // --- Populate model selector ---
  const { models, default: defaultModel } = await fetchModels(backendUrl);
  if (models.length > 0) {
    modelSelect.innerHTML = models
      .map((m) => `<option value="${m}"${m === defaultModel ? " selected" : ""}>${m}</option>`)
      .join("");
  } else {
    modelSelect.innerHTML = `<option value="qwen3:8b" selected>qwen3:8b</option>
      <option value="gemma4:latest">gemma4:latest</option>
      <option value="llama3:latest">llama3:latest</option>`;
  }

  const getSelectedModel = (): string => modelSelect.value;

  const addMsg = (text: string, role: string): HTMLDivElement => {
    const isAgent = role.startsWith("agent") && !role.includes("thinking");

    if (isAgent) {
      const wrapper = document.createElement("div");
      wrapper.className = "msg-wrapper";

      const el = document.createElement("div");
      el.className = `msg ${role}`;
      el.textContent = text;

      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.title = "Copy response";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(el.textContent ?? "");
          copyBtn.textContent = "✓ Copied";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "Copy";
            copyBtn.classList.remove("copied");
          }, 2000);
        } catch {
          copyBtn.textContent = "Failed";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        }
      });

      wrapper.appendChild(el);
      wrapper.appendChild(copyBtn);
      chat.appendChild(wrapper);
      chat.scrollTop = chat.scrollHeight;

      // Track for navigation
      answerWrappers.push(wrapper);
      answerIndex = answerWrappers.length - 1;
      refreshAnswerNav();

      return el;
    }

    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  };

  const refreshComposerState = (): void => {
    const disabled = isBusy || !backendUrl;
    btn.disabled = disabled;
    input.disabled = disabled;
    modelSelect.disabled = isBusy;
    input.placeholder = disabled
      ? "Connect a backend to start chatting."
      : defaultComposerPlaceholder;
  };

  const resetChat = (): void => {
    chat.innerHTML = "";
    sessionId = "";
  };

  void resetChat; // suppress unused warning

  const setBusyState = (busy: boolean): void => {
    isBusy = busy;
    refreshComposerState();
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    sessionId = await createSession(backendUrl, userId);
    return sessionId;
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!backendUrl) return;

    // Save to sent history
    sentHistory.push(text);
    historyIndex = -1;
    historyDraft = "";

    const model = getSelectedModel();
    setBusyState(true);
    addMsg(text, "user");
    const thinking = addMsg(`Thinking with ${model}…`, "agent thinking");

    try {
      const currentSessionId = await ensureSession();
      const reply = await generateReply(backendUrl, userId, currentSessionId, text, model);
      thinking.remove();
      addMsg(reply, "agent");
    } catch (error: unknown) {
      thinking.remove();
      const message = error instanceof Error ? error.message : "Couldn't get a response right now.";
      addMsg(message, "agent");
    } finally {
      setBusyState(false);
      input.focus();
    }
  };

  // ── ↑/↓ to browse sent messages ───────────────────────────────
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      if (sentHistory.length === 0) return;
      e.preventDefault();
      if (historyIndex === -1) {
        historyDraft = input.value;          // save unsent draft
        historyIndex = sentHistory.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      input.value = sentHistory[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (e.key === "ArrowDown") {
      if (historyIndex === -1) return;
      e.preventDefault();
      if (historyIndex < sentHistory.length - 1) {
        historyIndex++;
        input.value = sentHistory[historyIndex];
      } else {
        historyIndex = -1;
        input.value = historyDraft;
      }
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !backendUrl) return;
    input.value = "";
    await sendMessage(text);
  });

  refreshComposerState();
}

setupPwa();

const pathname = normalizePathname(window.location.pathname);
const activePath = pathname === "/social" ? "/social" : "/";

syncDrawerLinks(activePath);

if (pathname === "/social") {
  renderEmptySocialPage();
} else {
  renderChatPage().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    const chat = document.getElementById("chat");

    if (chat instanceof HTMLDivElement) {
      const el = document.createElement("div");
      el.className = "msg agent";
      el.textContent = message;
      chat.appendChild(el);
    }
  });
}
