#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.error('[Github MCP Wrapper] Starting wrapper...');

let token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

// 1. Try to read from .env in the Agent or builder directory
if (!token || token === '<YOUR_TOKEN>') {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env'),
    '/Users/waelio/Code/GitHub/waelio/Agent/.env'
  ];
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/GITHUB_PERSONAL_ACCESS_TOKEN=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          token = match[1];
          console.error(`[Github MCP Wrapper] Found token in .env at: ${envPath}`);
          break;
        }
      }
    } catch (e) {
      console.error(`[Github MCP Wrapper] Error reading .env at ${envPath}:`, e.message);
    }
  }
}

// 2. Try gh auth token
if (!token || token === '<YOUR_TOKEN>') {
  const ghPaths = [
    '/usr/local/bin/gh',
    '/opt/homebrew/bin/gh',
    'gh'
  ];
  for (const ghPath of ghPaths) {
    try {
      const result = execSync(`"${ghPath}" auth token`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (result) {
        token = result;
        console.error(`[Github MCP Wrapper] Successfully retrieved token from gh CLI: ${ghPath}`);
        break;
      }
    } catch (e) {
      // ignore and try next path
    }
  }
}

// 3. Try git config
if (!token || token === '<YOUR_TOKEN>') {
  try {
    const result = execSync('git config --get github.token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (result) {
      token = result;
      console.error('[Github MCP Wrapper] Found token in git config github.token');
    }
  } catch (e) {
    // ignore
  }
}

// 4. Fallback/Warn if still empty
if (!token || token === '<YOUR_TOKEN>') {
  console.error('[Github MCP Wrapper] WARNING: No github token found! GitHub MCP server might fail or operate in read-only mode.');
} else {
  // Mask token in logs for security
  const masked = token.substring(0, 8) + '...' + token.substring(token.length - 4);
  console.error(`[Github MCP Wrapper] Using GITHUB_PERSONAL_ACCESS_TOKEN: ${masked}`);
}

const env = {
  ...process.env,
  GITHUB_PERSONAL_ACCESS_TOKEN: token
};

// Find npx path dynamically based on process.execPath (Node path)
let npxCmd = 'npx';
const nodeBinDir = path.dirname(process.execPath);
const localNpx = path.join(nodeBinDir, 'npx');
if (fs.existsSync(localNpx)) {
  npxCmd = localNpx;
  console.error(`[Github MCP Wrapper] Spawning npx from: ${npxCmd}`);
}

// Spawn server-github
const child = spawn(npxCmd, ['-y', '@modelcontextprotocol/server-github'], {
  stdio: 'inherit',
  env: env
});

child.on('exit', (code, signal) => {
  console.error(`[Github MCP Wrapper] GitHub MCP Server exited with code ${code} and signal ${signal}`);
  process.exit(code !== null ? code : 1);
});
