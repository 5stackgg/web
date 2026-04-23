import EventEmitter from "eventemitter3";
import type { e_match_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export interface Lobby {
  messages: any[];
  instances: Set<string>;
  callbacks: Record<string, (data: any) => void>;
  listeners: ReturnType<typeof Socket.prototype.listen>[];
  on: (event: string, callback: (data: any) => void) => void;
  leave: () => void;
  setMessages: (data: any[]) => void;
}

export type ChatType =
  | "match"
  | "team"
  | "matchmaking"
  | "organizers"
  | "tournament";

class Socket extends EventEmitter {
  private listening = new Set();
  private connection?: WebSocket;
  private connected = false;
  private heartBeat?: NodeJS.Timeout;
  private rejoinTimers: Map<string, NodeJS.Timeout> = new Map();
  private offlineQueue: Array<{
    event: string;
    data: Record<string, unknown>;
  }> = [];
  private retryCount = 0;
  private static readonly MAX_RETRIES = 50;
  private static readonly BASE_DELAY_MS = 1000;
  private static readonly MAX_DELAY_MS = 30000;

  private lobbies: Map<string, Lobby> = new Map();
  private rooms: Map<
    string,
    {
      room: string;
      data: Record<string, unknown>;
    }
  > = new Map();

  public connect() {
    // Clean up any existing connection before creating a new one
    if (this.connection) {
      try {
        this.connection.onclose = null;
        this.connection.onerror = null;
        this.connection.close();
      } catch {
        // Ignore errors when closing stale connections
      }
      this.connection = undefined;
    }

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
      this.retryCount = 0;

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

      for (const { room, data } of Array.from(this.rooms.values())) {
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

      if (this.retryCount >= Socket.MAX_RETRIES) {
        console.warn(
          `[ws] max reconnection attempts (${Socket.MAX_RETRIES}) reached, giving up`,
        );
        return;
      }

      const delay = Math.min(
        Socket.BASE_DELAY_MS * Math.pow(2, this.retryCount),
        Socket.MAX_DELAY_MS,
      );
      const jitter = Math.random() * 1000;
      this.retryCount++;

      console.info(
        `[ws] reconnecting in ${Math.round(delay + jitter)}ms (attempt ${this.retryCount}/${Socket.MAX_RETRIES})`,
      );

      setTimeout(() => {
        this.connect();
      }, delay + jitter);
    };

    webSocket.onerror = (error) => {
      console.warn("[ws] web socket error", error);
    };
  }

  private getRoomKey(room: string, data: Record<string, unknown>) {
    const type = data.type ? String(data.type) : "";
    const id = data.id ? String(data.id) : "";
    return [room, type, id].filter(Boolean).join(":");
  }

  public join(room: string, data: Record<string, unknown>) {
    const roomKey = this.getRoomKey(room, data);
    console.info(`[ws] joining room ${roomKey}`);

    this.rooms.set(roomKey, { room, data });

    if (!this.connected || !this.connection) {
      return;
    }

    this.event(`${room}:join`, data);

    // Our lobbies expire server-side after 24 hours, so we need to
    // periodically re-join to ensure we stay in the room for long-lived sessions.
    const existingTimer = this.rejoinTimers.get(roomKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const REJOIN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

    const timer = setTimeout(() => {
      if (this.connected && this.connection && this.rooms.has(roomKey)) {
        console.info(`[ws] rejoining room ${roomKey}`);
        this.join(room, data);
      }
    }, REJOIN_INTERVAL_MS);

    this.rejoinTimers.set(roomKey, timer);
  }

  public leave(room: string, type: ChatType, id: string) {
    const roomKey = this.getRoomKey(room, { type, id });
    console.info(`[ws] leaving room ${roomKey}`);

    this.rooms.delete(roomKey);
    this.event(`lobby:leave`, {
      id,
      type,
    });

    const existingTimer = this.rejoinTimers.get(roomKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.rejoinTimers.delete(roomKey);
    }
  }

  public rejoinAll() {
    for (const { room, data } of Array.from(this.rooms.values())) {
      this.join(room, data);
    }
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
    this.on(event, callback);
    this.listening.add(event);

    return {
      stop: () => {
        this.removeListener(event, callback);
        if (this.listenerCount(event) === 0) {
          this.listening.delete(event);
        }
      },
    };
  }

  public joinLobby(instance: string, type: ChatType, _id: string): Lobby {
    const lobbyId = `${type}:${_id}`;
    let lobby = this.lobbies.get(lobbyId);

    if (lobby) {
      lobby.instances.add(instance);
      return this.createLobbyHandle(lobbyId, lobby, instance, type, _id);
    }

    lobby = {
      instances: new Set([instance]),
      messages: [],
      callbacks: {},
      listeners: [],
      on: function (event: string, callback: (data: any) => void) {
        this.callbacks[event] = callback;
      },
      leave: () => {},
      setMessages: function (data: any[]) {
        this.messages = data;
        for (const [key, callback] of Object.entries(this.callbacks)) {
          if (key === "lobby:messages" || key.endsWith(":lobby:messages")) {
            callback(data);
          }
        }
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

    return this.createLobbyHandle(lobbyId, lobby, instance, type, _id);
  }

  private createLobbyHandle(
    lobbyId: string,
    lobby: Lobby,
    instance: string,
    type: ChatType,
    id: string,
  ): Lobby {
    return {
      get messages() {
        return lobby.messages;
      },
      get instances() {
        return lobby.instances;
      },
      callbacks: lobby.callbacks,
      listeners: lobby.listeners,
      on: (event: string, callback: (data: any) => void) => {
        lobby.callbacks[`${instance}:${event}`] = callback;
      },
      leave: () => {
        this.leaveLobbyInstance(lobbyId, instance, type, id);
      },
      setMessages: (data: any[]) => {
        lobby.setMessages(data);
      },
    };
  }

  private leaveLobbyInstance(
    lobbyId: string,
    instance: string,
    type: ChatType,
    id: string,
  ) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return;
    }

    lobby.instances.delete(instance);
    for (const key of Object.keys(lobby.callbacks)) {
      if (key.startsWith(`${instance}:`)) {
        delete lobby.callbacks[key];
      }
    }

    if (lobby.instances.size !== 0) {
      return;
    }

    for (const listener of lobby.listeners) {
      listener?.stop();
    }

    this.lobbies.delete(lobbyId);
    this.leave("lobby", type, id);
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
  toast({
    variant: "destructive",
    title: useNuxtApp().$i18n.t("common.error"),
    description: data.message,
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
