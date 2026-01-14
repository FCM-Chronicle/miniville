// 소켓 연결
const socket = io();

// 게임 데이터
const CARDS = {
  wheatField: { emoji: '🌾', name: '밀밭', cost: 1, numbers: [1], color: 'blue', desc: '모든 턴 1→1원' },
  ranch: { emoji: '🐄', name: '목장', cost: 1, numbers: [2], color: 'blue', desc: '모든 턴 2→1원' },
  forest: { emoji: '🌲', name: '숲', cost: 3, numbers: [5], color: 'blue', desc: '모든 턴 5→1원' },
  mine: { emoji: '⛏️', name: '광산', cost: 6, numbers: [9], color: 'blue', desc: '모든 턴 9→5원' },
  appleOrchard: { emoji: '🍎', name: '사과농원', cost: 3, numbers: [10], color: 'blue', desc: '모든 턴 10→3원' },
  
  bakery: { emoji: '🍞', name: '빵집', cost: 1, numbers: [2,3], color: 'green', desc: '내 턴 2~3→1원' },
  convenience: { emoji: '🏪', name: '편의점', cost: 2, numbers: [4], color: 'green', desc: '내 턴 4→3원' },
  cheeseFactory: { emoji: '🧀', name: '치즈공장', cost: 5, numbers: [7], color: 'green', desc: '내 턴 7→목장당3원' },
  furnitureFactory: { emoji: '🪑', name: '가구공장', cost: 3, numbers: [8], color: 'green', desc: '내 턴 8→숲/광산당3원' },
  farmMarket: { emoji: '🥕', name: '농산물시장', cost: 2, numbers: [11,12], color: 'green', desc: '내 턴 11~12→밀밭/사과당2원' },
  
  cafe: { emoji: '☕', name: '카페', cost: 2, numbers: [3], color: 'red', desc: '상대 턴 3→1원' },
  restaurant: { emoji: '🍽️', name: '레스토랑', cost: 3, numbers: [9,10], color: 'red', desc: '상대 턴 9~10→2원' },
  
  stadium: { emoji: '🏟️', name: '경기장', cost: 6, numbers: [6], color: 'purple', desc: '내 턴 6→모두에게 2원' },
  tvStation: { emoji: '📺', name: 'TV방송국', cost: 7, numbers: [6], color: 'purple', desc: '내 턴 6→한명에게 5원' },
  businessCenter: { emoji: '🏢', name: '비즈니스센터', cost: 8, numbers: [6], color: 'purple', desc: '내 턴 6→카드교환' }
};

const LANDMARKS = {
  station: { emoji: '🚉', name: '역', cost: 4, desc: '주사위 2개 선택 가능' },
  mall: { emoji: '🛍️', name: '쇼핑몰', cost: 10, desc: '빵/편의/카페/레스토랑 +1원' },
  park: { emoji: '🎡', name: '놀이공원', cost: 16, desc: '더블시 추가턴' },
  radio: { emoji: '📻', name: '라디오방송국', cost: 22, desc: '재굴림 1회' }
};

// 전역 변수
let myNickname = '';
let currentRoom = null;
let radioUsedThisTurn = false;
let lastDiceRoll = null;

// === Utility Functions ===
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function showLog(message, duration = 3000) {
  const log = document.getElementById('gameLog');
  log.textContent = message;
  log.classList.add('show');
  setTimeout(() => log.classList.remove('show'), duration);
}

function showError(message) {
  const err = document.getElementById('lobbyError');
  err.textContent = message;
  err.classList.add('show');
  setTimeout(() => err.classList.remove('show'), 3000);
}

function hideAllDiceButtons() {
  document.getElementById('roll1').style.display = 'none';
  document.getElementById('roll2').style.display = 'none';
  document.getElementById('reroll').style.display = 'none';
  document.getElementById('parkReroll').style.display = 'none';
}

// === Event Handlers ===
document.getElementById('createRoomBtn').addEventListener('click', () => {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const roomId = document.getElementById('roomIdInput').value.trim().toUpperCase();
  
  if (!nickname) return showError('닉네임을 입력하세요');
  if (!roomId || roomId.length !== 4) return showError('4자리 방 코드를 입력하세요');
  
  myNickname = nickname;
  socket.emit('createRoom', { roomId, nickname });
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  const nickname = document.getElementById('nicknameInput').value.trim();
  const roomId = document.getElementById('roomIdInput').value.trim().toUpperCase();
  
  if (!nickname) return showError('닉네임을 입력하세요');
  if (!roomId || roomId.length !== 4) return showError('4자리 방 코드를 입력하세요');
  
  myNickname = nickname;
  socket.emit('joinRoom', { roomId, nickname });
});

document.getElementById('startGameBtn').addEventListener('click', () => {
  socket.emit('startGame', { roomId: currentRoom.id, nickname: myNickname });
});

document.getElementById('roll1').addEventListener('click', () => {
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 1 });
  hideAllDiceButtons();
});

document.getElementById('roll2').addEventListener('click', () => {
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 2 });
  hideAllDiceButtons();
});

document.getElementById('reroll').addEventListener('click', () => {
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  
  // Guard clauses
  if (!me.landmarks.radio) return showError('라디오방송국이 없습니다');
  if (radioUsedThisTurn) return showError('이미 사용했습니다');
  if (!lastDiceRoll) return showError('주사위를 먼저 굴려주세요');
  
  radioUsedThisTurn = true;
  socket.emit('rerollDice', { roomId: currentRoom.id, nickname: myNickname });
  hideAllDiceButtons();
  showLog('📻 라디오방송국 효과로 재굴림합니다');
});

document.getElementById('parkReroll').addEventListener('click', () => {
  socket.emit('rollDice', { 
    roomId: currentRoom.id, 
    nickname: myNickname, 
    diceCount: 1, 
    isParkBonus: true 
  });
  hideAllDiceButtons();
});

document.getElementById('endTurnBtn').addEventListener('click', () => {
  socket.emit('endTurn', { roomId: currentRoom.id, nickname: myNickname });
});

document.getElementById('shopBtn').addEventListener('click', () => {
  openShop();
});

document.querySelector('#shopModal .modal-close').addEventListener('click', () => {
  document.getElementById('shopModal').classList.remove('show');
});

document.getElementById('backToLobby').addEventListener('click', () => {
  if (confirm('로비로 돌아가시겠습니까?')) {
    location.reload();
  }
});

document.querySelectorAll('.shop-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    if (tab.dataset.tab === 'cards') {
      document.getElementById('shopCards').style.display = 'grid';
      document.getElementById('shopLandmarks').style.display = 'none';
    } else {
      document.getElementById('shopCards').style.display = 'none';
      document.getElementById('shopLandmarks').style.display = 'grid';
    }
  });
});

// === Socket Event Listeners ===
socket.on('roomCreated', ({ room }) => {
  currentRoom = room;
  showWaitingRoom(room);
});

socket.on('roomJoined', ({ room, reconnected }) => {
  currentRoom = room;
  if (reconnected) {
    showLog('재접속되었습니다', 2000);
  }
  if (room.gameStarted) {
    showGameScreen(room);
  } else {
    showWaitingRoom(room);
  }
});

socket.on('playerJoined', ({ room }) => {
  currentRoom = room;
  showWaitingRoom(room);
});

socket.on('gameStarted', ({ room }) => {
  currentRoom = room;
  showGameScreen(room);
});

socket.on('diceRolled', ({ room, dice, player, isDouble, isParkBonus }) => {
  currentRoom = room;
  lastDiceRoll = dice;
  showDiceResult(dice);
  
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  const isMyTurn = player === myNickname;
  const sum = dice.reduce((a, b) => a + b, 0);
  
  showLog(`🎲 ${player}님이 ${sum}을 굴렸습니다`);
  
  // 더블 체크 (놀이공원 효과)
  const rolledDouble = dice.length === 2 && dice[0] === dice[1];
  
  if (isMyTurn && rolledDouble && me.landmarks.park && !isParkBonus) {
    setTimeout(() => {
      showLog('🎡 놀이공원 효과! 한 번 더 굴릴 수 있습니다');
      document.getElementById('parkReroll').style.display = 'block';
    }, 2000);
  }
});

socket.on('rerollInitiated', ({ room }) => {
  currentRoom = room;
  lastDiceRoll = null;
  updateGameScreen(room);
  
  const me = room.players.find(p => p.nickname === myNickname);
  
  document.getElementById('roll1').style.display = 'block';
  if (me.landmarks.station) {
    document.getElementById('roll2').style.display = 'block';
  }
  
  showLog('이전 결과가 취소되었습니다. 다시 주사위를 굴려주세요');
});

socket.on('gameState', (room) => {
  currentRoom = room;
  updateGameScreen(room);
  console.log(`게임 상태 업데이트 - 턴: ${room.players[room.currentTurn].nickname}, 페이즈: ${room.turnPhase}`);
});

socket.on('turnChanged', ({ room }) => {
  currentRoom = room;
  radioUsedThisTurn = false;
  lastDiceRoll = null;
  updateGameScreen(room);
  
  const currentPlayer = room.players[room.currentTurn];
  const isMyTurn = currentPlayer.nickname === myNickname;
  
  if (isMyTurn) {
    showLog(`당신의 턴입니다! 주사위를 굴려주세요`, 5000);
  } else {
    showLog(`${currentPlayer.nickname}님의 턴입니다`);
  }
});

socket.on('gameWon', ({ winner }) => {
  document.getElementById('winnerName').textContent = winner;
  document.getElementById('winModal').classList.add('show');
});

socket.on('error', ({ message }) => {
  showError(message);
});

socket.on('effectsApplied', ({ logs }) => {
  if (logs && logs.length > 0) {
    logs.forEach((log, idx) => {
      setTimeout(() => showLog(log, 2000), idx * 1500);
    });
  }
});

socket.on('disconnect', () => {
  showError('서버와의 연결이 끊어졌습니다');
});

socket.on('connect', () => {
  if (currentRoom && myNickname) {
    socket.emit('rejoinRoom', { 
      roomId: currentRoom.id, 
      nickname: myNickname 
    });
  }
});

// === UI Rendering Functions ===
function showWaitingRoom(room) {
  showScreen('waitingRoom');
  document.getElementById('roomCode').textContent = room.id;
  updatePlayersList(room);
  
  if (room.host === myNickname) {
    document.getElementById('startGameBtn').style.display = 'block';
    document.getElementById('startGameBtn').disabled = room.players.length < 2;
    document.querySelector('.waiting-msg').style.display = 'none';
  } else {
    document.getElementById('startGameBtn').style.display = 'none';
    document.querySelector('.waiting-msg').style.display = 'block';
  }
}

function updatePlayersList(room) {
  const list = document.getElementById('playersList');
  list.innerHTML = '';
  
  room.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-item';
    if (player.nickname === room.host) div.classList.add('host');
    div.textContent = player.nickname + (player.nickname === room.host ? ' 👑' : '');
    list.appendChild(div);
  });
}

function showGameScreen(room) {
  showScreen('game');
  updateGameScreen(room);
}

function updateGameScreen(room) {
  const me = room.players.find(p => p.nickname === myNickname);
  const opponents = room.players.filter(p => p.nickname !== myNickname);
  const isMyTurn = room.players[room.currentTurn].nickname === myNickname;
  
  // 내 정보
  document.getElementById('myName').textContent = myNickname;
  document.getElementById('myMoney').textContent = me.money;
  
  // 랜드마크
  renderLandmarks(me.landmarks);
  
  // 내 카드
  renderMyCards(me.cards);
  
  // 상대 플레이어
  renderOpponents(opponents, room.currentTurn);
  
  // 턴 정보
  const currentPlayer = room.players[room.currentTurn];
  document.getElementById('turnInfo').textContent = 
    isMyTurn ? '당신의 턴입니다' : `${currentPlayer.nickname}님의 턴`;
  
  // 주사위 버튼 - dice 페이즈에서만
  if (isMyTurn && room.turnPhase === 'dice') {
    document.getElementById('roll1').style.display = 'block';
    
    if (me.landmarks.station) {
      document.getElementById('roll2').style.display = 'block';
    } else {
      document.getElementById('roll2').style.display = 'none';
    }
    
    // 라디오 재굴림: 주사위를 이미 굴렸고 아직 사용 안 했을 때
    if (me.landmarks.radio && !radioUsedThisTurn && lastDiceRoll) {
      document.getElementById('reroll').style.display = 'block';
    } else {
      document.getElementById('reroll').style.display = 'none';
    }
  } else {
    hideAllDiceButtons();
  }
  
  // 건설 버튼
  const canBuild = isMyTurn && room.turnPhase === 'build';
  document.getElementById('shopBtn').disabled = !canBuild;
  document.getElementById('endTurnBtn').disabled = !canBuild;
  
  if (canBuild) {
    document.getElementById('shopBtn').classList.remove('disabled');
    document.getElementById('endTurnBtn').classList.remove('disabled');
  } else {
    document.getElementById('shopBtn').classList.add('disabled');
    document.getElementById('endTurnBtn').classList.add('disabled');
  }
}

function renderLandmarks(landmarks) {
  const container = document.getElementById('myLandmarks');
  container.innerHTML = '';
  
  Object.entries(LANDMARKS).forEach(([key, data]) => {
    const div = document.createElement('div');
    div.className = 'landmark-card';
    if (landmarks[key]) div.classList.add('built');
    
    div.innerHTML = `
      <div class="landmark-emoji">${data.emoji}</div>
      <div class="landmark-name">${data.name}</div>
      <div class="landmark-cost">${data.cost}원</div>
    `;
    container.appendChild(div);
  });
}

function renderMyCards(cards) {
  const container = document.getElementById('myCards');
  container.innerHTML = '';
  
  const totalCards = Object.values(cards).reduce((sum, count) => sum + count, 0);
  if (totalCards === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666;">카드가 없습니다</div>';
    return;
  }
  
  Object.entries(cards).forEach(([key, count]) => {
    if (count === 0) return;
    
    const data = CARDS[key];
    const div = document.createElement('div');
    div.className = `card ${data.color}`;
    
    div.innerHTML = `
      <div class="card-emoji">${data.emoji}</div>
      <div class="card-name">${data.name}</div>
      <div class="card-number">${data.numbers.join(',')}</div>
      ${count > 1 ? `<div class="card-count">×${count}</div>` : ''}
    `;
    container.appendChild(div);
  });
}

function renderOpponents(opponents, currentTurnIndex) {
  const container = document.getElementById('opponentsScroll');
  container.innerHTML = '';
  
  opponents.forEach(opp => {
    const isActive = currentRoom.players[currentTurnIndex].nickname === opp.nickname;
    
    const div = document.createElement('div');
    div.className = 'opponent-card';
    if (isActive) div.classList.add('active');
    
    const landmarksHtml = Object.entries(LANDMARKS).map(([key, data]) => {
      const built = opp.landmarks[key];
      return `<span class="opp-landmark ${built ? 'built' : ''}">${data.emoji}</span>`;
    }).join('');
    
    const cardCount = Object.values(opp.cards).reduce((sum, c) => sum + c, 0);
    
    div.innerHTML = `
      <div class="opp-name">${opp.nickname}</div>
      <div class="opp-money">💰 ${opp.money}원</div>
      <div class="opp-landmarks">${landmarksHtml}</div>
      <div class="opp-cards">카드 ${cardCount}장</div>
    `;
    container.appendChild(div);
  });
}

function showDiceResult(dice) {
  const display = document.getElementById('diceDisplay');
  display.innerHTML = '';
  
  dice.forEach(num => {
    const div = document.createElement('div');
    div.className = 'dice';
    div.textContent = num;
    display.appendChild(div);
  });
  
  const sum = dice.reduce((a, b) => a + b, 0);
  const sumDiv = document.createElement('div');
  sumDiv.className = 'dice-sum';
  sumDiv.textContent = `합계: ${sum}`;
  display.appendChild(sumDiv);
}

function openShop() {
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  const modal = document.getElementById('shopModal');
  
  // 시설 카드
  const cardsContainer = document.getElementById('shopCards');
  cardsContainer.innerHTML = '';
  
  Object.entries(CARDS).forEach(([key, data]) => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    
    const canAfford = me.money >= data.cost;
    const isPurple = data.color === 'purple';
    const hasMax = isPurple && (me.cards[key] || 0) >= 1;
    
    if (!canAfford || hasMax) {
      div.classList.add('disabled');
    }
    
    div.innerHTML = `
      <div class="shop-emoji">${data.emoji}</div>
      <div class="shop-name">${data.name}</div>
      <div class="shop-cost">💰 ${data.cost}원</div>
      <div class="shop-desc">${data.desc}</div>
      ${hasMax ? '<div class="shop-owned">보유중</div>' : ''}
    `;
    
    div.addEventListener('click', () => {
      if (!div.classList.contains('disabled')) {
        purchaseCard(key);
      }
    });
    
    cardsContainer.appendChild(div);
  });
  
  // 랜드마크
  const landmarksContainer = document.getElementById('shopLandmarks');
  landmarksContainer.innerHTML = '';
  
  Object.entries(LANDMARKS).forEach(([key, data]) => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    
    const canAfford = me.money >= data.cost;
    const alreadyBuilt = me.landmarks[key];
    
    if (!canAfford || alreadyBuilt) {
      div.classList.add('disabled');
    }
    
    div.innerHTML = `
      <div class="shop-emoji">${data.emoji}</div>
      <div class="shop-name">${data.name}</div>
      <div class="shop-cost">💰 ${data.cost}원</div>
      <div class="shop-desc">${data.desc}</div>
      ${alreadyBuilt ? '<div class="shop-owned">건설완료</div>' : ''}
    `;
    
    div.addEventListener('click', () => {
      if (!div.classList.contains('disabled')) {
        purchaseLandmark(key);
      }
    });
    
    landmarksContainer.appendChild(div);
  });
  
  modal.classList.add('show');
}

function purchaseCard(cardKey) {
  socket.emit('purchase', {
    roomId: currentRoom.id,
    nickname: myNickname,
    cardType: cardKey,
    isLandmark: false
  });
  
  document.getElementById('shopModal').classList.remove('show');
  
  const card = CARDS[cardKey];
  showLog(`${card.name}을(를) 구매했습니다`);
}

function purchaseLandmark(landmarkKey) {
  socket.emit('purchase', {
    roomId: currentRoom.id,
    nickname: myNickname,
    cardType: landmarkKey,
    isLandmark: true
  });
  
  document.getElementById('shopModal').classList.remove('show');
  
  const landmark = LANDMARKS[landmarkKey];
  showLog(`${landmark.name}을(를) 건설했습니다`);
}
