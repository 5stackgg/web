import EventEmitter from "eventemitter3";
import type { e_match_types_enum } from "~/generated/zeus";

export interface MatchLobby {
  messages: any[];
  components: Set<string>;
  callbacks: Record<string, (data: any) => void>;
  listeners: ReturnType<typeof Socket.prototype.listen>[];
  on: (event: string, callback: (data: any) => void) => void;
  leave: () => void;
  setMessages: (data: any[]) => void;
}

class Socket extends EventEmitter {
  private listening = new Set();
  private connection?: WebSocket;
  private connected = false;
  private heartBeat?: NodeJS.Timeout;
  private offlineQueue: Array<{
    event: string;
    data: Record<string, unknown>;
  }> = [];

  private lobbies: Map<string, MatchLobby> = new Map();

  public connect() {
    const wsHost = `wss://${useRuntimeConfig().public.wsDomain}/web`;
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

      if (!this.connection) {
        return;
      }

      this.connection?.send(
        JSON.stringify({
          event: "ping",
        }),
      );

      this.heartBeat = setInterval(() => {
        this.connection?.send(
          JSON.stringify({
            event: "ping",
          }),
        );
      }, 15 * 1000);

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
        this.connect();
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

  public joinMatchLobby(component: string, matchId: string) {
    let lobby = this.lobbies.get(matchId);
    if (lobby) {
      lobby.components.add(component);
      return this.lobbies.get(matchId);
    }

    lobby = {
      components: new Set([component]),
      messages: [],
      callbacks: {},
      listeners: [],
      on: function (event: string, callback: (data: any) => void) {
        this.callbacks[event] = callback;
      },
      leave: () => {
        const _lobby = this.lobbies.get(matchId);

        _lobby?.components.delete(component);

        if (_lobby?.components.size !== 0) {
          return;
        }

        for (const listener of _lobby.listeners) {
          listener?.stop();
        }

        this.lobbies.delete(matchId);
        socket.leave("lobby", {
          matchId: matchId,
        });
      },
      setMessages: function (data: any[]) {
        this.messages = data;
        this.callbacks?.["lobby:messages"]?.(data);
      },
    };

    this.lobbies.set(matchId, lobby);

    lobby.listeners.push(
      socket.listen("lobby:list", (data) => {
        if (data.matchId == matchId) {
          useMatchLobbyStore().set(matchId, data.lobby);
        }
      }),
    );

    lobby.listeners.push(
      socket.listen("lobby:joined", (data) => {
        if (data.matchId == matchId) {
          useMatchLobbyStore().add(matchId, data.user);
        }
      }),
    );

    lobby.listeners.push(
      socket.listen("lobby:left", (data) => {
        if (data.matchId == matchId) {
          useMatchLobbyStore().remove(matchId, data.user);
        }
      }),
    );

    lobby.listeners.push(
      socket.listen("lobby:messages", (data) => {
        if (data.matchId == matchId) {
          lobby.setMessages(data.messages);
        }
      }),
    );

    this.join("lobby", {
      matchId: matchId,
    });

    return lobby;
  }
}
const socket = new Socket();

socket.listen("match-making:region-stats", (data) => {
  useMatchMakingStore().regionStats = data;
});

socket.listen("players-online", (onlinePlayerSteamIds) => {
  useMatchMakingStore().onlinePlayerSteamIds = onlinePlayerSteamIds;
});

socket.listen(
  "match-making:details",
  (
    data: Array<{
      totalInQueue: number;
      type: e_match_types_enum;
      region: string;
    }>,
  ) => {
    useMatchMakingStore().joinedMatchmakingQueues = data;
  },
);

export default socket;
