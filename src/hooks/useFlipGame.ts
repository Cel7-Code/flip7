"use client";
import { useState, useRef, useEffect } from "react";

export type Player = {
  id: string;
  name: string;
  score: number;
  tempCards: any[];
  isFrozen: boolean;
  isBusted: boolean;
  hasStood: boolean;
};
export type GameState = {
  status: "WAITING" | "PLAYING";
  players: Player[];
  activePlayerIndex: number;
  deck: any[];
  timeLeft: number;
  isProcessing: boolean;
};

export function useFlipGame() {
  const [gameState, setGameState] = useState<GameState>({
    status: "WAITING",
    players: [],
    activePlayerIndex: 0,
    deck: [],
    timeLeft: 10,
    isProcessing: false,
  });
  const [myPlayerId, setMyPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [targetModal, setTargetModal] = useState<{
    isOpen: boolean;
    type: string;
  }>({ isOpen: false, type: "" });

  const peerRef = useRef<any>(null);
  const connectionsRef = useRef<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resolveTargetRef = useRef<((id: string) => void) | null>(null);

  // Fungsi sinkronisasi State (Host -> Client)
  const broadcastState = (newState: GameState) => {
    setGameState({ ...newState });
    if (isHost) {
      connectionsRef.current.forEach((conn) =>
        conn.send({ type: "UPDATE_STATE", state: newState }),
      );
    }
  };

  const showNotif = (msg: string) => setNotif(msg);
  const sendGlobalNotif = (msg: string) => {
    showNotif(msg);
    if (isHost)
      connectionsRef.current.forEach((c) =>
        c.send({ type: "NOTIFY_GLOBAL", msg }),
      );
  };

  const resetToLogin = () => {
    if (peerRef.current) peerRef.current.destroy();
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState({
      status: "WAITING",
      players: [],
      activePlayerIndex: 0,
      deck: [],
      timeLeft: 10,
      isProcessing: false,
    });
    setIsHost(false);
    connectionsRef.current = [];
    setNotif(null);
    setTargetModal({ isOpen: false, type: "" });
  };

  const exitRoom = () => {
    if (isHost) {
      connectionsRef.current.forEach((c) => c.send({ type: "ROOM_CLOSED" }));
      resetToLogin();
    } else if (connectionsRef.current[0]) {
      connectionsRef.current[0].send({ action: "LEAVE_ROOM", id: myPlayerId });
      resetToLogin();
    }
  };

  const createRoom = async (hostName: string) => {
    if (!hostName) return showNotif("Nama harus diisi!");
    const Peer = (await import("peerjs")).default;
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const id = "flip7-marcel-" + randomCode;

    setIsHost(true);
    setMyPlayerId(id);
    const peer = new Peer(id);
    peerRef.current = peer;

    peer.on("open", () => {
      broadcastState({
        ...gameState,
        players: [
          {
            id,
            name: hostName + " 👑",
            score: 0,
            tempCards: [],
            isFrozen: false,
            isBusted: false,
            hasStood: false,
          },
        ],
      });
    });

    peer.on("connection", (conn: any) => {
      conn.on("open", () => {
        if (gameState.status !== "WAITING" || gameState.players.length >= 8) {
          conn.send({ type: "REJECT", msg: "Room penuh / sudah mulai!" });
          setTimeout(() => conn.close(), 500);
          return;
        }
        connectionsRef.current.push(conn);
        setGameState((prev) => {
          const newState = {
            ...prev,
            players: [
              ...prev.players,
              {
                id: conn.peer,
                name: conn.metadata.name || "Player",
                score: 0,
                tempCards: [],
                isFrozen: false,
                isBusted: false,
                hasStood: false,
              },
            ],
          };
          broadcastState(newState);
          return newState;
        });
      });

      conn.on("data", (data: any) => {
        // Implementasi routing action FLIP, STAND, TARGET_SELECTED persis seperti Vanilla JS
        if (data.action === "LEAVE_ROOM") return; // Eksekusi fungsi leave
        if (data.action === "TARGET_SELECTED" && resolveTargetRef.current)
          resolveTargetRef.current(data.targetId);
      });
    });
  };

  const joinRoom = async (code: string, joinName: string) => {
    if (code.length !== 4) return showNotif("Masukkan 4 digit kode!");
    const Peer = (await import("peerjs")).default;
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id: string) => {
      setMyPlayerId(id);
      const conn = peer.connect("flip7-marcel-" + code, {
        metadata: { name: joinName },
      });
      connectionsRef.current = [conn];

      conn.on("open", () => console.log("Connected to host"));
      conn.on("data", (data: any) => {
        if (data.type === "UPDATE_STATE") setGameState(data.state);
        else if (
          data.type === "NOTIFY_GLOBAL" ||
          (data.type === "NOTIFY_TARGET" && data.targetId === id)
        )
          showNotif(data.msg);
        else if (data.type === "ROOM_CLOSED") {
          showNotif("Host menutup Room!");
          setTimeout(resetToLogin, 2000);
        } else if (data.type === "ASK_TARGET")
          setTargetModal({ isOpen: true, type: data.itemType });
      });
    });
  };

  const startGame = () => {
    if (gameState.players.length < 2)
      return showNotif("Butuh minimal 1 player lagi!");
    broadcastState({ ...gameState, status: "PLAYING", activePlayerIndex: 0 });
    // Logika bikin deck dan start timer ditaruh di sini
  };

  const sendAction = (action: string) => {
    if (isHost) {
      // Panggil processFlip() atau processStand()
    } else {
      connectionsRef.current[0].send({ action });
    }
  };

  return {
    gameState,
    myPlayerId,
    isHost,
    notif,
    targetModal,
    setNotif,
    setTargetModal,
    createRoom,
    joinRoom,
    startGame,
    exitRoom,
    sendAction,
  };
}
