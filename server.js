const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// 방 데이터 저장
const rooms = new Map();

// 카드 데이터
const CARDS = {
  wheatField: { cost: 1, numbers: [1], color: 'blue', name: '밀밭' },
  ranch: { cost: 1, numbers: [2], color: 'blue', name: '목장' },
  forest: { cost: 3, numbers: [5], color: 'blue', name: '숲' },
  mine: { cost: 6, numbers: [9], color: 'blue', name: '광산' },
  appleOrchard: { cost: 3, numbers: [10], color: 'blue', name: '사과농원' },
  
  bakery: { cost: 1, numbers: [2, 3], color: 'green', name: '빵집' },
  convenience: { cost: 2, numbers: [4], color: 'green', name: '편의점' },
  cheeseFactory: { cost: 5, numbers: [7], color: 'green', name: '치즈공장' },
  furnitureFactory: { cost: 3, numbers: [8], color: 'green', name: '가구공장' },
  farmMarket: { cost: 2, numbers: [11, 12], color: 'green', name: '농산물시장' },
  
  cafe: { cost: 2, numbers: [3], color: 'red', name: '카페' },
  restaurant: { cost: 3, numbers: [9, 10], color: 'red', name: '레스토랑' },
  
  stadium: { cost: 6, numbers: [6], color: 'purple', name: '경기장' },
  tvStation: { cost: 7, numbers: [6], color: 'purple', name: 'TV방송국' },
  businessCenter: { cost: 8, numbers: [6], color: 'purple', name: '비즈니스센터' }
};

const LANDMARKS = {
  station: { cost: 4, name: '역' },
  mall: { cost: 10, name: '쇼핑몰' },
  park: { cost: 16, name: '놀이공원' },
  radio: { cost: 22, name: '라디오방송국' }
};

// 게임 초기 상태 생성
function createInitialPlayerState(nickname) {
  return {
    nickname,
    money: 3,
    cards: {
      wheatField: 1,
      bakery: 1,
      ranch: 0,
      forest: 0,
      mine: 0,
      appleOrchard: 0,
      convenience: 0,
      cheeseFactory: 0,
      furnitureFactory: 0,
      farmMarket: 0,
      cafe: 0,
      restaurant: 0,
      stadium: 0,
      tvStation: 0,
      businessCenter: 0
    },
    landmarks: {
      station: false,
      mall: false,
      park: false,
      radio: false
    },
    radioUsedThisTurn: false
  };
}

// 방 생성
function createRoom(roomId, hostNickname) {
  return {
    id: roomId,
    host: hostNickname,
    players: [createInitialPlayerState(hostNickname)],
    gameStarted: false,
    currentTurn: 0,
    diceResult: null,
    turnPhase: 'dice', // dice, build
    turnStartState: null
  };
}

// 효과 처리 함수
function processCardEffects(room, diceSum) {
  const currentTurnIndex = room.currentTurn;
  const logs = [];

  // 1단계: 빨간색 카드 (상대 턴에만 작동)
  room.players.forEach((player, idx) => {
    if (idx === currentTurnIndex) return; // 현재 턴 플레이어 제외
    
    let earned = 0;
    const currentPlayer = room.players[currentTurnIndex];
    
    // 카페 (3)
    if (CARDS.cafe.numbers.includes(diceSum)) {
      const count = player.cards.cafe || 0;
      if (count > 0) {
        let perCard = 1;
        if (player.landmarks.mall) perCard += 1;
        const total = perCard * count;
        
        const canTake = Math.min(total, currentPlayer.money);
        earned += canTake;
        currentPlayer.money -= canTake;
        
        if (canTake > 0) {
          logs.push(`☕ ${player.nickname}님이 카페로 ${canTake}원을 받았습니다`);
        }
      }
    }
    
    // 레스토랑 (9~10)
    if (CARDS.restaurant.numbers.includes(diceSum)) {
      const count = player.cards.restaurant || 0;
      if (count > 0) {
        let perCard = 2;
        if (player.landmarks.mall) perCard += 1;
        const total = perCard * count;
        
        const canTake = Math.min(total, currentPlayer.money);
        earned += canTake;
        currentPlayer.money -= canTake;
        
        if (canTake > 0) {
          logs.push(`🍽️ ${player.nickname}님이 레스토랑으로 ${canTake}원을 받았습니다`);
        }
      }
    }
    
    if (earned > 0) {
      player.money += earned;
    }
  });

  // 2단계: 파란색 카드 (모든 플레이어)
  room.players.forEach(player => {
    let earned = 0;
    
    // 밀밭 (1)
    if (CARDS.wheatField.numbers.includes(diceSum)) {
      const count = player.cards.wheatField || 0;
      earned += 1 * count;
    }
    
    // 목장 (2)
    if (CARDS.ranch.numbers.includes(diceSum)) {
      const count = player.cards.ranch || 0;
      earned += 1 * count;
    }
    
    // 숲 (5)
    if (CARDS.forest.numbers.includes(diceSum)) {
      const count = player.cards.forest || 0;
      earned += 1 * count;
    }
    
    // 광산 (9)
    if (CARDS.mine.numbers.includes(diceSum)) {
      const count = player.cards.mine || 0;
      earned += 5 * count;
    }
    
    // 사과농원 (10)
    if (CARDS.appleOrchard.numbers.includes(diceSum)) {
      const count = player.cards.appleOrchard || 0;
      earned += 3 * count;
    }
    
    if (earned > 0) {
      player.money += earned;
      logs.push(`🌾 ${player.nickname}님이 ${earned}원을 받았습니다`);
    }
  });

  // 3단계: 초록색 + 보라색 (현재 턴 플레이어만)
  const currentPlayer = room.players[currentTurnIndex];
  let earned = 0;
  
  // 빵집 (2~3)
  if (CARDS.bakery.numbers.includes(diceSum)) {
    const count = currentPlayer.cards.bakery || 0;
    if (count > 0) {
      let perCard = 1;
      if (currentPlayer.landmarks.mall) perCard += 1;
      earned += perCard * count;
      logs.push(`🍞 빵집: ${perCard * count}원`);
    }
  }
  
  // 편의점 (4)
  if (CARDS.convenience.numbers.includes(diceSum)) {
    const count = currentPlayer.cards.convenience || 0;
    if (count > 0) {
      let perCard = 3;
      if (currentPlayer.landmarks.mall) perCard += 1;
      earned += perCard * count;
      logs.push(`🏪 편의점: ${perCard * count}원`);
    }
  }
  
  // 치즈공장 (7) - 목장당 3원
  if (CARDS.cheeseFactory.numbers.includes(diceSum)) {
    const factoryCount = currentPlayer.cards.cheeseFactory || 0;
    const ranchCount = currentPlayer.cards.ranch || 0;
    if (factoryCount > 0 && ranchCount > 0) {
      const total = factoryCount * ranchCount * 3;
      earned += total;
      logs.push(`🧀 치즈공장: 목장 ${ranchCount}장 × 3원 × ${factoryCount}공장 = ${total}원`);
    }
  }
  
  // 가구공장 (8) - 숲+광산당 3원
  if (CARDS.furnitureFactory.numbers.includes(diceSum)) {
    const factoryCount = currentPlayer.cards.furnitureFactory || 0;
    const forestCount = currentPlayer.cards.forest || 0;
    const mineCount = currentPlayer.cards.mine || 0;
    const resources = forestCount + mineCount;
    if (factoryCount > 0 && resources > 0) {
      const total = factoryCount * resources * 3;
      earned += total;
      logs.push(`🪑 가구공장: (숲${forestCount}+광산${mineCount}) × 3원 × ${factoryCount}공장 = ${total}원`);
    }
  }
  
  // 농산물시장 (11~12) - 밀밭+사과당 2원
  if (CARDS.farmMarket.numbers.includes(diceSum)) {
    const marketCount = currentPlayer.cards.farmMarket || 0;
    const wheatCount = currentPlayer.cards.wheatField || 0;
    const appleCount = currentPlayer.cards.appleOrchard || 0;
    const crops = wheatCount + appleCount;
    if (marketCount > 0 && crops > 0) {
      const total = marketCount * crops * 2;
      earned += total;
      logs.push(`🥕 농산물시장: (밀밭${wheatCount}+사과${appleCount}) × 2원 × ${marketCount}시장 = ${total}원`);
    }
  }
  
  // 경기장 (6) - 모두에게서 2원
  if (CARDS.stadium.numbers.includes(diceSum) && (currentPlayer.cards.stadium || 0) > 0) {
    let total = 0;
    room.players.forEach((player, idx) => {
      if (idx === currentTurnIndex) return;
      const take = Math.min(2, player.money);
      player.money -= take;
      total += take;
    });
    if (total > 0) {
      earned += total;
      logs.push(`🏟️ 경기장: 모두에게서 ${total}원`);
    }
  }
  
  // TV방송국 (6) - 한명에게서 5원
  if (CARDS.tvStation.numbers.includes(diceSum) && (currentPlayer.cards.tvStation || 0) > 0) {
    const opponents = room.players
      .map((p, idx) => ({ player: p, idx }))
      .filter(({idx}) => idx !== currentTurnIndex && room.players[idx].money > 0)
      .sort((a, b) => b.player.money - a.player.money);
    
    if (opponents.length > 0) {
      const target = opponents[0].player;
      const take = Math.min(5, target.money);
      target.money -= take;
      earned += take;
      logs.push(`📺 TV방송국: ${target.nickname}에게서 ${take}원`);
    }
  }
  
  // 비즈니스센터 (6) - 일단 로그만
  if (CARDS.businessCenter.numbers.includes(diceSum) && (currentPlayer.cards.businessCenter || 0) > 0) {
    logs.push(`🏢 비즈니스센터 효과 발동 가능! (구현 예정)`);
  }
  
  if (earned > 0) {
    currentPlayer.money += earned;
    logs.push(`💰 ${currentPlayer.nickname}님이 총 ${earned}원을 받았습니다`);
  }

  return logs;
}

io.on('connection', (socket) => {
  console.log('새 연결:', socket.id);

  // 방 생성
  socket.on('createRoom', ({ roomId, nickname }) => {
    if (rooms.has(roomId)) {
      socket.emit('error', { message: '이미 존재하는 방입니다' });
      return;
    }

    const room = createRoom(roomId, nickname);
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomCreated', { room });
    console.log(`방 생성: ${roomId}, 방장: ${nickname}`);
  });

  // 방 입장
  socket.on('joinRoom', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '존재하지 않는 방입니다' });
      return;
    }

    if (room.gameStarted) {
      // 재접속 확인
      const existingPlayer = room.players.find(p => p.nickname === nickname);
      if (existingPlayer) {
        socket.join(roomId);
        socket.emit('roomJoined', { room, reconnected: true });
        io.to(roomId).emit('gameState', room);
        console.log(`재접속: ${nickname} → ${roomId}`);
        return;
      } else {
        socket.emit('error', { message: '게임이 이미 시작되었습니다' });
        return;
      }
    }

    // 닉네임 중복 확인
    if (room.players.some(p => p.nickname === nickname)) {
      socket.emit('error', { message: '이미 사용 중인 닉네임입니다' });
      return;
    }

    // 최대 인원 확인
    if (room.players.length >= 4) {
      socket.emit('error', { message: '방이 가득 찼습니다' });
      return;
    }

    room.players.push(createInitialPlayerState(nickname));
    socket.join(roomId);
    socket.emit('roomJoined', { room });
    io.to(roomId).emit('playerJoined', { room });
    console.log(`입장: ${nickname} → ${roomId}`);
  });

  // 재접속
  socket.on('rejoinRoom', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '존재하지 않는 방입니다' });
      return;
    }

    const existingPlayer = room.players.find(p => p.nickname === nickname);
    if (existingPlayer) {
      socket.join(roomId);
      socket.emit('roomJoined', { room, reconnected: true });
      console.log(`재접속: ${nickname} → ${roomId}`);
    }
  });

  // 게임 시작
  socket.on('startGame', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    
    if (!room) return;
    if (room.host !== nickname) {
      socket.emit('error', { message: '방장만 시작할 수 있습니다' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: '최소 2명 이상 필요합니다' });
      return;
    }

    room.gameStarted = true;
    room.currentTurn = 0;
    room.turnPhase = 'dice';
    
    // 턴 시작 상태 저장
    room.turnStartState = room.players.map(p => ({
      money: p.money
    }));
    
    io.to(roomId).emit('gameStarted', { room });
    console.log(`게임 시작: ${roomId}`);
  });

  // 주사위 굴리기
  socket.on('rollDice', ({ roomId, nickname, diceCount, isParkBonus }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.nickname !== nickname) return;
    if (room.turnPhase !== 'dice') return;

    const dice = [];
    for (let i = 0; i < diceCount; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1);
    }

    room.diceResult = dice;
    const diceSum = dice.reduce((a, b) => a + b, 0);
    
    // 효과 처리
    const logs = processCardEffects(room, diceSum);
    
    // 더블 체크
    const isDouble = dice.length === 2 && dice[0] === dice[1];
    
    io.to(roomId).emit('diceRolled', { 
      room, 
      dice,
      player: nickname,
      isDouble,
      isParkBonus: isParkBonus || false
    });
    
    // 효과 로그 전송
    if (logs.length > 0) {
      io.to(roomId).emit('effectsApplied', { logs });
    }
    
    // 놀이공원 추가턴이 아닌 경우에만 build 페이즈로 전환
    if (!isDouble || isParkBonus || !currentPlayer.landmarks.park) {
      room.turnPhase = 'build';
      setTimeout(() => {
        io.to(roomId).emit('gameState', room);
      }, logs.length * 1500 + 1000);
    }
    
    console.log(`주사위: ${nickname} - ${dice.join(', ')} (합: ${diceSum})`);
  });

  // 라디오 재굴림 (이전 효과 무효화)
  socket.on('rerollDice', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.nickname !== nickname) return;
    if (!currentPlayer.landmarks.radio) return;
    if (currentPlayer.radioUsedThisTurn) return;

    // 턴 시작 상태로 복원
    if (room.turnStartState) {
      room.players.forEach((player, idx) => {
        player.money = room.turnStartState[idx].money;
      });
    }

    room.diceResult = null;
    room.turnPhase = 'dice';
    currentPlayer.radioUsedThisTurn = true;
    
    io.to(roomId).emit('rerollInitiated', { room });
    console.log(`${nickname}이(가) 라디오 재굴림 사용 - 이전 효과 무효화`);
  });

  // 구매 이벤트
  socket.on('purchase', ({ roomId, nickname, cardType, isLandmark }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;
    if (room.turnPhase !== 'build') return;

    const player = room.players.find(p => p.nickname === nickname);
    if (!player) return;
    if (room.players[room.currentTurn].nickname !== nickname) return;

    const cost = isLandmark ? LANDMARKS[cardType].cost : CARDS[cardType].cost;
    
    if (player.money < cost) {
      socket.emit('error', { message: '돈이 부족합니다' });
      return;
    }

    if (isLandmark) {
      if (player.landmarks[cardType]) {
        socket.emit('error', { message: '이미 건설한 랜드마크입니다' });
        return;
      }
      player.money -= cost;
      player.landmarks[cardType] = true;
      console.log(`${nickname}이(가) ${LANDMARKS[cardType].name} 건설`);
    } else {
      // 보라색 카드는 1장 제한
      const purpleCards = ['stadium', 'tvStation', 'businessCenter'];
      if (purpleCards.includes(cardType) && (player.cards[cardType] || 0) >= 1) {
        socket.emit('error', { message: '보라색 카드는 1장만 구매할 수 있습니다' });
        return;
      }
      
      player.money -= cost;
      player.cards[cardType] = (player.cards[cardType] || 0) + 1;
      console.log(`${nickname}이(가) ${CARDS[cardType].name} 구매`);
    }
    
    io.to(roomId).emit('gameState', room);
    
    // 승리 조건 확인 (랜드마크 구매시)
    if (isLandmark) {
      const landmarks = player.landmarks;
      if (landmarks.station && landmarks.mall && landmarks.park && landmarks.radio) {
        io.to(roomId).emit('gameWon', { winner: nickname });
        console.log(`🎉 ${nickname} 승리!`);
      }
    }
  });

  // 턴 종료
  socket.on('endTurn', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.nickname !== nickname) return;

    // 다음 턴
    room.currentTurn = (room.currentTurn + 1) % room.players.length;
    room.diceResult = null;
    room.turnPhase = 'dice';
    
    // 새 턴 플레이어의 라디오 플래그 초기화
    room.players[room.currentTurn].radioUsedThisTurn = false;
    
    // 턴 시작 시점의 상태 저장 (라디오 재굴림용)
    room.turnStartState = room.players.map(p => ({
      money: p.money
    }));
    
    io.to(roomId).emit('turnChanged', { room });
    console.log(`턴 변경: ${room.players[room.currentTurn].nickname}`);
  });

  socket.on('disconnect', () => {
    console.log('연결 해제:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
