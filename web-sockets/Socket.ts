import EventEmitter from "eventemitter3";
import type {
  e_game_server_node_regions_enum,
  e_match_types_enum,
} from "~/generated/zeus";

class Socket extends EventEmitter {
  private listening = new Set();
  private connection?: WebSocket;
  private connected = false;
  private heartBeat?: NodeJS.Timeout;
  private offlineQueue: Array<{
    event: string;
    id: string;
    data: Record<string, unknown>;
  }> = [];

  public connect() {
    const wsHost = `${import.meta.env.VITE_WS_HOST || "wss://ws.5stack.gg"}`;
    console.info(`[ws] connecting to ws: ${wsHost}`);
    const webSocket = new WebSocket(wsHost);

    this.connection = webSocket;

    webSocket.addEventListener("message", (message) => {
      const { event, data } = JSON.parse(message.data);
      this.emit(event, data);
    });

    webSocket.addEventListener("open", () => {
      this.emit("online");
      this.connected = true;

      clearInterval(this.heartBeat);
      this.heartBeat = setInterval(() => {
        this.connection?.send("ping");
      }, 15000);

      console.info("[ws] connected");

      for (const [room, data] of Array.from(this.rooms).values()) {
        this.join(room, data);
      }

      setTimeout(() => {
        for (let i = 0; i < this.offlineQueue.length; i++) {
          const { event, data } = this.offlineQueue[i];
          this.event(event, data);
          this.offlineQueue.shift();
          i--;
        }
      }, 100);
    });

    webSocket.onclose = (closeEvent) => {
      this.emit("offline");
      this.connected = false;
      console.warn("[ws] lost connection to websocket server", closeEvent);
      setTimeout(() => {
        this.connect(true);
      }, 1000);
    };

    webSocket.onerror = (error) => {
      console.warn("[ws] web socket error", error);
    };
  }

  private rooms: Map<string, Record<string, unknown>> = new Map();

  public join(room: string, data: Record<string, unknown>) {
    this.rooms.set(room, data);

    if (!this.connected || !this.connection) {
      return;
    }
    this.event(`${room}:join`, data);
    console.info(`[ws] joining room ${room}`);
  }

  public leave(room: string, data: Record<string, unknown>) {
    this.rooms.delete(room);
    this.event(`${room}:leave`, data);
    console.info(`[ws] leaving room ${room}`);
  }

  public event(event: string, data: Record<string, unknown>) {
    if (!this.connected || !this.connection) {
      this.offlineQueue.push({ event, data });
    } else {
      this.connection.send(
        JSON.stringify({
          event,
          data,
        }),
      );
    }
  }

  public listen(event: string, callback: (data: any) => void) {
    if (this.listening.has(event)) {
      return;
    }

    this.on(event, callback);

    this.listening.add(event);

    return {
      stop: () => {
        this.listening.delete(event);
        this.removeListener(event, callback);
      },
    };
  }
}
const socket = new Socket();

socket.listen("match-making:region-stats", (data) => {
  useMatchMakingStore().regionStats = data;
});

socket.listen(
  "match-making:details",
  (
    data: Array<{
      totalInQueue: number;
      type: e_match_types_enum;
      region: e_game_server_node_regions_enum;
    }>,
  ) => {
    useMatchMakingStore().joinedMatchmakingQueues = data;
  },
);

socket.listen("match-making:match-created", (data) => {
  // Remove the queue from joinedMatchmakingQueues when a match is created
  // joinedMatchmakingQueues.value = joinedMatchmakingQueues.value.filter(queueId => queueId !== data.queueId);
  // this.$router.push(`/matches/${data.matchId}`)
});

export default socket;
