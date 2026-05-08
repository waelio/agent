import "./style.css";
import { setupPwa } from "./pwa";

const APP_NAME = import.meta.env.VITE_AGENT_APP_NAME?.trim() || "Agent";
const BACKEND_URL_STORAGE_KEY = "waelio-agent-backend-url";
const USER_ID_STORAGE_KEY = "waelio-agent-user-id";

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

interface AdkPart {
  text?: string;
}

interface SessionResponse {
  id?: string;
}

interface BackendErrorResponse {
  error?: string;
  detail?: string;
}

interface AdkEvent {
  content?: {
    parts?: AdkPart[];
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
    chat.hidden = true;
  }

  if (form instanceof HTMLFormElement) {
    form.hidden = true;
  }

  document.title = "Social";
}

function extractEventText(event: AdkEvent | undefined): string {
  const parts = event?.content?.parts ?? [];
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
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

function parseSseEvents(bodyText: string): AdkEvent[] {
  const events: AdkEvent[] = [];

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
      events.push(JSON.parse(payloadText) as AdkEvent);
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

async function generateReply(backendUrl: string, userId: string, sessionId: string, text: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(joinUrl(backendUrl, "run_sse"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    .filter((message) => message.length > 0)
    .join("\n\n")
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
  const backendForm = document.getElementById("backend-form");
  const backendInput = document.getElementById("backend-url");
  const backendSaveButton = document.getElementById("backend-save");
  const backendResetButton = document.getElementById("backend-reset");
  const backendStatus = document.getElementById("backend-status");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const btn = document.getElementById("btn");

  if (!(chat instanceof HTMLDivElement)) {
    throw new Error("Missing #chat container.");
  }

  if (!(backendForm instanceof HTMLFormElement)) {
    throw new Error("Missing #backend-form element.");
  }

  if (!(backendInput instanceof HTMLInputElement)) {
    throw new Error("Missing #backend-url field.");
  }

  if (!(backendSaveButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #backend-save button.");
  }

  if (!(backendResetButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #backend-reset button.");
  }

  if (!(backendStatus instanceof HTMLParagraphElement)) {
    throw new Error("Missing #backend-status element.");
  }

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Missing #form element.");
  }

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Missing #input field.");
  }

  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Missing #btn button.");
  }

  chat.hidden = false;
  form.hidden = false;
  document.title = APP_NAME === "Agent" ? "AI Researcher" : APP_NAME;

  const defaultComposerPlaceholder = input.placeholder;
  const userId = getOrCreateUserId();
  const initialBackend = getConfiguredBackend();
  let backendUrl = initialBackend.url;
  let backendSource = initialBackend.source;
  let sessionId = "";
  let isBusy = false;

  const addMsg = (text: string, role: string): HTMLDivElement => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  };

  const setBackendStatus = (message: string, state: "idle" | "success" | "error" = "idle"): void => {
    backendStatus.textContent = message;
    backendStatus.dataset.state = state;
  };

  const refreshComposerState = (): void => {
    const disabled = isBusy || !backendUrl;
    btn.disabled = disabled;
    input.disabled = disabled;
    input.placeholder = disabled
      ? "Connect a backend to start chatting."
      : defaultComposerPlaceholder;
  };

  const resetChat = (): void => {
    chat.innerHTML = "";
    sessionId = "";
  };

  const syncBackendUi = (): void => {
    backendInput.value = backendUrl;

    if (backendSource === "saved" && backendUrl) {
      setBackendStatus("Saved backend URL ready.", "success");
      return;
    }

    if (backendSource === "env" && backendUrl) {
      setBackendStatus("Using the configured backend URL.");
      return;
    }

    if (backendSource === "local" && backendUrl) {
      setBackendStatus("Using the local backend at http://localhost:8000.");
      return;
    }

    setBackendStatus("Enter a backend URL to start chatting.");
  };

  const setBusyState = (busy: boolean): void => {
    isBusy = busy;
    backendSaveButton.disabled = busy;
    backendResetButton.disabled = busy;
    refreshComposerState();
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) {
      return sessionId;
    }

    sessionId = await createSession(backendUrl, userId);
    return sessionId;
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!backendUrl) {
      return;
    }

    setBusyState(true);
    addMsg(text, "user");
    const thinking = addMsg("Thinking...", "agent thinking");

    try {
      const currentSessionId = await ensureSession();
      const reply = await generateReply(backendUrl, userId, currentSessionId, text);

      thinking.remove();
      addMsg(reply, "agent");
      syncBackendUi();
    } catch (error: unknown) {
      thinking.remove();
      const message = error instanceof Error ? error.message : "Couldn't get a response right now.";
      setBackendStatus(message, "error");
      addMsg(message, "agent");
    } finally {
      setBusyState(false);
      input.focus();
    }
  };

  backendForm.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();

    const nextValue = backendInput.value.trim();
    const problem = getBackendProblem(nextValue);

    if (problem) {
      setBackendStatus(problem, "error");
      backendInput.focus();
      return;
    }

    backendUrl = normalizeBackendUrl(nextValue);
    backendSource = "saved";
    writeStoredBackendUrl(backendUrl);
    resetChat();

    syncBackendUi();
    refreshComposerState();
    addMsg("Backend saved in this browser. Ask anything to begin.", "agent");

    if (!input.disabled) {
      input.focus();
    }
  });

  backendResetButton.addEventListener("click", () => {
    writeStoredBackendUrl("");
    const nextBackend = getConfiguredBackend(true);
    backendUrl = nextBackend.url;
    backendSource = nextBackend.source;
    resetChat();

    syncBackendUi();
    refreshComposerState();
    addMsg(
      backendUrl
        ? "Saved backend override cleared. Using the default backend again."
        : "Backend cleared. Enter a backend URL to continue.",
      "agent",
    );
    backendInput.focus();
  });

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !backendUrl) {
      return;
    }

    input.value = "";
    await sendMessage(text);
  });

  syncBackendUi();
  refreshComposerState();

  if (!backendUrl) {
    addMsg(
      "Enter a backend URL above to start chatting. You can point this app at a local ADK API server or the included Cloudflare Worker backend.",
      "agent",
    );
    return;
  }

  if (backendSource === "saved") {
    addMsg(`Connected to ${backendUrl}. Ask anything to begin.`, "agent");
    return;
  }

  if (backendSource === "env") {
    addMsg(`Using the configured backend at ${backendUrl}. Ask anything to begin.`, "agent");
    return;
  }

  addMsg(`Using the local backend at ${backendUrl}. Ask anything to begin.`, "agent");
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
