const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function getRoomData(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;

  let turnPlayerId = null;
  if (room.players.length > 0 && room.started) {
    turnPlayerId = room.players[room.turnIndex].id;
  }

  return {
    roomCode: roomCode,
    hostId: room.hostId,
    started: room.started,
    turnPlayerId: turnPlayerId,
    players: room.players.map(function (p) {
      return {
        id: p.id,
        name: p.name
      };
    }),
    history: room.history
  };
}

function broadcastRoom(roomCode) {
  io.to(roomCode).emit("roomData", getRoomData(roomCode));
}

function nextTurn(room) {
  if (room.players.length === 0) return;
  room.turnIndex++;
  if (room.turnIndex >= room.players.length) {
    room.turnIndex = 0;
  }
}

io.on("connection", function (socket) {
  socket.on("joinRoom", function (data) {
    let name = String(data.name || "").trim().slice(0, 20);
    let roomCode = String(data.roomCode || "").trim().toUpperCase().slice(0, 10);

    if (!name) {
      socket.emit("joinError", "Введите имя");
      return;
    }

    if (!roomCode) {
      socket.emit("joinError", "Введите код комнаты");
      return;
    }

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        hostId: socket.id,
        players: [],
        started: false,
        secretNumber: null,
        turnIndex: 0,
        history: []
      };
    }

    const room = rooms[roomCode];

    if (room.players.length >= 10) {
      socket.emit("joinError", "В комнате уже 10 игроков");
      return;
    }

    const sameName = room.players.find(function (p) {
      return p.name.toLowerCase() === name.toLowerCase();
    });

    if (sameName) {
      socket.emit("joinError", "Такое имя уже занято");
      return;
    }

    room.players.push({
      id: socket.id,
      name: name
    });

    socket.data.roomCode = roomCode;
    socket.data.name = name;

    socket.join(roomCode);

    io.to(roomCode).emit("systemMessage", name + " вошел в комнату");
    broadcastRoom(roomCode);
  });

  socket.on("startGame", function () {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    if (socket.id !== room.hostId) return;

    if (room.players.length < 2) {
      socket.emit("joinError", "Нужно минимум 2 игрока");
      return;
    }

    room.started = true;
    room.secretNumber = Math.floor(Math.random() * 100) + 1;
    room.turnIndex = 0;
    room.history = [];

    io.to(roomCode).emit("systemMessage", "Игра началась. Нужно угадать число от 1 до 100");
    broadcastRoom(roomCode);
  });

  socket.on("makeGuess", function (value) {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.started) return;
    if (room.players.length === 0) return;
    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      socket.emit("joinError", "Сейчас не ваш ход");
      return;
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 100) {
      socket.emit("joinError", "Введите целое число от 1 до 100");
      return;
    }
    let result = "";
    if (number < room.secretNumber) {
      result = "Больше";
    } else if (number > room.secretNumber) {
      result = "Меньше";
    } else {
      result = "Угадал";
    }
    room.history.push({
      playerName: socket.data.name,
      guess: number,
      result: result
    });
    if (result === "Угадал") {
      io.to(roomCode).emit("gameOver", {
        winnerName: socket.data.name,
        secretNumber: room.secretNumber
      });
      room.started = false;
      room.secretNumber = null;
      room.turnIndex = 0;
    } else {
      nextTurn(room);
    }
    broadcastRoom(roomCode);
  });
  socket.on("chatMessage", function (text) {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    text = String(text || "").trim().slice(0, 200);
    if (!text) return;
    io.to(roomCode).emit("chatMessage", {
      name: socket.data.name,
      text: text
    });
  });
  socket.on("disconnect", function () {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    const leavingIndex = room.players.findIndex(function (p) {
      return p.id === socket.id;
    });
    if (leavingIndex !== -1) {
      const leavingPlayer = room.players[leavingIndex];
      io.to(roomCode).emit("systemMessage", leavingPlayer.name + " вышел из комнаты");
      room.players.splice(leavingIndex, 1);
      if (leavingIndex < room.turnIndex) {
        room.turnIndex--;
      }
      if (room.turnIndex < 0) {
        room.turnIndex = 0;
      }
      if (room.turnIndex >= room.players.length) {
        room.turnIndex = 0;
      }
    }
    if (room.players.length > 0 && room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }
    if (room.players.length === 0) {
      delete rooms[roomCode];
      return;
    }
    broadcastRoom(roomCode);
  });
});
server.listen(PORT, function () {
  console.log("SERVER OK http://localhost:" + PORT);
});