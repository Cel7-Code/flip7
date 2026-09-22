export default function GameBoard({ gameState, myPlayerId, sendAction }: any) {
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = activePlayer?.id === myPlayerId;
  const isActionDisabled =
    !isMyTurn ||
    gameState.isProcessing ||
    activePlayer?.isBusted ||
    activePlayer?.hasStood;

  return (
    <div className="glass-panel">
      {/* SCOREBOARD */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {gameState.players.map((p: any) => (
          <div
            key={p.id}
            className={`bg-black/50 p-2.5 rounded-lg text-sm min-w-[130px] transition-all relative ${p.id === activePlayer?.id ? "bg-[#ff9900] text-black scale-105 shadow-[0_0_15px_#ff9900]" : ""} ${p.isBusted ? "bg-red-600/50 text-gray-300 shadow-inner" : ""}`}
          >
            <strong>{p.name}</strong>
            <br />
            <small>Poin Aman: {p.score}</small>
          </div>
        ))}
      </div>

      <div className="bg-black/20 p-4 rounded-xl">
        <div className="flex justify-center items-center gap-4 mb-2">
          <h2 className="text-[#ffeb3b] text-2xl font-bold drop-shadow-md">
            Gilirannya: {activePlayer?.name}
          </h2>
          <span className="text-[#ff4757] bg-white px-3 py-1 rounded-full font-bold">
            ⏱️ {gameState.timeLeft}s
          </span>
        </div>

        {/* CARDS AREA */}
        <div className="flex flex-wrap gap-2 justify-center min-h-[120px] my-4">
          {activePlayer?.tempCards.map((c: any, i: number) => (
            <div
              key={i}
              className="bg-white text-gray-800 w-[60px] h-[90px] flex justify-center items-center text-3xl font-bold rounded-lg shadow-md animate-pop-in"
            >
              {c.value}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mt-5">
        <button
          disabled={isActionDisabled}
          onClick={() => sendAction("FLIP")}
          className="btn-primary !bg-[#fffc97] !mt-0"
        >
          Flip (Tarik 1)
        </button>
        <button
          disabled={isActionDisabled}
          onClick={() => sendAction("STAND")}
          className="btn-primary !bg-[#2ed573] !mt-0"
        >
          Stand (Aman)
        </button>
      </div>
    </div>
  );
}
