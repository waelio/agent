import "./style.css";
import { setupPwa } from "./pwa";

const APP = import.meta.env.VITE_AGENT_APP_NAME?.trim() || "Agent";
const API_STORAGE_KEY = "waelio-agent-api-base-url";
const USER_STORAGE_KEY = "waelio-agent-user-id";
const FRONTEND_ONLY_AGENT_HOSTS = new Set(["waelio-agent.pages.dev"]);

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getApiBaseUrlProblem(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return "Enter your deployed ADK backend URL.";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full backend URL starting with http:// or https://.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Use an http:// or https:// backend URL.";
  }

  if (FRONTEND_ONLY_AGENT_HOSTS.has(parsed.hostname)) {
    return `${parsed.hostname} is the frontend site, not the ADK backend.`;
  }

  return null;
}

function getEnvApiBaseUrl(): string {
  const envValue = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envValue && !getApiBaseUrlProblem(envValue)) {
    return normalizeApiUrl(envValue);
  }

  return "";
}

function readStoredApiBaseUrl(): string {
  try {
    const storedValue = window.localStorage.getItem(API_STORAGE_KEY)?.trim();
    if (!storedValue) {
      return "";
    }

    if (getApiBaseUrlProblem(storedValue)) {
      window.localStorage.removeItem(API_STORAGE_KEY);
      return "";
    }

    return normalizeApiUrl(storedValue);
  } catch {
    return "";
  }
}

function writeStoredApiBaseUrl(url: string): void {
  try {
    if (url) {
      window.localStorage.setItem(API_STORAGE_KEY, url);
    } else {
      window.localStorage.removeItem(API_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function getDefaultApiBaseUrl(): string {
  const envValue = getEnvApiBaseUrl();
  if (envValue) {
    return envValue;
  }

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  return "";
}

function resolveApiBaseUrl(): string {
  return readStoredApiBaseUrl() || getDefaultApiBaseUrl();
}

function createFallbackUserId(): string {
  return `guest-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserId(): string {
  try {
    const existing = window.localStorage.getItem(USER_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const next = window.crypto?.randomUUID?.() ?? createFallbackUserId();
    window.localStorage.setItem(USER_STORAGE_KEY, next);
    return next;
  } catch {
    return createFallbackUserId();
  }
}

let apiBaseUrl = resolveApiBaseUrl();
const USER = getUserId();

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

async function renderChatPage(): Promise<void> {
  const chat = document.getElementById("chat");
  const backendForm = document.getElementById("backend-form");
  const backendUrlInput = document.getElementById("backend-url");
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

  if (!(backendUrlInput instanceof HTMLInputElement)) {
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
  document.title = "AI Researcher";

  const defaultComposerPlaceholder = input.placeholder;
  let sessionId: string | null = null;
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
    const disabled = isBusy || !apiBaseUrl || !sessionId;
    btn.disabled = disabled;
    input.disabled = disabled;
    input.placeholder = disabled
      ? "Set a working backend URL to start chatting."
      : defaultComposerPlaceholder;
  };

  const resetChat = (): void => {
    chat.innerHTML = "";
  };

  const syncBackendUi = (): void => {
    backendUrlInput.value = apiBaseUrl;

    if (apiBaseUrl) {
      setBackendStatus(`Using ${apiBaseUrl}`, sessionId ? "success" : "idle");
      return;
    }

    setBackendStatus("Set your deployed ADK backend URL to connect this app.");
  };

  const setBusyState = (busy: boolean): void => {
    isBusy = busy;
    backendSaveButton.disabled = busy;
    backendResetButton.disabled = busy;
    refreshComposerState();
  };

  const initSession = async (): Promise<void> => {
    const res = await fetch(`${apiBaseUrl}/apps/${APP}/users/${USER}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error(`Session request failed with ${res.status}.`);
    }

    const data = (await res.json()) as { id?: string };
    sessionId = data.id ?? null;

    if (!sessionId) {
      throw new Error("Missing session id.");
    }
  };

  const connectToBackend = async (showSuccessMessage = false): Promise<boolean> => {
    sessionId = null;
    refreshComposerState();

    if (!apiBaseUrl) {
      setBackendStatus("Set your deployed ADK backend URL to connect this app.", "error");
      addMsg("Set your deployed ADK backend URL in the sidebar to connect this frontend.", "agent");
      return false;
    }

    setBackendStatus(`Connecting to ${apiBaseUrl}…`);

    try {
      await initSession();
      setBackendStatus(`Connected to ${apiBaseUrl}`, "success");

      if (showSuccessMessage) {
        addMsg(`Connected to ${apiBaseUrl}.`, "agent");
      }

      refreshComposerState();
      return true;
    } catch {
      setBackendStatus(`Failed to connect to ${apiBaseUrl}. Check CORS and whether the API is running.`, "error");
      addMsg(`Failed to connect to ${apiBaseUrl}. Check the backend URL and CORS settings.`, "agent");
      refreshComposerState();
      return false;
    }
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!sessionId) {
      return;
    }

    setBusyState(true);
    addMsg(text, "user");
    const thinking = addMsg("Thinking...", "agent thinking");

    try {
      const res = await fetch(`${apiBaseUrl}/run_sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: APP,
          user_id: USER,
          session_id: sessionId,
          new_message: { role: "user", parts: [{ text }] },
          streaming: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Agent request failed with ${res.status}.`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Missing response body.");
      }

      const decoder = new TextDecoder();
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) {
            continue;
          }

          try {
            const event = JSON.parse(line.slice(5).trim()) as {
              content?: {
                parts?: Array<{ text?: string }>;
              };
            };
            const part = event.content?.parts?.[0]?.text;
            if (part) {
              reply += part;
            }
          } catch {
            // Ignore incomplete SSE chunks until the next frame arrives.
          }
        }
      }

      thinking.remove();
      if (reply) {
        addMsg(reply, "agent");
      }
    } catch {
      thinking.remove();
      addMsg(`Failed to reach the agent server at ${apiBaseUrl}.`, "agent");
    } finally {
      setBusyState(false);
      input.focus();
    }
  };

  backendForm.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();

    const nextValue = backendUrlInput.value.trim();
    const problem = getApiBaseUrlProblem(nextValue);

    if (problem) {
      setBackendStatus(problem, "error");
      backendUrlInput.focus();
      return;
    }

    apiBaseUrl = normalizeApiUrl(nextValue);
    writeStoredApiBaseUrl(apiBaseUrl);
    resetChat();
    setBusyState(true);

    try {
      await connectToBackend(true);
    } finally {
      setBusyState(false);
      syncBackendUi();
      if (!input.disabled) {
        input.focus();
      }
    }
  });

  backendResetButton.addEventListener("click", async () => {
    writeStoredApiBaseUrl("");
    apiBaseUrl = getDefaultApiBaseUrl();
    sessionId = null;
    resetChat();
    syncBackendUi();

    if (!apiBaseUrl) {
      refreshComposerState();
      addMsg("Backend URL cleared. Enter your deployed ADK backend URL to reconnect.", "agent");
      return;
    }

    setBusyState(true);
    try {
      await connectToBackend(true);
    } finally {
      setBusyState(false);
      syncBackendUi();
      if (!input.disabled) {
        input.focus();
      }
    }
  });

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !sessionId) {
      return;
    }

    input.value = "";
    await sendMessage(text);
  });

  syncBackendUi();
  refreshComposerState();

  if (!apiBaseUrl) {
    addMsg("Set your deployed ADK backend URL in the sidebar to connect this frontend.", "agent");
    return;
  }

  setBusyState(true);
  try {
    await connectToBackend();
  } finally {
    setBusyState(false);
    syncBackendUi();
  }
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
