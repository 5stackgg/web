import socket from "./Socket";
import { v4 as uuidv4 } from "uuid";
import type { SocketCallback } from "./types/SocketCallback";
import type { Instance as SimplePeerInstance, SignalData } from "simple-peer";

// @ts-ignore
import Peer from "simple-peer/simplepeer.min.js";

// Extended type to include internal properties
type ExtendedPeer = SimplePeerInstance & {
  id: string;
  _pc: RTCPeerConnection;
  connected: boolean;
};

class WebRTCClient {
  private channelCounter: number = 0;
  private peers: Map<string, ExtendedPeer> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private hasSetupSocketListeners: boolean = false;
  private answeredPeers: Set<string> = new Set();

  private setupSocketListeners() {
    const handleSignal = (data: { peerId: string; signal: SignalData }) => {
      const peer = this.peers.get(data.peerId);
      if (!peer || (peer as any).destroyed) {
        console.warn(
          `[WebRTC] Ignoring signal for ${data.peerId}: peer missing or destroyed`,
        );
        return;
      }

      try {
        const signalType = (data.signal as any)?.type;
        const signalingState = peer._pc?.signalingState;
        if (
          signalType === "answer" &&
          (signalingState === "stable" ||
            signalingState === "have-local-pranswer")
        ) {
          return;
        }

        if (signalType === "answer") {
          if (this.answeredPeers.has(data.peerId)) {
            return;
          }
          this.answeredPeers.add(data.peerId);
        }

        peer.signal(data.signal);
      } catch (err) {
        console.error(
          `[WebRTC] Failed to apply signal for peer ${data.peerId}:`,
          err,
        );
      }
    };

    socket.listen("answer", handleSignal as unknown as SocketCallback);
    socket.listen("candidate", handleSignal as unknown as SocketCallback);
  }

  public async connect(
    region: string,
    callback: (data: any) => void,
  ): Promise<RTCDataChannel> {
    if (!this.hasSetupSocketListeners) {
      this.setupSocketListeners();
      this.hasSetupSocketListeners = true;
    }

    const peer = await this.createPeer(region);

    const dataChannel = peer._pc.createDataChannel(
      `ping-${++this.channelCounter}`,
      {
        ordered: true,
      },
    );
    this.dataChannels.set(peer.id, dataChannel);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanupPeer(peer.id);
        reject(new Error("Data channel open timeout"));
      }, 10000);

      dataChannel.onopen = () => {
        clearTimeout(timeout);
        resolve(dataChannel);
      };

      dataChannel.onmessage = (event) => {
        callback(event.data);
      };

      dataChannel.onerror = (error: any) => {
        clearTimeout(timeout);
        console.error(`[WebRTC] Data channel error for peer ${peer.id}:`, {
          label: dataChannel.label,
          readyState: dataChannel.readyState,
          error: error,
        });
        reject(error);
      };
      dataChannel.onclose = () => {
        clearTimeout(timeout);
        this.cleanupPeer(peer.id);
      };
    });
  }

  private createPeer(region: string): Promise<ExtendedPeer> {
    return new Promise((resolve, reject) => {
      const peer = new Peer({
        trickle: true,
        initiator: true,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        },
      }) as ExtendedPeer;

      peer.id = uuidv4();
      this.peers.set(peer.id, peer);

      const timeout = setTimeout(() => {
        peer.destroy();
        this.cleanupPeer(peer.id);
        reject(new Error("Peer connection timeout"));
      }, 10000);

      peer
        .on("connect", () => {
          clearTimeout(timeout);
          resolve(peer);
        })
        .on("signal", (data: any) => {
          console.debug("[WebRTC] Generated signaling data:", data.type);
          socket.event(data.type, {
            signal: data,
            region: region,
            peerId: peer.id,
          });
        })
        .on("error", (err: Error) => {
          clearTimeout(timeout);
          console.error(
            `[WebRTC] Peer connection error for peer ${peer.id}:`,
            err,
          );
          peer.destroy();
          reject(err);
        })
        .on("close", () => {
          clearTimeout(timeout);
          this.cleanupPeer(peer.id);
        });
    });
  }

  public sendMessage(message: any) {
    const messageStr =
      typeof message === "string" ? message : JSON.stringify(message);

    // Try to send to all connected peers
    let sentToAny = false;
    this.peers.forEach((peer, peerId) => {
      const dataChannel = this.dataChannels.get(peerId);

      if (dataChannel && dataChannel.readyState === "open") {
        console.log(
          `[WebRTC] Sending message through data channel for peer ${peerId}:`,
          {
            size: messageStr.length,
            channelState: dataChannel.readyState,
          },
        );
        dataChannel.send(messageStr);
        sentToAny = true;
      } else if (peer.connected) {
        console.log(
          `[WebRTC] Sending message through peer connection ${peerId}:`,
          {
            size: messageStr.length,
            peerConnected: peer.connected,
          },
        );
        peer.send(messageStr);
        sentToAny = true;
      }
    });

    if (!sentToAny) {
      console.error("[WebRTC] Failed to send message to any peers:", {
        peerCount: this.peers.size,
        dataChannelCount: this.dataChannels.size,
      });
    }
  }

  private cleanupPeer(peerId: string) {
    console.log(`[WebRTC] Starting cleanup for peer ${peerId}`);

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      console.log(`[WebRTC] Closing data channel for peer ${peerId}:`, {
        label: dataChannel.label,
        readyState: dataChannel.readyState,
      });
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    const peer = this.peers.get(peerId);
    if (peer) {
      console.log(`[WebRTC] Destroying peer connection ${peerId}:`, {
        connectionState: peer._pc.connectionState,
        iceConnectionState: peer._pc.iceConnectionState,
      });
      try {
        peer.destroy();
      } catch (err) {
        console.warn(`[WebRTC] Error during peer.destroy for ${peerId}:`, err);
      }
      this.peers.delete(peerId);
    }

    console.log(`[WebRTC] Cleanup completed for peer ${peerId}`);
    this.answeredPeers.delete(peerId);
  }

  public dispose() {
    console.log("[WebRTC] Disposing all peers");
    // Clean up all peers
    Array.from(this.peers.keys()).forEach((peerId) => {
      this.cleanupPeer(peerId);
    });
  }
}

export const webrtc = new WebRTCClient();
