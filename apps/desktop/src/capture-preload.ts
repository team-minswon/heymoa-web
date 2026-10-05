import { contextBridge, ipcRenderer } from "electron";
if (process.isMainFrame) {
  contextBridge.exposeInMainWorld(
    "heymoaCaptureLocal",
    Object.freeze({
      emit: (packet: unknown) =>
        ipcRenderer.send("heymoa:local-capture-packet", packet),
      onAck: (listener: (sequence: number) => void) => {
        ipcRenderer.on("heymoa:local-capture-ack", (_event, sequence: number) =>
          listener(sequence)
        );
      },
    })
  );
}
