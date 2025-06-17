import path from "path";
import { app } from "electron";
import { isDev } from "./utils.js";

export function getPreloadPath() {
  if (isDev()) {
    return path.join(app.getAppPath(), "/dist-electron/preload.cjs");
  } else {
    // 打包环境中，使用asar.unpacked路径
    return path.join(app.getAppPath(), "..", "app.asar.unpacked", "dist-electron", "preload.cjs");
  }
}

export function getUIPath() {
  return path.join(app.getAppPath(), "/dist-react/index.html");
}

export function getAssetPath() {
  return path.join(app.getAppPath(), isDev() ? "." : "..", "/src/assets");
}
