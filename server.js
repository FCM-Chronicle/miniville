const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// 방 데이터 저장
const rooms = new Map();

// 게임 초기 상태 생성
function createInitialPlayerState(nickname) {
  return {
    nickname,
    money: 3,
    cards: {
      wheatField: 1,
      bakery: 1
    },
    landmarks: {
      station: false,
      mall: false,
      park: false,
      radio: false
    }
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
    turnPhase: 'dice' // dice, build, end
  };
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
    io.to(roomId).emit('gameStarted', { room });
    console.log(`게임 시작: ${roomId}`);
  });

  // 주사위 굴리기
  socket.on('rollDice', ({ roomId, nickname, diceCount }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.nickname !== nickname) return;

    const dice = [];
    for (let i = 0; i < diceCount; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1);
    }

    room.diceResult = dice;
    room.turnPhase = 'effects';
    
    io.to(roomId).emit('diceRolled', { 
      room, 
      dice,
      player: nickname 
    });
  });

  // 효과 처리 완료
  socket.on('effectsProcessed', ({ roomId, updates }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // 플레이어 상태 업데이트
    updates.forEach(update => {
      const player = room.players.find(p => p.nickname === update.nickname);
      if (player) {
        player.money = update.money;
      }
    });

    room.turnPhase = 'build';
    io.to(roomId).emit('gameState', room);
  });

  // 구매
  socket.on('purchase', ({ roomId, nickname, cardType, isLandmark }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.nickname === nickname);
    if (!player) return;

    // 가격 확인 및 구매 처리
    // (실제 구현에서는 카드 가격 데이터 필요)
    
    io.to(roomId).emit('gameState', room);
  });

  // 턴 종료
  socket.on('endTurn', ({ roomId, nickname }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.nickname !== nickname) return;

    // 승리 조건 확인
    const landmarks = currentPlayer.landmarks;
    if (landmarks.station && landmarks.mall && landmarks.park && landmarks.radio) {
      io.to(roomId).emit('gameWon', { winner: nickname });
      return;
    }

    // 다음 턴
    room.currentTurn = (room.currentTurn + 1) % room.players.length;
    room.diceResult = null;
    room.turnPhase = 'dice';
    
    io.to(roomId).emit('turnChanged', { room });
  });

  socket.on('disconnect', () => {
    console.log('연결 해제:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
