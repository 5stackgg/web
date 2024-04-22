import EventEmitter from "eventemitter3";

class Socket extends EventEmitter {
  private connection?: WebSocket;
  private connected = false;

  private offlineQueue: Array<{
    event: string;
    id: string;
    data: Record<string, unknown>;
  }> = [];

  public connect() {
    const wsHost = `${import.meta.env.VITE_WS_HOST || "wss://ws.5stack.gg"}`;
    console.info(`connecting to ws: ${wsHost}`);
    const webSocket = new WebSocket(wsHost);

    this.connection = webSocket;

    webSocket.addEventListener("message", (message) => {
      const { event, id, data } = JSON.parse(message.data);
      this.emit(event, data);
    });

    webSocket.addEventListener("open", () => {
      this.emit("online");
      this.connected = true;
      console.info("Connected to 5Stack");
      setTimeout(() => {
        for (let i = 0; i < this.offlineQueue.length; i++) {
          const { event, id, data } = this.offlineQueue[i];
          this.event(event, id, data);
          this.offlineQueue.shift();
          i--;
        }
      }, 100);
    });

    webSocket.onclose = (closeEvent) => {
      this.emit("offline");
      this.connected = false;
      console.warn("Lost connection to websocket server", closeEvent);
      setTimeout(() => {
        this.connect();
      }, 1000);
    };

    webSocket.onerror = (error) => {
      console.warn("web socket error", error);
    };
  }

  public event(event: string, data: Record<string, unknown>) {
    if (!this.connected || !this.connection) {
      this.offlineQueue.push({ event, id, data });
    } else {
      this.connection.send(
        JSON.stringify({
          event,
          data,
        })
      );
    }
  }

  public listen(event: string, callback: (data: any) => void) {
    this.on(event, callback);

    return {
      stop: () => {
        this.removeListener(event, callback);
      },
    };
  }
}
const socket = new Socket();

export default socket;
