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

// 상태
let myNickname = '';
let currentRoom = null;
let undoStack = [];
let radioUsed = false;

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
  // 재굴림 로직 - 이전 효과 무효화
  radioUsed = true;
  document.getElementById('reroll').style.display = 'none';
  
  // 서버에 재굴림 상태 전송 (이전 효과 취소)
  socket.emit('rerollDice', { roomId: currentRoom.id, nickname: myNickname });
  
  // 주사위 버튼 다시 표시
  document.getElementById('roll1').style.display = 'block';
  const me = currentRoom.players.find(p => p.nickname === myNickname);
  if (me.landmarks.station) {
    document.getElementById('roll2').style.display = 'block';
  }
  
  showLog('이전 주사위 효과가 취소되었습니다. 다시 굴려주세요.');
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

socket.on('diceRolled', ({ room, dice, player }) => {
  currentRoom = room;
  showDiceResult(dice);
  
  // 효과 처리
  setTimeout(() => {
    processEffects(room, dice);
  }, 1000);
});

socket.on('gameState', (room) => {
  currentRoom = room;
  updateGameScreen(room);
});

socket.on('turnChanged', ({ room }) => {
  currentRoom = room;
  radioUsed = false;
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
    document.getElementById('roll2').style.display = 'none';
    document.getElementById('reroll').style.display = 'none';
    
    if (me.landmarks.station) {
      document.getElementById('roll2').style.display = 'block';
    }
    
    if (me.landmarks.radio && !radioUsed && room.diceResult) {
      document.getElementById('reroll').style.display = 'block';
    }
  } else {
    document.getElementById('roll1').style.display = 'none';
    document.getElementById('roll2').style.display = 'none';
    document.getElementById('reroll').style.display = 'none';
  }
  
  
  // 건설 버튼
  document.getElementById('shopBtn').disabled = !(isMyTurn && room.turnPhase === 'build');
  document.getElementById('endTurnBtn').disabled = !(isMyTurn && room.turnPhase === 'build');
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

  // 모든 플레이어 상태 업데이트
  room.players.forEach(player => {
    updates.push({
      nickname: player.nickname,
      money: player.money
    });
  });

  socket.emit('effectsProcessed', { roomId: room.id, updates });
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
