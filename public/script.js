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
let lastDiceRoll = null; // 마지막 주사위 결과 저장

// 화면 전환
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// 로그 표시
function showLog(message, duration = 3000) {
  const log = document.getElementById('gameLog');
  log.textContent = message;
  log.classList.add('show');
  setTimeout(() => log.classList.remove('show'), duration);
}

// 에러 표시
function showError(message) {
  const err = document.getElementById('lobbyError');
  err.textContent = message;
  err.classList.add('show');
  setTimeout(() => err.classList.remove('show'), 3000);
}

// 로비 이벤트
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

// 게임 시작
document.getElementById('startGameBtn').addEventListener('click', () => {
  socket.emit('startGame', { roomId: currentRoom.id, nickname: myNickname });
});

// 주사위
document.getElementById('roll1').addEventListener('click', () => {
  radioUsedThisTurn = false; // 새로운 주사위 굴림시 라디오 플래그 리셋
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 1 });
  hideAllDiceButtons();
});

document.getElementById('roll2').addEventListener('click', () => {
  radioUsedThisTurn = false;
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 2 });
  hideAllDiceButtons();
});

// 라디오 재굴림 버튼
document.getElementById('reroll').addEventListener('click', () => {
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  
  if (me.landmarks.radio && !radioUsedThisTurn && lastDiceRoll) {
    radioUsedThisTurn = true;
    socket.emit('rerollDice', { roomId: currentRoom.id, nickname: myNickname });
    hideAllDiceButtons();
    showLog('📻 라디오방송국 효과로 재굴림합니다');
  }
});

// 놀이공원 추가턴 버튼 (더블 굴렸을 때)
document.getElementById('parkReroll').addEventListener('click', () => {
  socket.emit('rollDice', { 
    roomId: currentRoom.id, 
    nickname: myNickname, 
    diceCount: 1, 
    isParkBonus: true 
  });
  hideAllDiceButtons();
});

function hideAllDiceButtons() {
  document.getElementById('roll1').style.display = 'none';
  document.getElementById('roll2').style.display = 'none';
  document.getElementById('reroll').style.display = 'none';
  document.getElementById('parkReroll').style.display = 'none';
}

// 턴 종료
document.getElementById('endTurnBtn').addEventListener('click', () => {
  socket.emit('endTurn', { roomId: currentRoom.id, nickname: myNickname });
  radioUsedThisTurn = false;
  lastDiceRoll = null;
});

// 상점
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

// 상점 탭
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

// 소켓 이벤트
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
  updatePlayersList(room);
});

socket.on('gameStarted', ({ room }) => {
  currentRoom = room;
  radioUsedThisTurn = false;
  lastDiceRoll = null;
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
  
  // 효과는 서버에서 처리하므로 gameState 업데이트 대기
  // 더블 체크 (놀이공원 효과)
  const rolledDouble = dice.length === 2 && dice[0] === dice[1];
  
  if (isMyTurn && rolledDouble && me.landmarks.park && !isParkBonus) {
    // 효과 처리 후 놀이공원 추가턴 버튼 표시
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
  
  // 주사위 버튼 다시 표시
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
  // 서버에서 처리된 효과 로그 표시
  if (logs && logs.length > 0) {
    logs.forEach((log, idx) => {
      setTimeout(() => showLog(log, 2000), idx * 1500);
    });
  }
});

// 대기실 표시
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

// 게임 화면 표시
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
  
  // 카드가 없으면 안내 메시지
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

// 연결 끊김 처리
socket.on('disconnect', () => {
  showError('서버와의 연결이 끊어졌습니다');
});

socket.on('connect', () => {
  if (currentRoom && myNickname) {
    // 재연결 시도
    socket.emit('rejoinRoom', { 
      roomId: currentRoom.id, 
      nickname: myNickname 
    });
  }
});
// 화면 전환
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// 로그 표시
function showLog(message, duration = 3000) {
  const log = document.getElementById('gameLog');
  log.textContent = message;
  log.classList.add('show');
  setTimeout(() => log.classList.remove('show'), duration);
}

// 에러 표시
function showError(message) {
  const err = document.getElementById('lobbyError');
  err.textContent = message;
  err.classList.add('show');
  setTimeout(() => err.classList.remove('show'), 3000);
}

// 로비 이벤트
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

// 게임 시작
document.getElementById('startGameBtn').addEventListener('click', () => {
  socket.emit('startGame', { roomId: currentRoom.id, nickname: myNickname });
});

// 주사위
document.getElementById('roll1').addEventListener('click', () => {
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 1 });
  document.getElementById('roll1').style.display = 'none';
  document.getElementById('roll2').style.display = 'none';
  document.getElementById('reroll').style.display = 'none';
});

document.getElementById('roll2').addEventListener('click', () => {
  socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 2 });
  document.getElementById('roll1').style.display = 'none';
  document.getElementById('roll2').style.display = 'none';
  document.getElementById('reroll').style.display = 'none';
});

document.getElementById('reroll').addEventListener('click', () => {
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  
  // 라디오방송국 재굴림인지 확인
  if (me.landmarks.radio && !radioUsedThisTurn) {
    // 라디오 재굴림: 이전 효과 무효화
    radioUsedThisTurn = true;
    socket.emit('rerollDice', { roomId: currentRoom.id, nickname: myNickname });
    showLog('📻 라디오방송국 효과로 이전 결과가 취소되었습니다');
  } else {
    // 더블 재굴림: 이전 효과 유지
    socket.emit('rollDice', { roomId: currentRoom.id, nickname: myNickname, diceCount: 1, isDouble: true });
  }
  
  document.getElementById('reroll').style.display = 'none';
});

// 턴 종료
document.getElementById('endTurnBtn').addEventListener('click', () => {
  socket.emit('endTurn', { roomId: currentRoom.id, nickname: myNickname });
});

// 상점
document.getElementById('shopBtn').addEventListener('click', () => {
  openShop();
});

document.querySelector('#shopModal .modal-close').addEventListener('click', () => {
  document.getElementById('shopModal').classList.remove('show');
});

document.getElementById('backToLobby').addEventListener('click', () => {
  location.reload();
});

// 상점 탭
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

// 소켓 이벤트
socket.on('roomCreated', ({ room }) => {
  currentRoom = room;
  showWaitingRoom(room);
});

socket.on('roomJoined', ({ room, reconnected }) => {
  currentRoom = room;
  if (room.gameStarted) {
    showGameScreen(room);
  } else {
    showWaitingRoom(room);
  }
});

socket.on('playerJoined', ({ room }) => {
  currentRoom = room;
  updatePlayersList(room);
});

socket.on('gameStarted', ({ room }) => {
  currentRoom = room;
  showGameScreen(room);
});

socket.on('diceRolled', ({ room, dice, player, isDouble }) => {
  currentRoom = room;
  showDiceResult(dice);
  
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  const isMyTurn = player === myNickname;
  
  // 효과 처리 (현재 턴 플레이어만)
  setTimeout(() => {
    if (isMyTurn) {
      processEffects(room, dice);
    }
    
    // 더블인지 확인
    const rolledDouble = dice.length === 2 && dice[0] === dice[1];
    
    // 더블이 나오고 놀이공원이 있으면 추가 턴
    if (!isDouble && rolledDouble && me && me.landmarks.park && isMyTurn) {
      showLog('🎡 놀이공원 효과! 한 번 더 굴릴 수 있습니다');
      setTimeout(() => {
        // 놀이공원 재굴림 버튼들 표시
        document.getElementById('roll1').style.display = 'block';
        if (me.landmarks.station) {
          document.getElementById('roll2').style.display = 'block';
        }
        document.getElementById('reroll').style.display = 'block';
      }, 1000);
    } else if (!isMyTurn) {
      // 내 턴이 아니면 화면만 업데이트
      updateGameScreen(room);
    }
    // 내 턴이면 processEffects에서 effectsProcessed를 emit하고
    // 서버에서 gameState를 받아서 자동으로 build 페이즈로 전환됨
  }, 1000);
});

// 라디오 재굴림 이벤트 추가
socket.on('rerollInitiated', ({ room }) => {
  currentRoom = room;
  updateGameScreen(room);
  
  // 주사위 버튼 다시 표시
  const me = room.players.find(p => p.nickname === myNickname);
  document.getElementById('roll1').style.display = 'block';
  if (me.landmarks.station) {
    document.getElementById('roll2').style.display = 'block';
  }
});

// 재굴림 이벤트 추가
socket.on('rerollInitiated', ({ room }) => {
  currentRoom = room;
  // 화면 상태만 업데이트 (효과는 무효화됨)
  updateGameScreen(room);
});

socket.on('gameState', (room) => {
  currentRoom = room;
  updateGameScreen(room);
  console.log(`게임 상태 업데이트 - 턴: ${room.players[room.currentTurn].nickname}, 페이즈: ${room.turnPhase}`);
});

socket.on('turnChanged', ({ room }) => {
  currentRoom = room;
  radioUsedThisTurn = false; // 턴이 바뀌면 라디오 사용 플래그 초기화
  updateGameScreen(room);
  
  const currentPlayer = room.players[room.currentTurn];
  showLog(`${currentPlayer.nickname}님의 턴입니다`);
});

socket.on('gameWon', ({ winner }) => {
  document.getElementById('winnerName').textContent = winner;
  document.getElementById('winModal').classList.add('show');
});

socket.on('error', ({ message }) => {
  showError(message);
});

// 대기실 표시
function showWaitingRoom(room) {
  showScreen('waitingRoom');
  document.getElementById('roomCode').textContent = room.id;
  updatePlayersList(room);
  
  if (room.host === myNickname) {
    document.getElementById('startGameBtn').style.display = 'block';
    document.querySelector('.waiting-msg').style.display = 'none';
  }
}

function updatePlayersList(room) {
  const list = document.getElementById('playersList');
  list.innerHTML = '';
  
  room.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-item';
    if (player.nickname === room.host) div.classList.add('host');
    div.textContent = player.nickname;
    list.appendChild(div);
  });
}

// 게임 화면 표시
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
  
  
  // 주사위 버튼
  if (isMyTurn && room.turnPhase === 'dice') {
    document.getElementById('roll1').style.display = 'block';
    
    // 기차역이 있으면 2개 굴리기 버튼 표시
    if (me.landmarks.station) {
      document.getElementById('roll2').style.display = 'block';
    } else {
      document.getElementById('roll2').style.display = 'none';
    }
    
    // 라디오방송국 재굴림 버튼: 주사위를 이미 굴렸고, 아직 사용 안 했을 때
    if (me.landmarks.radio && !radioUsedThisTurn && room.diceResult && room.diceResult.length > 0) {
      document.getElementById('reroll').style.display = 'block';
    } else {
      document.getElementById('reroll').style.display = 'none';
    }
  } else {
    document.getElementById('roll1').style.display = 'none';
    document.getElementById('roll2').style.display = 'none';
    document.getElementById('reroll').style.display = 'none';
  }
  
  

  // 건설 버튼 (내 턴이고 build 페이즈일 때만 활성화)
  const canBuild = isMyTurn && room.turnPhase === 'build';
  document.getElementById('shopBtn').disabled = !canBuild;
  document.getElementById('endTurnBtn').disabled = !canBuild;
  
  // 버튼 스타일도 명확하게
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
      <span class="emoji">${data.emoji}</span>
      <div class="name">${data.name}</div>
      <div class="cost">${data.cost}원</div>
    `;
    container.appendChild(div);
  });
}

function renderMyCards(cards) {
  const container = document.getElementById('myCards');
  container.innerHTML = '';
  
  Object.entries(cards).forEach(([key, count]) => {
    if (count === 0) return;
    
    const data = CARDS[key];
    const div = document.createElement('div');
    div.className = `card ${data.color}`;
    
    div.innerHTML = `
      <span class="emoji">${data.emoji}</span>
      <div class="name">${data.name}</div>
      <div class="number">${data.numbers.join(',')}</div>
      ${count > 1 ? `<div class="count">${count}</div>` : ''}
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
      return `<div class="landmark-icon ${built ? 'built' : ''}">${data.emoji}</div>`;
    }).join('');
    
    const cardCount = Object.values(opp.cards).reduce((sum, c) => sum + c, 0);
    
    div.innerHTML = `
      <div class="opponent-name">${opp.nickname}</div>
      <div class="opponent-money">💰 ${opp.money}원</div>
      <div class="opponent-landmarks">${landmarksHtml}</div>
      <div class="opponent-cards">카드 ${cardCount}장</div>
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
}

// [교체 후 - 새로운 함수]
// 위의 주석 처리된 함수를 지우고 아래 함수로 교체하세요

function processEffects(room, dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const currentTurnIndex = room.currentTurn;
  const updates = [];

  // 1단계: 빨간색 카드 (상대 턴에만)
  room.players.forEach((player, idx) => {
    if (idx === currentTurnIndex) return; // 현재 턴 플레이어 제외
    
    let earned = 0;
    const currentPlayer = room.players[currentTurnIndex];
    
    // 카페 (3)
    if (CARDS.cafe.numbers.includes(sum)) {
      const count = player.cards.cafe || 0;
      let perCard = 1;
      if (player.landmarks.mall) perCard += 1;
      const total = perCard * count;
      
      const canTake = Math.min(total, currentPlayer.money);
      earned += canTake;
      currentPlayer.money -= canTake;
      
      if (canTake > 0) showLog(`${player.nickname}님이 카페로 ${canTake}원을 받았습니다`);
    }
    
    // 레스토랑 (9~10)
    if (CARDS.restaurant.numbers.includes(sum)) {
      const count = player.cards.restaurant || 0;
      let perCard = 2;
      if (player.landmarks.mall) perCard += 1;
      const total = perCard * count;
      
      const canTake = Math.min(total, currentPlayer.money);
      earned += canTake;
      currentPlayer.money -= canTake;
      
      if (canTake > 0) showLog(`${player.nickname}님이 레스토랑으로 ${canTake}원을 받았습니다`);
    }
    
    player.money += earned;
  });

  // 2단계: 파란색 카드 (모든 플레이어)
  room.players.forEach(player => {
    let earned = 0;
    
    Object.entries(player.cards).forEach(([key, count]) => {
      const card = CARDS[key];
      if (card.color === 'blue' && card.numbers.includes(sum)) {
        if (key === 'wheatField') earned += 1 * count;
        else if (key === 'ranch') earned += 1 * count;
        else if (key === 'forest') earned += 1 * count;
        else if (key === 'mine') earned += 5 * count;
        else if (key === 'appleOrchard') earned += 3 * count;
      }
    });
    
    if (earned > 0) {
      player.money += earned;
      showLog(`${player.nickname}님이 ${earned}원을 받았습니다`);
    }
  });

  // 3단계: 초록색 + 보라색 (현재 턴 플레이어만)
  const currentPlayer = room.players[currentTurnIndex];
  let earned = 0;
  
  // 초록색 기본 카드
  if (CARDS.bakery.numbers.includes(sum)) {
    const count = currentPlayer.cards.bakery || 0;
    let perCard = 1;
    if (currentPlayer.landmarks.mall) perCard += 1;
    earned += perCard * count;
  }
  
  if (CARDS.convenience.numbers.includes(sum)) {
    const count = currentPlayer.cards.convenience || 0;
    let perCard = 3;
    if (currentPlayer.landmarks.mall) perCard += 1;
    earned += perCard * count;
  }
  
  // 치즈 공장 (7) - 목장당 3원
  if (CARDS.cheeseFactory.numbers.includes(sum)) {
    const factoryCount = currentPlayer.cards.cheeseFactory || 0;
    const ranchCount = currentPlayer.cards.ranch || 0;
    earned += factoryCount * ranchCount * 3;
    if (factoryCount > 0 && ranchCount > 0) {
      showLog(`치즈공장 효과: 목장 ${ranchCount}장 × 3원 × ${factoryCount}공장`);
    }
  }
  
  // 가구 공장 (8) - 숲+광산당 3원
  if (CARDS.furnitureFactory.numbers.includes(sum)) {
    const factoryCount = currentPlayer.cards.furnitureFactory || 0;
    const forestCount = currentPlayer.cards.forest || 0;
    const mineCount = currentPlayer.cards.mine || 0;
    const resources = forestCount + mineCount;
    earned += factoryCount * resources * 3;
    if (factoryCount > 0 && resources > 0) {
      showLog(`가구공장 효과: (숲${forestCount}+광산${mineCount}) × 3원 × ${factoryCount}공장`);
    }
  }
  
  // 농산물 시장 (11~12) - 밀밭+사과당 2원
  if (CARDS.farmMarket.numbers.includes(sum)) {
    const marketCount = currentPlayer.cards.farmMarket || 0;
    const wheatCount = currentPlayer.cards.wheatField || 0;
    const appleCount = currentPlayer.cards.appleOrchard || 0;
    const crops = wheatCount + appleCount;
    earned += marketCount * crops * 2;
    if (marketCount > 0 && crops > 0) {
      showLog(`농산물시장 효과: (밀밭${wheatCount}+사과${appleCount}) × 2원 × ${marketCount}시장`);
    }
  }
  
  // 보라색 카드
  // 경기장 (6) - 모두에게서 2원
  if (CARDS.stadium.numbers.includes(sum) && (currentPlayer.cards.stadium || 0) > 0) {
    room.players.forEach((player, idx) => {
      if (idx === currentTurnIndex) return;
      const take = Math.min(2, player.money);
      player.money -= take;
      earned += take;
    });
    showLog(`경기장 효과: 모두에게서 각 2원씩`);
  }
  
  // TV방송국 (6) - 한명에게서 5원
  if (CARDS.tvStation.numbers.includes(sum) && (currentPlayer.cards.tvStation || 0) > 0) {
    // 돈이 가장 많은 상대 선택
    const opponents = room.players
      .map((p, idx) => ({ player: p, idx }))
      .filter(({idx}) => idx !== currentTurnIndex && room.players[idx].money > 0)
      .sort((a, b) => b.player.money - a.player.money);
    
    if (opponents.length > 0) {
      const target = opponents[0].player;
      const take = Math.min(5, target.money);
      target.money -= take;
      earned += take;
      showLog(`TV방송국 효과: ${target.nickname}에게서 ${take}원`);
    }
  }
  
  // 비즈니스센터 (6) - 카드 교환 (UI 상호작용 필요하므로 일단 패스)
  if (CARDS.businessCenter.numbers.includes(sum) && (currentPlayer.cards.businessCenter || 0) > 0) {
    showLog(`비즈니스센터 효과 발동 가능! (구현 예정)`);
  }
  
  currentPlayer.money += earned;

  // 서버에 효과 처리 완료 알림
  socket.emit('effectsProcessed', { 
    roomId: room.id, 
    nickname: myNickname,
    updates: room.players.map(p => ({
      nickname: p.nickname,
      money: p.money
    }))
  });
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
    if (me.money < data.cost) div.classList.add('disabled');
    
    // 보라색은 1장 제한
    if (data.color === 'purple' && me.cards[key] >= 1) {
      div.classList.add('disabled');
    }
    
    div.innerHTML = `
      <span class="emoji">${data.emoji}</span>
      <div class="name">${data.name}</div>
      <div class="cost">💰 ${data.cost}원</div>
      <div class="desc">${data.desc}</div>
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
    if (me.money < data.cost || me.landmarks[key]) div.classList.add('disabled');
    
    div.innerHTML = `
      <span class="emoji">${data.emoji}</span>
      <div class="name">${data.name}</div>
      <div class="cost">💰 ${data.cost}원</div>
      <div class="desc">${data.desc}</div>
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
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  const card = CARDS[cardKey];
  
  if (me.money >= card.cost) {
    me.money -= card.cost;
    me.cards[cardKey] = (me.cards[cardKey] || 0) + 1;
    
    socket.emit('purchase', { 
      roomId: currentRoom.id, 
      nickname: myNickname,
      cardType: cardKey,
      isLandmark: false
    });
    
    document.getElementById('shopModal').classList.remove('show');
    updateGameScreen(currentRoom);
    showLog(`${card.name}을(를) 구매했습니다`);
  }
}

function purchaseLandmark(landmarkKey) {
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  const landmark = LANDMARKS[landmarkKey];
  
  if (me.money >= landmark.cost && !me.landmarks[landmarkKey]) {
    me.money -= landmark.cost;
    me.landmarks[landmarkKey] = true;
    
    socket.emit('purchase', { 
      roomId: currentRoom.id, 
      nickname: myNickname,
      cardType: landmarkKey,
      isLandmark: true
    });
    
    document.getElementById('shopModal').classList.remove('show');
    updateGameScreen(currentRoom);
    showLog(`${landmark.name}을(를) 건설했습니다`);
    
    // 승리 조건 확인
    if (me.landmarks.station && me.landmarks.mall && 
        me.landmarks.park && me.landmarks.radio) {
      socket.emit('endTurn', { roomId: currentRoom.id, nickname: myNickname });
    }
  }
                       }
