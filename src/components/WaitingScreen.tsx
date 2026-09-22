export default function WaitingScreen({
  players,
  isHost,
  myPlayerId,
  onStart,
}: any) {
  const hostCode = myPlayerId.split("-").pop();

  return (
    <div className="glass-panel">
      <div className="mb-5">
        <h3 className="text-[#ffeb3b] font-bold text-lg mb-1">
          {players.length}/8 Players Joined
        </h3>
        <h2 className="text-2xl font-bold">
          Room Code:{" "}
          <span className="text-3xl text-[#2ed573] drop-shadow-[0_0_10px_rgba(46,213,115,0.5)]">
            {isHost ? hostCode : "..."}
          </span>
        </h2>
      </div>

      <div className="flex flex-wrap gap-2 justify-center my-5">
        {players.map((p: any) => (
          <div
            key={p.id}
            className="bg-black/50 px-5 py-2.5 rounded-full font-bold text-sm"
          >
            {p.name}
          </div>
        ))}
      </div>

      <div className="mt-5">
        {isHost && players.length >= 2 ? (
          <button
            onClick={onStart}
            className="w-full p-3 rounded-lg font-bold bg-[#2ed573] text-black hover:scale-105 transition-transform"
          >
            Start Game Now
          </button>
        ) : (
          <p className="animate-pulse-fast text-gray-300">
            {isHost
              ? "Waiting for players to join..."
              : "Menunggu Host memulai..."}
          </p>
        )}
      </div>
    </div>
  );
}
