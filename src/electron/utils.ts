import { ipcMain, WebContents, WebFrameMain } from "electron";
import { pathToFileURL } from "url";
import { getUIPath } from "./pathResolver.js";

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export function ipcMainHandle<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (...args: unknown[]) => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>
) {
  ipcMain.handle(key, (event, ...args) => {
    validateEventFrame(event.senderFrame);
    return handler(...args);
  });
}

export function ipcMainOn<Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (payload: EventPayloadMapping[Key]) => void
) {
  ipcMain.on(key, (event, payload) => {
    validateEventFrame(event.senderFrame);
    return handler(payload);
  });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key]
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain | null) {
  if (frame === null) {
    return;
  }

  console.log("Frame URL:", frame.url);
  
  // 开发环境：允许localhost
  if (isDev() && new URL(frame.url).host === "localhost:5123") {
    return;
  }
  
  // 生产环境：更灵活的文件URL验证
  if (!isDev()) {
    const frameUrl = new URL(frame.url);
    
    // 必须是file协议
    if (frameUrl.protocol !== "file:") {
      throw new Error("Malicious event: Invalid protocol");
    }
    
    // 检查路径是否包含预期的文件名
    if (frameUrl.pathname.endsWith("/index.html") || frameUrl.pathname.endsWith("/dist-react/index.html")) {
      return;
    }
    
    // 如果URL完全匹配预期路径也允许
    const expectedUrl = pathToFileURL(getUIPath()).toString();
    console.log("Expected URL:", expectedUrl);
    if (frame.url === expectedUrl) {
      return;
    }
    
    throw new Error("Malicious event: Invalid frame URL");
  }
  
  // 开发环境的严格检查
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error("Malicious event");
  }
}
