import {validateCdpListeners,validateCdpTarget,readCdpListeners} from './release-clean-cdp.mjs';
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { localApp, localApi, workspace, assertLocalUrl } from "./release-clean-environment.mjs";

export async function checkpointBrowser({ appOrigin = localApp } = {}) {
  assertLocalUrl(appOrigin, [localApp, localApp]);
  const executable = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  if (!executable)
    throw new Error("No installed browser available for the integration checkpoint.");
  const profile = resolve(workspace, ".tmp", `checkpoint-browser-${randomUUID()}`);
  mkdirSync(profile, { recursive: true });
  writeFileSync(resolve(workspace,".tmp/f2-c/browser-profile.json"),JSON.stringify({profile,retained:true},null,2));
  const port = 9447;
  validateCdpListeners(readCdpListeners(),null);
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-extensions",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let ws;
  let launchError;child.once('error',error=>{launchError=error;});
  try {
  let targets;
  for (let i = 0; i < 60; i++) {
    if(launchError||child.exitCode!==null)throw new Error('F2C browser launch failed');
    const owned=validateCdpListeners(readCdpListeners(),child.pid);
    if(!owned){await new Promise(resolve=>setTimeout(resolve,250));continue;}
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`,{redirect:'error',signal:AbortSignal.timeout(2000)})).json();
      if (targets.some((item) => item.type === "page")) break;
    } catch {
      /* browser starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const target = targets?.find((item) => item.type === "page");
  if (!target) {
    child.kill();
    throw new Error("Local headless browser did not start.");
  }
  let socketUrl;try{if(!validateCdpListeners(readCdpListeners(),child.pid))throw new Error('F2C CDP listener absent');socketUrl=validateCdpTarget(target.webSocketDebuggerUrl);}catch(e){child.kill();throw e;}
  ws = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let serial = 0;
  const pending = new Map();
  const violations = [];
  const failures = [];
  const requestDestinations = new Set();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Browser protocol timeout: ${method}`));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (task) {
        pending.delete(message.id);
        clearTimeout(task.timer);
        if (message.error) task.reject(new Error(message.error.message));
        else task.resolve(message.result);
      }
      return;
    }
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      try {
        const url = assertLocalUrl(request.url, [appOrigin, localApi]);
        requestDestinations.add(url.origin);
        void send("Fetch.continueRequest", { requestId }).catch(() => {});
      } catch {
        violations.push("blocked external request");
        void send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(
          () => {},
        );
      }
    }
    if (message.method === "Runtime.exceptionThrown")
      failures.push(message.params.exceptionDetails.text);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed; details suppressed.");
    return result.result.value;
  }
  return {
    async cookies(entries) {
      await send("Network.setCookies", {
        cookies: entries.map(({ name, value }) => ({ name, value, url: appOrigin, path: "/" })),
      });
    },
    async navigate(path) {
      const url = new URL(path, appOrigin);
      assertLocalUrl(url, [appOrigin]);
      await send("Page.navigate", { url: url.href });
    },
    evaluate,
    async key(key, code = key, options = {}) {
      const text =
        key === "Enter"
          ? "\r"
          : key.length === 1 && !((options.modifiers ?? 0) & 7)
            ? key
            : undefined;
      await send("Input.dispatchKeyEvent", {
        type: text ? "keyDown" : "rawKeyDown",
        key,
        code,
        ...(text ? { text, unmodifiedText: text } : {}),
        ...options,
      });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, ...options });
    },
    async insertText(text) {
      await send("Input.insertText", { text });
    },
    async pointerClick(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },
    async waitText(expected) {
      for (let i = 0; i < 120; i++) {
        try {
          if (
            await evaluate(
              `document.body?.innerText?.includes(${JSON.stringify(expected)}) ?? false`,
            )
          )
            return;
        } catch (error) {
          if (
            !/context.*destroyed|Cannot find context|Cannot find default execution context/i.test(
              error.message,
            )
          )
            throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error(`Browser did not show expected state: ${expected}`);
    },
    async viewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: true,
      });
    },
    async screenshot(name) {
      const { data } = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(resolve(workspace, ".tmp", name), Buffer.from(data, "base64"));
    },
    proof() {
      return {
        allowedOrigins: [...requestDestinations],
        blockedRequests: violations.length,
        runtimeErrors: failures.length,
      };
    },
    async initScript(source) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source });
    },
    async close() {
      try {
        await send("Browser.close");
      } catch {
        /* closed */
      }
      ws.close();
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (
        !profile.startsWith(resolve(workspace, ".tmp") + "\\") &&
        !profile.startsWith(resolve(workspace, ".tmp") + "/")
      )
        throw new Error("Browser cleanup path escaped workspace");
      // F2-C retains the synthetic browser profile; no automatic cleanup.
    },
  };
  } catch(error) {
    try {ws?.close();} catch { /* no connection was established */ }
    child.kill();
    throw error;
  }
}
