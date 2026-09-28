import EventEmitter from "eventemitter3";
import { shallowRef, type ShallowRef } from "vue";
import type { e_match_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import { useChatReadState } from "~/composables/useChatReadState";
import {
  toastChatError,
  type ChatAction,
  type ChatError,
} from "~/utilities/chatErrors";
import {
  applyChatMessageEdit,
  chatMessageKey,
  insertChatMessage,
  isChatMessageDeleted,
  mergeChatSnapshot,
  removeChatMessage,
  type ChatMessageEdit,
  type RemovedChatMessage,
} from "~/utilities/chatLobbyMessages";
import guid from "~/utilities/uuid";

export { chatMessageKey, chatMessageTime } from "~/utilities/chatLobbyMessages";

export interface LobbyMessage {
  id?: string;
  message: string;
  timestamp: string;
  source?: "web" | "game";
  edited_at?: string;
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

export type LobbyMessageDeleted = Omit<RemovedChatMessage, "messages">;

interface LobbyState {
  messages: ShallowRef<LobbyMessage[]>;
  seen: Set<string>;
  // Ids the room has deleted. A history snapshot built before the delete can
  // still arrive after it, and must not bring the message back.
  deleted: Set<string>;
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

interface ChatAck {
  requestId?: string;
  messageId?: string;
  action?: ChatAction;
}

interface PendingChatRequest {
  action: ChatAction;
  resolve: () => void;
  reject: (error: ChatError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Socket extends EventEmitter {
  private listening = new Set();
  private connection?: WebSocket;
  private connected = false;
  private heartBeat?: NodeJS.Timeout;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private resumeCheck?: ReturnType<typeof setTimeout>;
  private lifecycleBound = false;
  private pongSeen = false;
  private lastPongAt = 0;
  private unansweredPingAt?: number;
  private rejoinTimers: Map<string, NodeJS.Timeout> = new Map();
  private offlineQueue: Array<{
    event: string;
    data: Record<string, unknown>;
  }> = [];
  private retryCount = 0;
  private presence: { visible: boolean; focus: string | null } = {
    visible: false,
    focus: null,
  };
  private static readonly MAX_RETRIES = 50;
  private static readonly BASE_DELAY_MS = 1000;
  private static readonly MAX_DELAY_MS = 30000;
  private static readonly PONG_TIMEOUT_MS = 45_000;
  private static readonly PONG_GRACE_MS = 10_000;

  private lobbies: Map<string, LobbyState> = new Map();
  private instanceCounter = 0;
  private pendingRequests: Map<string, PendingChatRequest> = new Map();
  // The api answers a request it failed to carry out with nothing at all.
  private static readonly REQUEST_TIMEOUT_MS = 8000;
  // How long a request that timed out still recognises its answer, so a slow
  // one is applied quietly instead of being reported a second time.
  private static readonly LATE_ANSWER_MS = 60000;
  private rooms: Map<
    string,
    {
      room: string;
      data: Record<string, unknown>;
    }
  > = new Map();

  constructor() {
    super();

    this.on("pong", () => {
      this.pongSeen = true;
      this.lastPongAt = Date.now();
      this.unansweredPingAt = undefined;
    });
  }

  // Only armed once this connection has answered a ping: an api that predates
  // the pong reply would otherwise be reconnected every 45 seconds.
  //
  // Measured from the oldest unanswered ping and not only from the last pong,
  // because a tab hidden for a few minutes runs the heartbeat once a minute and
  // every pong would look late.
  public static isStale(
    pongSeen: boolean,
    lastPongAt: number,
    unansweredPingAt: number | undefined,
    now: number,
  ) {
    if (!pongSeen || unansweredPingAt === undefined) {
      return false;
    }

    return (
      now - unansweredPingAt > Socket.PONG_GRACE_MS &&
      now - lastPongAt > Socket.PONG_TIMEOUT_MS
    );
  }

  public connect() {
    this.bindLifecycle();

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    clearTimeout(this.resumeCheck);
    clearInterval(this.heartBeat);
    this.connected = false;

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
      if (this.connection !== webSocket) {
        return;
      }

      const { event, data } = JSON.parse(message.data);
      this.emit(event, data);
    });

    webSocket.addEventListener("open", () => {
      if (this.connection !== webSocket) {
        return;
      }

      this.emit("online");
      this.connected = true;
      this.retryCount = 0;
      this.pongSeen = false;
      this.lastPongAt = 0;
      this.unansweredPingAt = undefined;

      clearInterval(this.heartBeat);

      this.heartbeat();

      this.heartBeat = setInterval(() => {
        this.heartbeat();
      }, 15 * 1000);

      console.info("[ws] connected");

      for (const { room, data } of Array.from(this.rooms.values())) {
        this.join(room, data);
      }

      setTimeout(() => {
        if (this.connection !== webSocket || !this.connected) {
          return;
        }

        for (const { event, data } of this.offlineQueue.splice(0)) {
          this.event(event, data);
        }
      }, 100);
    });

    webSocket.onclose = (closeEvent) => {
      if (this.connection !== webSocket) {
        return;
      }

      clearInterval(this.heartBeat);
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

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        this.connect();
      }, delay + jitter);
    };

    webSocket.onerror = (error) => {
      console.warn("[ws] web socket error", error);
    };
  }

  private forceReconnect() {
    console.warn("[ws] no pong from the server, reconnecting");

    this.connected = false;
    this.emit("offline");
    this.retryCount = 0;
    this.connect();
  }

  private bindLifecycle() {
    if (
      this.lifecycleBound ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    this.lifecycleBound = true;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.resume();
      }
    });

    window.addEventListener("online", () => {
      this.resume();
    });
  }

  private resume() {
    if (!this.connected) {
      if (this.connection?.readyState === WebSocket.CONNECTING) {
        return;
      }

      this.retryCount = 0;
      this.connect();
      return;
    }

    this.heartbeat();

    if (!this.connected) {
      return;
    }

    // A zombie only gives itself away by not answering, so look again as soon
    // as this ping is overdue instead of waiting for the next heartbeat.
    clearTimeout(this.resumeCheck);
    this.resumeCheck = setTimeout(() => {
      if (this.connected) {
        this.heartbeat();
      }
    }, Socket.PONG_GRACE_MS + 1);
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

  public deleteMessage(
    type: ChatType,
    id: string,
    messageId: string,
  ): Promise<void> {
    const lobbyId = `${type}:${id}`;

    return this.chatRequest(
      "delete",
      { id, type, messageId },
      {
        resolved: () => {
          this.removeMessageFromLobby(lobbyId, messageId);
        },
        rejected: (error) => {
          if (error?.code === "not_found") {
            this.removeMessageFromLobby(lobbyId, messageId);
          }
        },
      },
    );
  }

  // The ack and the room's `edited` broadcast race: the broadcast goes round
  // through redis, the ack waits on the notification update. Whichever lands
  // first shows the text. The ack carries no edited_at, so it stamps this
  // browser's clock only when the broadcast hasn't already set the server's.
  public editMessage(
    type: ChatType,
    id: string,
    messageId: string,
    message: string,
  ): Promise<void> {
    const lobbyId = `${type}:${id}`;

    return this.chatRequest(
      "edit",
      { id, type, messageId, message },
      {
        resolved: () => {
          const held = this.lobbyMessages(type, id).find(
            (lobbyMessage) => lobbyMessage?.id === messageId,
          );

          if (held?.edited_at && held.message === message) {
            return;
          }

          this.editMessageInLobby(lobbyId, {
            id: messageId,
            message,
            edited_at: new Date().toISOString(),
          });
        },
        rejected: (error) => {
          if (error?.code === "not_found") {
            this.removeMessageFromLobby(lobbyId, messageId);
          }
        },
      },
    );
  }

  // Never queued: someone told a delete or an edit failed must not have it
  // carried out behind their back once the connection comes back.
  private chatRequest(
    action: Exclude<ChatAction, "send">,
    data: Record<string, unknown>,
    handlers: {
      resolved: () => void;
      rejected: (error: ChatError) => void;
    },
  ): Promise<void> {
    if (!this.connected || !this.connection) {
      return Promise.reject({ code: "offline", action });
    }

    const requestId = guid();

    return new Promise<void>((resolve, reject) => {
      const pending: PendingChatRequest = {
        action,
        resolve: () => {
          handlers.resolved();
          resolve();
        },
        reject: (error) => {
          handlers.rejected(error);
          reject(error);
        },
        timer: setTimeout(() => {
          reject({ code: "timeout", action, requestId });
          pending.timer = setTimeout(() => {
            this.pendingRequests.delete(requestId);
          }, Socket.LATE_ANSWER_MS);
        }, Socket.REQUEST_TIMEOUT_MS),
      };

      this.pendingRequests.set(requestId, pending);

      this.event(`lobby:${action}`, { ...data, requestId });
    });
  }

  public resolveChatRequest(ack: ChatAck) {
    this.takeChatRequest(ack)?.resolve();
  }

  public rejectChatRequest(error: ChatError) {
    const pending = this.takeChatRequest(error);
    if (!pending) {
      return false;
    }

    pending.reject(error);
    return true;
  }

  private takeChatRequest(answer: ChatAck | ChatError) {
    const requestId = answer?.requestId;
    if (!requestId) {
      return undefined;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending || (answer.action ?? "send") !== pending.action) {
      return undefined;
    }

    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timer);

    return pending;
  }

  // Server-side read state, so a room's unread count survives a reload and
  // doesn't come back on another device -- and so no push is sent for a
  // message that has already been read here.
  //
  // The local cursor moves in the same call rather than at the call sites:
  // four of them mark rooms read, and one forgetting would leave a badge that
  // the next history snapshot puts straight back.
  public markLobbyRead(type: ChatType, id: string) {
    useChatReadState().markRead(type, id);

    this.event(`lobby:read`, {
      id,
      type,
    });
  }

  // What this tab is showing, so the server can decline to buzz a phone about a
  // conversation that is already on screen.
  //
  // A hidden tab reports no focus: it is still a live socket, and counting it
  // as "reading" is how a notification goes missing for a window nobody is
  // looking at.
  public setPresence(presence: { visible: boolean; focus: string | null }) {
    this.presence = presence;

    if (!this.connected || !this.connection) {
      return;
    }

    this.sendPresence();
  }

  // Ping keeps the connection registered; presence rides along with it because
  // the server expires a focus after a couple of heartbeats and a tab left open
  // on a conversation has to keep saying so.
  private heartbeat() {
    const now = Date.now();

    if (
      Socket.isStale(this.pongSeen, this.lastPongAt, this.unansweredPingAt, now)
    ) {
      this.forceReconnect();
      return;
    }

    if (this.unansweredPingAt === undefined) {
      this.unansweredPingAt = now;
    }

    this.connection?.send(JSON.stringify({ event: "ping" }));
    this.sendPresence();
  }

  private sendPresence() {
    this.connection?.send(
      JSON.stringify({ event: "presence", data: this.presence }),
    );
  }

  public lobbyMessages(type: ChatType, id: string): readonly LobbyMessage[] {
    return this.lobbies.get(`${type}:${id}`)?.messages.value ?? [];
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
      deleted: new Set(),
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

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:deleted`, (data: { id?: string }) => {
        this.removeLobbyMessage(lobby, data?.id);
      }),
    );

    lobby.listeners.push(
      this.listen(`lobby:${lobbyId}:edited`, (edit: ChatMessageEdit) => {
        this.editLobbyMessage(lobby, edit);
      }),
    );

    this.join(`lobby`, {
      id: _id,
      type,
    });

    return this.createLobbyHandle(lobbyId, lobby, instanceKey, type, _id);
  }

  private mergeLobbyMessages(lobby: LobbyState, messages: LobbyMessage[]) {
    const merged = mergeChatSnapshot(
      lobby.messages.value,
      messages,
      lobby.deleted,
    );

    lobby.seen.clear();
    for (const message of merged) {
      lobby.seen.add(chatMessageKey(message));
    }

    lobby.messages.value = merged;
    this.emitToLobbyInstances(lobby, "lobby:messages", merged);
  }

  private addLobbyMessage(lobby: LobbyState, message: LobbyMessage) {
    const key = chatMessageKey(message);
    if (lobby.seen.has(key) || isChatMessageDeleted(message, lobby.deleted)) {
      return;
    }
    lobby.seen.add(key);

    lobby.messages.value = insertChatMessage(lobby.messages.value, message);
    this.emitToLobbyInstances(lobby, "lobby:chat", message);
  }

  private editMessageInLobby(lobbyId: string, edit: ChatMessageEdit) {
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      this.editLobbyMessage(lobby, edit);
    }
  }

  private editLobbyMessage(lobby: LobbyState, edit: ChatMessageEdit) {
    const messages = applyChatMessageEdit(
      lobby.messages.value,
      edit,
      lobby.deleted,
    );

    if (messages) {
      lobby.messages.value = messages;
    }
  }

  private removeMessageFromLobby(lobbyId: string, messageId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      this.removeLobbyMessage(lobby, messageId);
    }
  }

  private removeLobbyMessage(lobby: LobbyState, messageId?: string) {
    if (typeof messageId !== "string" || !messageId) {
      return;
    }

    lobby.deleted.add(messageId);

    const removed = removeChatMessage(lobby.messages.value, messageId);
    if (!removed) {
      return;
    }

    lobby.seen.delete(chatMessageKey(removed.message));
    lobby.messages.value = removed.messages;

    const event: LobbyMessageDeleted = {
      message: removed.message,
      index: removed.index,
    };
    this.emitToLobbyInstances(lobby, "lobby:deleted", event);
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

// The cursor the database actually wrote, replacing the one markLobbyRead
// stamped from this browser's clock. Message timestamps come from the API, so
// a browser running a minute slow would leave every message in the room newer
// than its own cursor -- and the badge back the moment the next snapshot lands.
socket.listen(
  "chat:read",
  ({ thread, lastReadAt }: { thread: string; lastReadAt: string }) => {
    useChatReadState().setCursor(thread, lastReadAt);
  },
);

socket.listen("chat:ack", (ack: ChatAck) => {
  socket.resolveChatRequest(ack);
});

// A request with someone waiting on it is theirs to report.
socket.listen("chat:error", (error: ChatError) => {
  if (socket.rejectChatRequest(error)) {
    return;
  }

  toastChatError(error);
});

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
