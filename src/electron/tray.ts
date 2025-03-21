import { app, BrowserWindow, Menu } from "electron";
import { Tray } from "electron/main";
import path from "path";
import { getAssetPath } from "./pathResolver.js";

export function createTray(mainWindow: BrowserWindow) {
  const tray = new Tray(
    path.join(
      getAssetPath(),
      process.platform === "darwin"
        ? "trayIconDarkTemplate@2x.png"
        : "trayIconDark@2x.png"
    )
  );

  tray.addListener("click", () => {
    mainWindow.show();
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open",
        click: () => {
          mainWindow.show();
          if (app.dock) {
            app.dock.show();
          }
        },
      },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}
