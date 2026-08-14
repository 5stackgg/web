import EventEmitter from "eventemitter3";
import { shallowRef, type ShallowRef } from "vue";
import type { e_match_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export interface LobbyMessage {
  id?: string;
  message: string;
  timestamp: string;
  from?: {
    role?: string;
    name?: string;
    steam_id?: string;
    avatar_url?: string;
    profile_url?: string;
  };
  // Never sent by the server -- the wire format has no room marker, because a
  // room is a subscription and not a property of the text. Stamped on the
  // client where two rooms are merged into one stream and a line has to say
  // which one it went to. See ChatLobby's merged `messages`.
  __channel?: "everyone" | "team";
}

export interface Lobby {
  readonly messages: LobbyMessage[];
  on: (event: string, callback: (data: any) => void) => void;
  leave: () => void;
}

interface LobbyState {
  messages: ShallowRef<LobbyMessage[]>;
  seen: Set<string>;
  instances: Set<string>;
  callbacks: Map<string, (data: any) => void>;
  listeners: ReturnType<typeof Socket.prototype.listen>[];
}

export type ChatType =
  | "match"
  // One side of a match, keyed `${matchId}:${lineupId}`. There is no room for
  // a real team: the API's enum has one, but nothing ever opened it and the
  // join switch has no case for it, so asking would only be refused.
  | "match_team"
  | "matchmaking"
  | "organizers"
  | "tournament"
  | "draft"
  // A 1:1 conversation. The lobby id is the two participants' steam ids
  // sorted ascending and joined with ":" -- see useDirectMessages.
  | "direct";

// The live `chat` event and the history snapshot sent on every (re)join can
// carry the same message, so a message needs an identity the client can compare
// them by. Anything written before the server started stamping an id falls back
// to a composite key.
export function chatMessageKey(message: LobbyMessage) {
  if (message?.id) {
    return message.id;
  }

  return [
    message?.from?.steam_id ?? "",
    message?.timestamp ?? "",
    message?.message ?? "",
  ].join("|");
}

export function chatMessageTime(message: LobbyMessage) {
  return new Date(message?.timestamp).getTime() || 0;
}

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

  private lobbies: Map<string, LobbyState> = new Map();
  private instanceCounter = 0;
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

  // Server-side read state, so a conversation's unread count survives a reload
  // and doesn't come back on another device.
  public markLobbyRead(type: ChatType, id: string) {
    this.event(`lobby:read`, {
      id,
      type,
    });
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

    // Every call gets its own key even when two callers pass the same label:
    // the same lobby is routinely open in more than one widget at once (a match
    // page and the chat sidebar tab for that match), and one of them unmounting
    // must not tear the lobby down under the other.
    const instanceKey = `${instance}#${++this.instanceCounter}`;

    const existing = this.lobbies.get(lobbyId);

    if (existing) {
      existing.instances.add(instanceKey);
      return this.createLobbyHandle(lobbyId, existing, instanceKey, type, _id);
    }

    const lobby: LobbyState = {
      instances: new Set([instanceKey]),
      messages: shallowRef([]),
      seen: new Set(),
      callbacks: new Map(),
      listeners: [],
    };

    this.lobbies.set(lobbyId, lobby);

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:list`, (data) => {
        useMatchLobbyStore().set(lobbyId, data.lobby);
      }),
    );

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:joined`, (data) => {
        useMatchLobbyStore().add(lobbyId, data.user);
      }),
    );

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:left`, (data) => {
        useMatchLobbyStore().remove(lobbyId, data.user);
      }),
    );

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:messages`, (data) => {
        this.mergeLobbyMessages(lobby, data.messages);
      }),
    );

    // Registered once per lobby, never per widget: the message list belongs to
    // the lobby, and widgets only observe it.
    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:chat`, (message: LobbyMessage) => {
        this.addLobbyMessage(lobby, message);
      }),
    );

    this.join(`lobby`, {
      id: _id,
      type,
    });

    return this.createLobbyHandle(lobbyId, lobby, instanceKey, type, _id);
  }

  private mergeLobbyMessages(lobby: LobbyState, messages: LobbyMessage[]) {
    const snapshot = messages || [];
    const snapshotKeys = new Set(snapshot.map(chatMessageKey));

    // The server sends its whole history for the room, so the snapshot replaces
    // what we hold rather than being unioned into it. A union never drops what
    // the server has since expired, and leaves both the list and `seen` growing
    // for the life of the handle.
    //
    // Anything newer than the snapshot is kept: a live message can land in the
    // window between the server building the snapshot and it arriving here.
    const newest = snapshot.reduce(
      (latest, message) => Math.max(latest, chatMessageTime(message)),
      0,
    );

    const merged = snapshot.concat(
      lobby.messages.value.filter((message) => {
        return (
          !snapshotKeys.has(chatMessageKey(message)) &&
          chatMessageTime(message) >= newest
        );
      }),
    );

    merged.sort((a, b) => chatMessageTime(a) - chatMessageTime(b));

    lobby.seen.clear();
    for (const message of merged) {
      lobby.seen.add(chatMessageKey(message));
    }

    lobby.messages.value = merged;
    this.emitToLobbyInstances(lobby, "lobby:messages", merged);
  }

  private addLobbyMessage(lobby: LobbyState, message: LobbyMessage) {
    const key = chatMessageKey(message);
    if (lobby.seen.has(key)) {
      return;
    }
    lobby.seen.add(key);

    const messages = lobby.messages.value.slice();
    const timestamp = chatMessageTime(message);

    let index = messages.length;
    while (index > 0 && chatMessageTime(messages[index - 1]) > timestamp) {
      index--;
    }
    messages.splice(index, 0, message);

    lobby.messages.value = messages;
    this.emitToLobbyInstances(lobby, "lobby:chat", message);
  }

  private emitToLobbyInstances(
    lobby: LobbyState,
    event: string,
    data: unknown,
  ) {
    for (const [key, callback] of lobby.callbacks) {
      if (!key.endsWith(`:${event}`)) {
        continue;
      }

      // One widget blowing up must not cut delivery to the others sharing
      // this lobby.
      try {
        callback(data);
      } catch (error) {
        console.error(`[ws] ${key} failed to handle ${event}`, error);
      }
    }
  }

  private createLobbyHandle(
    lobbyId: string,
    lobby: LobbyState,
    instanceKey: string,
    type: ChatType,
    id: string,
  ): Lobby {
    return {
      get messages() {
        return lobby.messages.value;
      },
      on: (event: string, callback: (data: any) => void) => {
        lobby.callbacks.set(`${instanceKey}:${event}`, callback);
      },
      leave: () => {
        this.leaveLobbyInstance(lobbyId, instanceKey, type, id);
      },
    };
  }

  private leaveLobbyInstance(
    lobbyId: string,
    instanceKey: string,
    type: ChatType,
    id: string,
  ) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return;
    }

    if (!lobby.instances.delete(instanceKey)) {
      return;
    }

    for (const key of lobby.callbacks.keys()) {
      if (key.startsWith(`${instanceKey}:`)) {
        lobby.callbacks.delete(key);
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
  useMatchmakingStore().presenceLoaded = true;
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
