let peer;
let myPlayerId = "";
let isHost = false;
let clientConnections = [];
let turnTimerInterval;
let resolveTarget = null;

// TAMBAHKAN KONFIGURASI INI
const customConfig = {
  config: {
    iceServers: [
      { urls: "stun:stun.relay.metered.ca:80" }, // STUN public Google
      {
        // GANTI DENGAN DATA DARI METERED LU
        urls: "turn:global.relay.metered.ca:80",
        username: "0cb63e7912a1d6191e4895e0",
        credential: "5ZVwxO5lrDiuJgWZ",
      },
    ],
  },
};

let gameState = {
  status: "WAITING",
  players: [], // Format: { id, name, score, tempCards: [], isFrozen: false, isBusted: false, hasStood: false }
  activePlayerIndex: 0,
  deck: [],
  timeLeft: 10,
  isProcessing: false,
};

const uiLogin = document.getElementById("loginScreen");
const uiWaiting = document.getElementById("waitingScreen");
const uiGame = document.getElementById("gameBoard");
const btnFlip = document.getElementById("btnFlip");
const btnStand = document.getElementById("btnStand");
const btnExitGlobal = document.getElementById("btnExitGlobal");

// --- SISTEM NOTIFIKASI ---
function showNotif(msg) {
  document.getElementById("alertMsg").innerText = msg;
  document.getElementById("customAlert").classList.remove("hidden");
}
document.getElementById("btnAlertClose").addEventListener("click", () => {
  document.getElementById("customAlert").classList.add("hidden");
});
function sendTargetNotif(targetId, msg) {
  if (myPlayerId === targetId) showNotif(msg);
  if (isHost)
    clientConnections.forEach((conn) =>
      conn.send({ type: "NOTIFY_TARGET", targetId: targetId, msg: msg }),
    );
}
function sendGlobalNotif(msg) {
  showNotif(msg);
  if (isHost)
    clientConnections.forEach((conn) =>
      conn.send({ type: "NOTIFY_GLOBAL", msg: msg }),
    );
}

// --- 1. EXIT ROOM LOGIC ---
function resetToLogin() {
  if (peer) peer.destroy();
  clearInterval(turnTimerInterval);
  uiLogin.classList.remove("hidden");
  uiWaiting.classList.add("hidden");
  uiGame.classList.add("hidden");
  btnExitGlobal.classList.add("hidden");
  document.getElementById("customAlert").classList.add("hidden");
  document.getElementById("targetModal").classList.add("hidden");

  gameState = {
    status: "WAITING",
    players: [],
    activePlayerIndex: 0,
    deck: [],
    timeLeft: 10,
    isProcessing: false,
  };
  isHost = false;
  clientConnections = [];
  document.getElementById("btnJoin").innerText = "Join Room";
  document.getElementById("btnJoin").disabled = false;
}

btnExitGlobal.addEventListener("click", () => {
  if (isHost) {
    clientConnections.forEach((c) => c.send({ type: "ROOM_CLOSED" }));
    resetToLogin();
  } else {
    const conn = clientConnections[0];
    if (conn) conn.send({ action: "LEAVE_ROOM", id: myPlayerId });
    resetToLogin();
  }
});

function handlePlayerLeave(playerId) {
  const pIndex = gameState.players.findIndex((p) => p.id === playerId);
  if (pIndex === -1) return;

  const leaverName = gameState.players[pIndex].name;
  gameState.players.splice(pIndex, 1);
  clientConnections = clientConnections.filter((c) => c.peer !== playerId);

  if (
    gameState.players.length <= 0 ||
    (gameState.players.length === 1 && isHost)
  ) {
    showNotif("Pemain tidak cukup. Room otomatis dibubarkan.");
    setTimeout(resetToLogin, 2500);
    return;
  }

  sendGlobalNotif(`🚪 ${leaverName} telah keluar dari Room.`);
  if (gameState.activePlayerIndex >= gameState.players.length)
    gameState.activePlayerIndex = 0;

  checkRoundCompletion();
}

// --- 2. HOST: BIKIN ROOM & START ---
document.getElementById("btnCreate").addEventListener("click", () => {
  const hostName = document.getElementById("hostName").value || "Host";
  if (!hostName) return showNotif("Nama harus diisi!");

  isHost = true;
  const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
  myPlayerId = "flip7-marcel-" + randomCode;

  peer = new Peer(myPlayerId, customConfig);
  peer.on("open", () => {
    gameState.players.push({
      id: myPlayerId,
      name: hostName + " 👑",
      score: 0,
      tempCards: [],
      isFrozen: false,
      isBusted: false,
      hasStood: false,
    });
    document.getElementById("waitRoomCode").innerText = randomCode;
    btnExitGlobal.classList.remove("hidden");
    broadcastState();
  });

  peer.on("connection", (conn) => {
    conn.on("open", () => {
      if (gameState.status !== "WAITING" || gameState.players.length >= 8) {
        conn.send({ type: "REJECT", msg: "Room penuh / sudah mulai!" });
        setTimeout(() => conn.close(), 500);
        return;
      }
      clientConnections.push(conn);
      gameState.players.push({
        id: conn.peer,
        name: conn.metadata.name || "Player " + (gameState.players.length + 1),
        score: 0,
        tempCards: [],
        isFrozen: false,
        isBusted: false,
        hasStood: false,
      });
      broadcastState();
    });

    conn.on("data", (data) => {
      if (data.action === "LEAVE_ROOM") {
        handlePlayerLeave(data.id);
        return;
      }
      if (data.action === "TARGET_SELECTED" && resolveTarget) {
        resolveTarget(data.targetId);
        return;
      }

      if (gameState.players[gameState.activePlayerIndex]?.id !== conn.peer)
        return;
      if (gameState.isProcessing) return;

      if (data.action === "FLIP") processFlip();
      if (data.action === "STAND") processStand();
    });
    conn.on("close", () => {
      handlePlayerLeave(conn.peer);
    });
  });
});

document.getElementById("btnStartGame").addEventListener("click", () => {
  if (gameState.players.length < 2)
    return showNotif("Butuh minimal 1 player lagi!");
  gameState.status = "PLAYING";
  gameState.activePlayerIndex = 0;
  bikinDeck();

  btnFlip.onclick = () => {
    if (!gameState.isProcessing) processFlip();
  };
  btnStand.onclick = () => {
    if (!gameState.isProcessing) processStand();
  };

  startTimer();
});

// --- 3. CLIENT: MASUK ROOM ---
document.getElementById("btnJoin").addEventListener("click", () => {
  const code = document.getElementById("inputRoom").value;
  const joinName = document.getElementById("joinName").value || "Player";
  if (code.length !== 4) return showNotif("Masukkan 4 digit kode!");

  document.getElementById("btnJoin").innerText = "Menghubungkan...";
  document.getElementById("btnJoin").disabled = true;

  peer = new Peer(customConfig);
  peer.on("open", (id) => {
    myPlayerId = id;
    const conn = peer.connect("flip7-marcel-" + code, {
      metadata: { name: joinName },
    });
    clientConnections = [conn];

    conn.on("open", () => {
      btnFlip.onclick = () => {
        if (!gameState.isProcessing) conn.send({ action: "FLIP" });
      };
      btnStand.onclick = () => {
        if (!gameState.isProcessing) conn.send({ action: "STAND" });
      };
      btnExitGlobal.classList.remove("hidden");
    });

    conn.on("data", (data) => {
      if (data.type === "REJECT") {
        showNotif(data.msg);
        conn.close();
        resetToLogin();
      } else if (data.type === "ROOM_CLOSED") {
        showNotif("Host telah menutup Room!");
        setTimeout(resetToLogin, 2000);
      } else if (data.type === "UPDATE_STATE") {
        gameState = data.state;
        renderLayar();
      } else if (
        data.type === "NOTIFY_TARGET" &&
        data.targetId === myPlayerId
      ) {
        showNotif(data.msg);
      } else if (data.type === "NOTIFY_GLOBAL") {
        showNotif(data.msg);
      } else if (data.type === "ASK_TARGET") {
        showTargetModal(data.itemType);
      }
    });

    peer.on("error", () => {
      showNotif("Kode room tidak ditemukan!");
      resetToLogin();
    });
    conn.on("close", () => {
      showNotif("Terputus dari Host.");
      setTimeout(resetToLogin, 2000);
    });
  });
});

// --- 4. LOGIKA KARTU SPESIAL & TARGETING ---
function askPlayerForTarget(sourceId, itemType) {
  return new Promise((resolve) => {
    resolveTarget = resolve;
    if (sourceId === myPlayerId) {
      showTargetModal(itemType);
    } else {
      const conn = clientConnections.find((c) => c.peer === sourceId);
      if (conn) conn.send({ type: "ASK_TARGET", itemType: itemType });
    }
  });
}

function showTargetModal(itemType) {
  const isDemon = itemType === "demon";
  document.getElementById("targetTitle").innerText = isDemon
    ? "👹 Pilih Korban Demon!"
    : "❄️ Pilih Korban Freeze!";

  const list = document.getElementById("targetList");
  list.innerHTML = "";

  gameState.players.forEach((p) => {
    if (p.id !== myPlayerId && !p.isBusted && !p.hasStood) {
      const btn = document.createElement("button");
      btn.innerText = `Serang: ${p.name}`;
      btn.onclick = () => selectTarget(p.id);
      list.appendChild(btn);
    }
  });
  document.getElementById("targetModal").classList.remove("hidden");
}

function selectTarget(targetId) {
  document.getElementById("targetModal").classList.add("hidden");
  if (isHost) {
    if (resolveTarget) resolveTarget(targetId);
  } else {
    clientConnections[0].send({
      action: "TARGET_SELECTED",
      targetId: targetId,
    });
  }
}

function applyItemEffect(targetId, itemType, sourceName) {
  const target = gameState.players.find((p) => p.id === targetId);
  if (!target) return;

  if (itemType === "freeze") {
    target.isFrozen = true;
    sendGlobalNotif(`❄️ ${target.name} di-Freeze oleh ${sourceName}!`);
  } else if (itemType === "demon") {
    target.tempCards = [];
    target.isBusted = true;
    sendGlobalNotif(
      `👹 DEMON! ${target.name} telah di bust oleh ${sourceName}. Dia tereliminasi di ronde ini!`,
    );
    checkRoundCompletion();
  }
}

// --- 5. LOGIKA PERMAINAN INTI & ROUND LOOP ---
function broadcastState() {
  renderLayar();
  if (isHost)
    clientConnections.forEach((conn) =>
      conn.send({ type: "UPDATE_STATE", state: gameState }),
    );
}

function startTimer() {
  if (!isHost) return;
  clearInterval(turnTimerInterval);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  if (!activePlayer || activePlayer.isBusted || activePlayer.hasStood) {
    nextTurn();
    return;
  }

  if (activePlayer.isFrozen) {
    gameState.isProcessing = true;
    broadcastState();
    sendGlobalNotif(
      `🧊 Giliran ${activePlayer.name}, tapi dia sedang Freeze! Otomatis Stand.`,
    );
    activePlayer.isFrozen = false;
    setTimeout(() => {
      processStand();
    }, 2500);
    return;
  }

  gameState.timeLeft = 10;
  broadcastState();

  turnTimerInterval = setInterval(() => {
    gameState.timeLeft--;
    if (gameState.timeLeft <= 0) {
      clearInterval(turnTimerInterval);
      if (!gameState.isProcessing) processFlip();
    } else {
      broadcastState();
    }
  }, 1000);
}

function bikinDeck(isReshuffle = false) {
  gameState.deck = [];
  gameState.deck.push({ type: "number", value: 0, resolved: false });
  gameState.deck.push({ type: "number", value: 1, resolved: false });
  for (let i = 2; i <= 12; i++) {
    for (let j = 0; j < i; j++)
      gameState.deck.push({ type: "number", value: i, resolved: false });
  }
  for (let i = 0; i < 3; i++) {
    gameState.deck.push({ type: "freeze", value: "❄️", resolved: false });
    gameState.deck.push({ type: "demon", value: "👹", resolved: false });
    gameState.deck.push({ type: "flip3", value: "🃏", resolved: false });
  }

  for (let i = gameState.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.deck[i], gameState.deck[j]] = [
      gameState.deck[j],
      gameState.deck[i],
    ];
  }
  if (isReshuffle)
    sendGlobalNotif("🔄 Tumpukan pusat di-reshuffle jadi 88 kartu!");
}

function drawCard() {
  if (gameState.deck.length <= 10) bikinDeck(true);
  return gameState.deck.pop();
}

function processFlip() {
  clearInterval(turnTimerInterval);
  gameState.isProcessing = true;
  broadcastState();

  const player = gameState.players[gameState.activePlayerIndex];
  player.tempCards.push(drawCard());
  broadcastState();

  setTimeout(async () => {
    await evaluatePlayer(player, () => {
      nextTurn();
    });
  }, 1000);
}

async function evaluatePlayer(player, callback) {
  let bust = false;
  let bustReason = "";
  const unassigned = player.tempCards.filter((c) => !c.resolved);

  for (let card of unassigned) {
    card.resolved = true;

    if (card.type === "freeze" || card.type === "demon") {
      gameState.isProcessing = true;
      broadcastState();

      const activeOpponents = gameState.players.filter(
        (p) => p.id !== player.id && !p.isBusted && !p.hasStood,
      );

      if (activeOpponents.length > 0) {
        const targetId = await askPlayerForTarget(player.id, card.type);
        applyItemEffect(targetId, card.type, player.name);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        sendTargetNotif(
          player.id,
          `Tidak ada target aktif, kartu ${card.type} diabaikan!`,
        );
      }
    }

    if (card.type === "flip3") {
      gameState.isProcessing = true;
      sendTargetNotif(
        player.id,
        "🃏 FLIP 3! Ditarik 3 kartu tambahan otomatis!",
      );
      await new Promise((r) => setTimeout(r, 1500));
      for (let i = 0; i < 3; i++) player.tempCards.push(drawCard());
      broadcastState();
      return evaluatePlayer(player, callback);
    }
  }

  const nums = player.tempCards
    .filter((c) => c.type === "number")
    .map((c) => c.value);
  if (new Set(nums).size !== nums.length) {
    bust = true;
    bustReason =
      "💥 DUPLIKAT! Anda dapat kartu kembar. Tereliminasi di ronde ini!";
  }

  if (bust) {
    sendTargetNotif(player.id, bustReason);
    player.tempCards = [];
    player.isBusted = true;
    checkRoundCompletion();
  } else {
    callback();
  }
}

function processStand() {
  clearInterval(turnTimerInterval);
  gameState.isProcessing = true;
  broadcastState();

  const player = gameState.players[gameState.activePlayerIndex];

  let sum = 0;
  player.tempCards.forEach((c) => {
    if (c.type === "number") sum += c.value;
  });
  player.score += sum;
  player.tempCards = [];
  player.hasStood = true;

  if (player.score >= 200) {
    sendGlobalNotif(
      `🏆 SELAMAT! ${player.name} MEMENANGKAN GAME DENGAN ${player.score} POIN!`,
    );
    gameState.players.forEach((p) => {
      p.score = 0;
      p.tempCards = [];
      p.isFrozen = false;
      p.isBusted = false;
      p.hasStood = false;
    });
    gameState.status = "WAITING";
    gameState.isProcessing = false;
    broadcastState();
    return;
  }

  checkRoundCompletion();
}

// FUNGSI UTAMA: MENGATUR RESET STATUS SAAT SEMUA PEMAIN SELESAI RONDE
function checkRoundCompletion() {
  // Cek apakah masih ada pemain yang belum Busted DAN belum Stand
  const unfinishedPlayers = gameState.players.filter(
    (p) => !p.isBusted && !p.hasStood,
  );

  if (unfinishedPlayers.length === 0) {
    // SEMUA PEMAIN SUDAH SELESAI RONDE INI -> CABUT SEMUA STATUS BUSTED & STAND
    sendGlobalNotif(
      "🔔 Ronde Selesai! Semua pemain telah Stand atau Busted. Status direset, ronde baru dimulai!",
    );
    setTimeout(() => {
      gameState.players.forEach((p) => {
        p.tempCards = [];
        p.isFrozen = false;
        p.isBusted = false; // Status tereliminasi dicabut
        p.hasStood = false; // Status stand dicabut
      });
      gameState.activePlayerIndex = 0;
      gameState.isProcessing = false;
      broadcastState();
      startTimer();
    }, 2500);
  } else {
    nextTurn();
  }
}

function nextTurn() {
  let nextIdx = (gameState.activePlayerIndex + 1) % gameState.players.length;
  let loopCount = 0;

  // Lewati pemain yang sudah Busted atau sudah Stand di ronde ini
  while (
    (gameState.players[nextIdx].isBusted ||
      gameState.players[nextIdx].hasStood) &&
    loopCount < gameState.players.length
  ) {
    nextIdx = (nextIdx + 1) % gameState.players.length;
    loopCount++;
  }

  if (loopCount >= gameState.players.length) {
    checkRoundCompletion();
    return;
  }

  gameState.activePlayerIndex = nextIdx;
  gameState.isProcessing = false;
  broadcastState();
  startTimer();
}

// --- 6. RENDER UI ---
function renderLayar() {
  if (gameState.status === "WAITING") {
    uiLogin.classList.add("hidden");
    uiGame.classList.add("hidden");
    uiWaiting.classList.remove("hidden");
    document.getElementById("playerCount").innerText =
      `${gameState.players.length}/8 Players Joined`;
    const waitList = document.getElementById("waitPlayerList");
    waitList.innerHTML = "";
    gameState.players.forEach((p) => {
      const pDiv = document.createElement("div");
      pDiv.className = "player-badge";
      pDiv.innerText = p.name;
      waitList.appendChild(pDiv);
    });

    if (isHost) {
      if (gameState.players.length >= 2) {
        document.getElementById("waitText").innerText =
          "Semua siap? Klik Start!";
        document.getElementById("waitText").classList.remove("pulsing-text");
        document.getElementById("btnStartGame").classList.remove("hidden");
      } else {
        document.getElementById("waitText").innerText =
          "Waiting for players to join...";
        document.getElementById("waitText").classList.add("pulsing-text");
        document.getElementById("btnStartGame").classList.add("hidden");
      }
    } else {
      document.getElementById("waitText").innerText =
        "Menunggu Host memulai...";
      document.getElementById("btnStartGame").classList.add("hidden");
    }
    return;
  }

  uiWaiting.classList.add("hidden");
  uiGame.classList.remove("hidden");
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  if (!activePlayer) return;

  const scoreboard = document.getElementById("scoreboard");
  scoreboard.innerHTML = "";

  gameState.players.forEach((p) => {
    let tempSum = 0;
    p.tempCards.forEach((c) => {
      if (c.type === "number") tempSum += c.value;
    });

    const div = document.createElement("div");

    // Status Busted Sementara di Ronde Ini
    if (p.isBusted) {
      div.className = "player-score busted";
      div.innerHTML = `<strong><strike>${p.name}</strike></strong><br>☠️ BUSTED (Ronde Ini)<br><small>Poin Aman: ${p.score}</small>`;
      scoreboard.appendChild(div);
      return;
    }

    // Status Sudah Stand di Ronde Ini
    if (p.hasStood) {
      div.className = "player-score";
      div.style.background = "rgba(46, 213, 115, 0.4)";
      div.innerHTML = `<strong>${p.name}</strong><br>✅ STAND (Aman)<br><small>Poin Aman: ${p.score}</small>`;
      scoreboard.appendChild(div);
      return;
    }

    // Status Pemain Aktif
    div.className = `player-score ${p.id === activePlayer.id ? "active" : ""}`;
    div.innerHTML = `<strong>${p.name}</strong><br>Poin Aman: ${p.score}<br><small>Temp Poin: ${tempSum}</small>`;

    if (p.isFrozen) {
      const frozenBadge = document.createElement("div");
      frozenBadge.className = "frozen-badge";
      frozenBadge.innerText = "🧊";
      div.appendChild(frozenBadge);
    }

    const miniCardsDiv = document.createElement("div");
    miniCardsDiv.className = "mini-cards";
    p.tempCards.forEach((c) => {
      const mc = document.createElement("div");
      mc.className = `mini-card ${c.type}`;
      mc.innerText = c.value;
      miniCardsDiv.appendChild(mc);
    });
    div.appendChild(miniCardsDiv);
    scoreboard.appendChild(div);
  });

  document.getElementById("turnIndicator").innerText =
    `Gilirannya: ${activePlayer.name}`;
  document.getElementById("activePlayerName").innerText =
    `Area Kartu Sementara: ${activePlayer.name}`;
  document.getElementById("timerText").innerText = `⏱️ ${gameState.timeLeft}s`;
  document.getElementById("timerText").classList.remove("hidden");
  document.getElementById("deckCount").innerText = gameState.deck.length;

  const isMyTurn = myPlayerId === activePlayer.id;
  btnFlip.disabled =
    !isMyTurn ||
    gameState.isProcessing ||
    activePlayer.isBusted ||
    activePlayer.hasStood;
  btnStand.disabled =
    !isMyTurn ||
    gameState.isProcessing ||
    activePlayer.isBusted ||
    activePlayer.hasStood;

  const cardContainer = document.getElementById("cardContainer");
  cardContainer.innerHTML = "";
  let total = 0;
  activePlayer.tempCards.forEach((c) => {
    if (c.type === "number") total += c.value;
    const cardDiv = document.createElement("div");
    cardDiv.className = `card ${c.type}`;
    cardDiv.innerText = c.value;
    cardContainer.appendChild(cardDiv);
  });

  document.getElementById("turnTotal").innerText = `Total Sementara: ${total}`;
}
