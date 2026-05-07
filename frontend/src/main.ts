import "./style.css";
import { setupPwa } from "./pwa";

const APP_NAME = import.meta.env.VITE_AGENT_APP_NAME?.trim() || "Agent";
const API_KEY_STORAGE_KEY = "waelio-agent-gemini-api-key";
const MODEL_NAME = "gemini-2.5-flash";
const SYSTEM_INSTRUCTION = "You help users research topics thoroughly.";

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

function readStoredApiKey(): string {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeStoredApiKey(apiKey: string): void {
  try {
    if (apiKey) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function getApiKeyProblem(apiKey: string): string | null {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return "Enter your Google AI Studio API key.";
  }

  if (/\s/.test(trimmed)) {
    return "Paste the API key without spaces or line breaks.";
  }

  return null;
}

interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
  groundingMetadata?: {
    groundingChunks?: GeminiGroundingChunk[];
  };
}

interface GeminiApiErrorResponse {
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
}

interface GeminiResponse extends GeminiApiErrorResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
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

function extractText(candidate: GeminiCandidate | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
}

function appendSources(text: string, candidate: GeminiCandidate | undefined): string {
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: Array<{ title: string; uri: string }> = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) {
      continue;
    }

    seen.add(uri);
    sources.push({ title: chunk.web?.title?.trim() || uri, uri });

    if (sources.length >= 6) {
      break;
    }
  }

  if (sources.length === 0) {
    return text;
  }

  const suffix = sources
    .map((source, index) => `${index + 1}. ${source.title} — ${source.uri}`)
    .join("\n");

  return `${text}\n\nSources:\n${suffix}`;
}

function getFriendlyGeminiError(status: number, bodyText: string): string {
  let payload: GeminiApiErrorResponse | undefined;

  try {
    payload = JSON.parse(bodyText) as GeminiApiErrorResponse;
  } catch {
    payload = undefined;
  }

  const detailedMessage = payload?.error?.message?.trim() ?? "";
  const normalizedMessage = `${payload?.error?.status ?? ""} ${detailedMessage}`.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    normalizedMessage.includes("api key") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("unauth")
  ) {
    return "That API key didn't work. Check it and try again.";
  }

  if (
    normalizedMessage.includes("quota") ||
    normalizedMessage.includes("billing") ||
    normalizedMessage.includes("rate") ||
    normalizedMessage.includes("resource exhausted")
  ) {
    return "That API key hit a quota or billing limit. Try again later or use a different key.";
  }

  if (status >= 500) {
    return "Google AI is unavailable right now. Please try again in a moment.";
  }

  if (detailedMessage) {
    return detailedMessage;
  }

  return "Couldn't get a response from Google AI right now.";
}

async function generateReply(apiKey: string, contents: GeminiContent[]): Promise<{ modelText: string; displayText: string }> {
  const endpoint = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`);
  endpoint.searchParams.set("key", apiKey);

  let response: Response;

  try {
    response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "text/plain",
        },
      }),
    });
  } catch {
    throw new Error("Couldn't reach Google AI right now. Check your internet connection and try again.");
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(getFriendlyGeminiError(response.status, bodyText));
  }

  let payload: GeminiResponse;

  try {
    payload = JSON.parse(bodyText) as GeminiResponse;
  } catch {
    throw new Error("Google AI returned an unreadable response.");
  }

  const candidate = payload.candidates?.[0];
  const modelText = extractText(candidate);

  if (modelText) {
    return {
      modelText,
      displayText: appendSources(modelText, candidate),
    };
  }

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Google AI blocked that prompt (${payload.promptFeedback.blockReason}).`);
  }

  if (candidate?.finishReason) {
    throw new Error(`Google AI stopped early (${candidate.finishReason}).`);
  }

  throw new Error("Google AI returned no answer.");
}

async function renderChatPage(): Promise<void> {
  const chat = document.getElementById("chat");
  const keyForm = document.getElementById("backend-form");
  const keyInput = document.getElementById("backend-url");
  const keySaveButton = document.getElementById("backend-save");
  const keyResetButton = document.getElementById("backend-reset");
  const keyStatus = document.getElementById("backend-status");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const btn = document.getElementById("btn");

  if (!(chat instanceof HTMLDivElement)) {
    throw new Error("Missing #chat container.");
  }

  if (!(keyForm instanceof HTMLFormElement)) {
    throw new Error("Missing #backend-form element.");
  }

  if (!(keyInput instanceof HTMLInputElement)) {
    throw new Error("Missing #backend-url field.");
  }

  if (!(keySaveButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #backend-save button.");
  }

  if (!(keyResetButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #backend-reset button.");
  }

  if (!(keyStatus instanceof HTMLParagraphElement)) {
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
  const conversationHistory: GeminiContent[] = [];
  let apiKey = readStoredApiKey();
  let isBusy = false;

  const addMsg = (text: string, role: string): HTMLDivElement => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  };

  const setKeyStatus = (message: string, state: "idle" | "success" | "error" = "idle"): void => {
    keyStatus.textContent = message;
    keyStatus.dataset.state = state;
  };

  const refreshComposerState = (): void => {
    const disabled = isBusy || !apiKey;
    btn.disabled = disabled;
    input.disabled = disabled;
    input.placeholder = disabled
      ? "Save your API key to start chatting."
      : defaultComposerPlaceholder;
  };

  const resetChat = (): void => {
    chat.innerHTML = "";
    conversationHistory.length = 0;
  };

  const syncKeyUi = (): void => {
    keyInput.value = "";

    if (apiKey) {
      setKeyStatus("Saved API key ready.", "success");
      return;
    }

    setKeyStatus("No server URL needed. Enter your Google AI Studio API key to start chatting.");
  };

  const setBusyState = (busy: boolean): void => {
    isBusy = busy;
    keySaveButton.disabled = busy;
    keyResetButton.disabled = busy;
    refreshComposerState();
  };

  const sendMessage = async (text: string): Promise<void> => {
    if (!apiKey) {
      return;
    }

    setBusyState(true);
    addMsg(text, "user");
    const thinking = addMsg("Thinking...", "agent thinking");

    try {
      const nextContents: GeminiContent[] = [
        ...conversationHistory,
        { role: "user", parts: [{ text }] },
      ];

      const { modelText, displayText } = await generateReply(apiKey, nextContents);

      conversationHistory.push({ role: "user", parts: [{ text }] });
      conversationHistory.push({ role: "model", parts: [{ text: modelText }] });

      thinking.remove();
      addMsg(displayText, "agent");
      syncKeyUi();
    } catch (error: unknown) {
      thinking.remove();
      const message = error instanceof Error ? error.message : "Couldn't get a response right now.";
      setKeyStatus(message, "error");
      addMsg(message, "agent");
    } finally {
      setBusyState(false);
      input.focus();
    }
  };

  keyForm.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();

    const nextValue = keyInput.value.trim();
    const problem = getApiKeyProblem(nextValue);

    if (problem) {
      setKeyStatus(problem, "error");
      keyInput.focus();
      return;
    }

    apiKey = nextValue;
    writeStoredApiKey(apiKey);
    resetChat();

    syncKeyUi();
    refreshComposerState();
    addMsg("API key saved in this browser. Ask anything to begin.", "agent");

    if (!input.disabled) {
      input.focus();
    }
  });

  keyResetButton.addEventListener("click", () => {
    writeStoredApiKey("");
    apiKey = "";
    resetChat();

    syncKeyUi();
    refreshComposerState();
    addMsg("API key cleared. Enter a new key to continue.", "agent");
    keyInput.focus();
  });

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !apiKey) {
      return;
    }

    input.value = "";
    await sendMessage(text);
  });

  syncKeyUi();
  refreshComposerState();

  if (!apiKey) {
    addMsg("No server URL needed. Enter your Google AI Studio API key above, or create one with the link in the sidebar.", "agent");
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
