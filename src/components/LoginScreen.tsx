"use client";
import { useState } from "react";

export default function LoginScreen({
  onCreate,
  onJoin,
}: {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}) {
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  return (
    <div className="glass-panel">
      <h1 className="text-3xl font-bold mb-2">🃏 Flip-7 Online</h1>
      <p className="mb-6">
        Setiap tarikan masuk ke deck-mu. Stand untuk amankan poin!
      </p>

      <div className="flex flex-col md:flex-row gap-5 mt-5">
        <div className="flex-1 bg-black/20 p-5 rounded-xl">
          <h3 className="font-bold mb-2 text-lg">Buat Room (Host)</h3>
          <input
            type="text"
            placeholder="Masukkan Nama Lu"
            maxLength={10}
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="w-full p-3 mt-2 rounded-lg bg-white/90 text-black text-center font-bold outline-none"
          />
          <button onClick={() => onCreate(hostName)} className="btn-primary">
            Create Room
          </button>
        </div>
        <div className="flex-1 bg-black/20 p-5 rounded-xl">
          <h3 className="font-bold mb-2 text-lg">Masuk Room (Client)</h3>
          <input
            type="text"
            placeholder="Masukkan Nama Lu"
            maxLength={10}
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="w-full p-3 mt-2 rounded-lg bg-white/90 text-black text-center font-bold outline-none"
          />
          <input
            type="text"
            placeholder="4 Digit Kode"
            maxLength={4}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="w-full p-3 mt-2 rounded-lg bg-white/90 text-black text-center font-bold outline-none tracking-widest"
          />
          <button
            onClick={() => onJoin(roomCode, joinName)}
            className="btn-primary"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
