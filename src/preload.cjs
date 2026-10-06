"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("monitor", {
  command: (name, id) => ipcRenderer.invoke("command", name, id),
  subscribe: (callback) =>
    ipcRenderer.on("state", (_event, value) => callback(value)),
});
