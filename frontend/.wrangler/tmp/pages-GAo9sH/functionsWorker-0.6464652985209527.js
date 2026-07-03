var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// apps/[[catchall]].ts
async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");
async function onRequestPost(context) {
  return new Response(JSON.stringify({ id: "serverless-session" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequestPost, "onRequestPost");

// run_sse.ts
var WEB_SEARCH_HINTS = /\b(today|now|current|currently|latest|recent|news|weather|price|score|stock|who is|what is|when did|how much|look up|search|find online|internet|website|online|live|happening|update|waelio\.com|webmd|health|medical|symptom|symptoms|disease|treatment|diagnosis|medicine|drug|drugs|doctor|pain|sleep|diabetes|cancer|allergy|allergies)\b/i;
var SMALL_TALK = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good night)\b/i;
var URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
var ALLOWED_FETCH_HOSTS = ["webmd.com", "waelio.com"];
function needsWebSearch(prompt) {
  const text = prompt.trim();
  if (text.length < 4) return false;
  if (SMALL_TALK.test(text)) return false;
  return WEB_SEARCH_HINTS.test(text) || text.includes("?");
}
__name(needsWebSearch, "needsWebSearch");
function normalizeHost(host) {
  return host.toLowerCase().replace(/^www\./, "");
}
__name(normalizeHost, "normalizeHost");
function isAllowedFetchUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      return false;
    }
    const host = normalizeHost(parsed.hostname);
    return ALLOWED_FETCH_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}
__name(isAllowedFetchUrl, "isAllowedFetchUrl");
function extractUrls(text) {
  return text.match(URL_PATTERN) ?? [];
}
__name(extractUrls, "extractUrls");
function htmlToText(page, limit = 4e3) {
  const cleaned = page.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const text = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, limit);
}
__name(htmlToText, "htmlToText");
async function fetchAllowedUrl(url) {
  if (!isAllowedFetchUrl(url)) {
    return `Fetching is not allowed for ${url}.`;
  }
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const page = await response.text();
    const text = htmlToText(page);
    if (!text) {
      return `Fetched ${url} but no readable text was found.`;
    }
    return `Fetched ${url}:
${text}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return `Failed to fetch ${url}: ${message}`;
  }
}
__name(fetchAllowedUrl, "fetchAllowedUrl");
async function gatherWebContext(prompt) {
  const parts = [];
  const status = [];
  for (const url of extractUrls(prompt)) {
    if (isAllowedFetchUrl(url)) {
      status.push(`*\u{1F310} Fetching:* \`${url}\``);
      parts.push(await fetchAllowedUrl(url));
    }
  }
  if (prompt.toLowerCase().includes("webmd") && !extractUrls(prompt).some((url) => url.includes("webmd.com"))) {
    const webmdUrl = "https://www.webmd.com/";
    status.push(`*\u{1F310} Fetching:* \`${webmdUrl}\``);
    parts.push(await fetchAllowedUrl(webmdUrl));
  }
  if (needsWebSearch(prompt)) {
    status.push(`*\u{1F50D} Searching the web for:* \`${prompt}\``);
    parts.push(await fetchWebContext(prompt));
  }
  return {
    context: parts.join("\n\n"),
    status
  };
}
__name(gatherWebContext, "gatherWebContext");
async function fetchWebContext(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("weather")) {
    const wttrReq = await fetch("https://wttr.in/?format=3", {
      headers: { "User-Agent": "curl/7.68.0" }
    });
    const wttrText = await wttrReq.text();
    return `The current weather is ${wttrText}`;
  }
  const ddgRes = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    body: new URLSearchParams({ q: prompt }).toString()
  });
  const page = await ddgRes.text();
  const links = [...page.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
  const snippets = [...page.matchAll(/class="result__snippet"[^>]*>(.*?)<\/(?:a|td|div)>/gs)];
  if (links.length === 0) {
    return "No web results were found for that query.";
  }
  return links.slice(0, 5).map((match2, index) => {
    const title = match2[2].replace(/<[^>]+>/g, "").trim();
    const href = match2[1];
    const snippet = snippets[index]?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    return snippet ? `${index + 1}. ${title}
${href}
${snippet}` : `${index + 1}. ${title}
${href}`;
  }).join("\n\n");
}
__name(fetchWebContext, "fetchWebContext");
async function onRequestOptions2() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");
async function onRequestPost2(context) {
  const { request, env } = context;
  const data = await request.json();
  const prompt = data.new_message.parts.map((part) => part.text).join("\n");
  const systemPrompt = `You are Waelio's personal AI agent with live internet search.
Wael Wahbeh (Waelio) is a full-stack software engineer.
He builds:
- Agent: A local privacy-first AI assistant using Ollama and FastAPI
- Negotiate: An autonomous AI negotiation engine built as a Cloudflare Worker using Llama 3
- Siteforge: A persistent, automated website rendering engine on Cloudflare Workers
- Waelio Toolkit: A Chrome Extension companion tool

When live web data is provided, use it and do not say you lack internet access.
For medical or health content from WebMD, summarize carefully and remind the user that WebMD is general information only, not medical advice.
CRITICAL INSTRUCTION: Waelio does NOT build cryptocurrency wallets, blockchains, or Web3 projects. Do NOT hallucinate or invent projects. If asked about his projects, ONLY list the ones above.`;
  let searchContext = "";
  let statusMessages = [];
  try {
    const gathered = await gatherWebContext(prompt);
    searchContext = gathered.context;
    statusMessages = gathered.status;
  } catch (error) {
    console.error("Search failed", error);
    searchContext = "Web search failed for this question.";
  }
  const finalPrompt = searchContext ? `${prompt}

[Live web search results]
${searchContext}

Answer using the live web search results above when they are relevant. Do not say you lack internet access.` : prompt;
  const aiResponseStream = await env.AI.run("@cf/google/gemma-7b-it-lora", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: finalPrompt }
    ],
    stream: true
  });
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  context.waitUntil(
    (async () => {
      try {
        for (const status of statusMessages) {
          const statusEvent = {
            content: {
              parts: [{ text: `
${status}

` }]
            }
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(statusEvent)}

`));
        }
        const reader = aiResponseStream.getReader ? aiResponseStream.getReader() : aiResponseStream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  const outEvent = {
                    content: { parts: [{ text: parsed.response }] }
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}

`));
                }
              } catch {
              }
            }
          }
        }
      } catch (err) {
        const outEvent = { error: err.message || "AI Error" };
        await writer.write(encoder.encode(`data: ${JSON.stringify(outEvent)}

`));
      } finally {
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      }
    })()
  );
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequestPost2, "onRequestPost");

// ../.wrangler/tmp/pages-GAo9sH/functionsRoutes-0.07349014887074534.mjs
var routes = [
  {
    routePath: "/apps/:catchall*",
    mountPath: "/apps",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/apps/:catchall*",
    mountPath: "/apps",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/run_sse",
    mountPath: "/",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/run_sse",
    mountPath: "/",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  }
];

// ../../../../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
