"use client";
import { useFlipGame } from "@/hooks/useFlipGame";
import LoginScreen from "@/components/LoginScreen";
import WaitingScreen from "@/components/WaitingScreen";
import GameBoard from "@/components/GameBoard";
import { AlertModal } from "@/components/Modals";

export default function Home() {
  const {
    gameState,
    myPlayerId,
    isHost,
    notif,
    setNotif,
    createRoom,
    joinRoom,
    startGame,
    exitRoom,
    sendAction,
  } = useFlipGame();

  return (
    <main>
      {/* EXIT BUTTON (Hanya muncul jika sudah masuk room) */}
      {gameState.status !== "WAITING" && myPlayerId && (
        <button
          onClick={exitRoom}
          className="absolute top-4 right-4 bg-[#ff4757] hover:bg-[#d63031] text-white px-4 py-2 rounded-lg font-bold shadow-lg z-50 transition-colors"
        >
          🚪 Keluar Room
        </button>
      )}

      {/* RENDER BERDASARKAN STATUS */}
      {gameState.status === "WAITING" && !myPlayerId && (
        <LoginScreen onCreate={createRoom} onJoin={joinRoom} />
      )}

      {gameState.status === "WAITING" && myPlayerId && (
        <WaitingScreen
          players={gameState.players}
          isHost={isHost}
          myPlayerId={myPlayerId}
          onStart={startGame}
        />
      )}

      {gameState.status === "PLAYING" && (
        <GameBoard
          gameState={gameState}
          myPlayerId={myPlayerId}
          sendAction={sendAction}
        />
      )}

      {/* MODALS */}
      {notif && <AlertModal msg={notif} onClose={() => setNotif(null)} />}
    </main>
  );
}
