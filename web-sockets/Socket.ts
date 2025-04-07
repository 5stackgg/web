import alertStore from "~/stores/AlertStore";
import EventEmitter from "eventemitter3";
import { AlertStatuses } from "~/constants/AlertStatuses";
import type { e_match_types_enum } from "~/generated/zeus";

export interface Lobby {
  messages: any[];
  instances: Set<string>;
  callbacks: Record<string, (data: any) => void>;
  listeners: ReturnType<typeof Socket.prototype.listen>[];
  on: (event: string, callback: (data: any) => void) => void;
  leave: () => void;
  setMessages: (data: any[]) => void;
}

export type ChatType = "match" | "team" | "matchmaking";

class Socket extends EventEmitter {
  private listening = new Set();
  private connection?: WebSocket;
  private connected = false;
  private heartBeat?: NodeJS.Timeout;
  private offlineQueue: Array<{
    event: string;
    data: Record<string, unknown>;
  }> = [];

  private lobbies: Map<string, Lobby> = new Map();

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
    console.info(`[ws] joining room ${room}:${data.type}`);
  }

  public leave(room: string) {
    this.rooms.delete(room);
    this.event(`${room}:leave`, {});
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

  public chat(type: ChatType, id: string, message: string) {
    this.event(`lobby:chat`, {
      id,
      type,
      message,
    });
  }

  public listenChat(type: string, id: string, callback: (data: any) => void) {
    return this.listen(
      `lobby:${type}:${id}:chat`,
      (data: { message: string }) => {
        callback(data);
      },
    );
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

  public joinLobby(instance: string, type: ChatType, _id: string) {
    const lobbyId = `${type}:${_id}`;
    let lobby = this.lobbies.get(lobbyId);

    if (lobby) {
      lobby.instances.add(instance);
      return lobby;
    }

    lobby = {
      instances: new Set([instance]),
      messages: [],
      callbacks: {},
      listeners: [],
      on: function (event: string, callback: (data: any) => void) {
        this.callbacks[event] = callback;
      },
      leave: () => {
        const _lobby = this.lobbies.get(lobbyId);

        _lobby?.instances.delete(instance);

        if (_lobby?.instances.size !== 0) {
          return;
        }

        for (const listener of _lobby.listeners) {
          listener?.stop();
        }

        this.lobbies.delete(lobbyId);
        socket.leave(`lobby`, {
          id: _id,
          type,
        });
      },
      setMessages: function (data: any[]) {
        this.messages = data;
        this.callbacks?.["lobby:messages"]?.(data);
      },
    };

    this.lobbies.set(lobbyId, lobby);

    lobby.listeners.push(
      socket.listen(`lobby:${lobbyId}:list`, (data) => {
        useMatchLobbyStore().set(lobbyId, data.lobby);
      }),
    );

    lobby.listeners.push(
      socket.listen(`lobby:${lobbyId}:joined`, (data) => {
        useMatchLobbyStore().add(lobbyId, data.user);
      }),
    );

    lobby.listeners.push(
      socket.listen(`lobby:${lobbyId}:left`, (data) => {
        useMatchLobbyStore().remove(lobbyId, data.user);
      }),
    );

    lobby.listeners.push(
      socket.listen(`lobby:${lobbyId}:messages`, (data) => {
        lobby.setMessages(data.messages);
      }),
    );

    this.join(`lobby`, {
      id: _id,
      type,
    });

    return lobby;
  }
}
const socket = new Socket();

socket.listen("matchmaking:region-stats", (data) => {
  useMatchmakingStore().regionStats = data;
});

socket.listen("players-online", (onlinePlayerSteamIds) => {
  useMatchmakingStore().onlinePlayerSteamIds = onlinePlayerSteamIds;
});

socket.listen("matchmaking:error", (data: { message: string }) => {
  alertStore().add({
    duration: 5000,
    severity: AlertStatuses.Error,
    title: "Error",
    message: data.message,
  });
});

socket.listen(
  "matchmaking:details",
  (
    data: Array<{
      totalInQueue: number;
      type: e_match_types_enum;
      region: string;
    }>,
  ) => {
    useMatchmakingStore().joinedMatchmakingQueues = data;
  },
);

socket.listen("team-lobby:join", (data) => {});

socket.listen("team-lobby:leave", (data) => {});

socket.listen("team-lobby:chat", (data) => {});

export default socket;
