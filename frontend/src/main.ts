import "./style.css";
import { setupPwa } from "./pwa";

const APP = import.meta.env.VITE_AGENT_APP_NAME?.trim() || "Agent";
const USER_STORAGE_KEY = "waelio-agent-user-id";

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const envValue = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envValue) {
    return normalizeApiUrl(envValue);
  }

  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  return normalizeApiUrl(origin);
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

const API = resolveApiBaseUrl();
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
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const btn = document.getElementById("btn");

  if (!(chat instanceof HTMLDivElement)) {
    throw new Error("Missing #chat container.");
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

  let sessionId: string | null = null;

  const addMsg = (text: string, role: string): HTMLDivElement => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  };

  const setComposerState = (disabled: boolean): void => {
    btn.disabled = disabled;
    input.disabled = disabled;
  };

  const initSession = async (): Promise<void> => {
    const res = await fetch(`${API}/apps/${APP}/users/${USER}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = (await res.json()) as { id?: string };
    sessionId = data.id ?? null;
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!sessionId) {
      return;
    }

    setComposerState(true);
    addMsg(text, "user");
    const thinking = addMsg("Thinking...", "agent thinking");

    try {
      const res = await fetch(`${API}/run_sse`, {
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
      addMsg(`Failed to reach the agent server at ${API}.`, "agent");
    } finally {
      setComposerState(false);
      input.focus();
    }
  };

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !sessionId) {
      return;
    }

    input.value = "";
    await sendMessage(text);
  });

  try {
    await initSession();
  } catch {
    addMsg(`Failed to connect to ${API}. Check the backend URL and CORS settings.`, "agent");
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
