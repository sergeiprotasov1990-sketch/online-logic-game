// @ts-nocheck
const socket = io();

const state = {
  roomCode: "",
  name: "",
  lastRoomData: null
};

const joinScreen = document.getElementById("joinScreen");
const roomScreen = document.getElementById("roomScreen");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");

const roomCodeText = document.getElementById("roomCodeText");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

const playersList = document.getElementById("playersList");
const historyList = document.getElementById("historyList");

const guessInput = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessBtn");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatBtn = document.getElementById("chatBtn");

joinBtn.addEventListener("click", function () {
  const name = nameInput.value.trim();
  const roomCode = roomInput.value.trim().toUpperCase();

  if (!name || !roomCode) {
    alert("Введите имя и код комнаты");
    return;
  }

  state.name = name;
  state.roomCode = roomCode;

  socket.emit("joinRoom", { name: name, roomCode: roomCode });
});

startBtn.addEventListener("click", function () {
  socket.emit("startGame");
});

guessBtn.addEventListener("click", function () {
  const value = guessInput.value;
  socket.emit("makeGuess", value);
  guessInput.value = "";
});

chatBtn.addEventListener("click", sendChat);

chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    sendChat();
  }
});

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chatMessage", text);
  chatInput.value = "";
}

socket.on("joinError", function (message) {
  alert(message);
});

socket.on("roomData", function (data) {
  state.lastRoomData = data;

  if (data.roomCode !== state.roomCode) return;

  joinScreen.classList.add("hidden");
  roomScreen.classList.remove("hidden");

  roomCodeText.textContent = data.roomCode;

  renderPlayers(data);
  renderHistory(data.history);

  const currentTurnPlayer = data.players.find(function (p) {
    return p.id === data.turnPlayerId;
  });

  if (data.started && currentTurnPlayer) {
    statusText.textContent = "Игра идет. Сейчас ходит: " + currentTurnPlayer.name;
  } else {
    statusText.textContent = "Ожидание старта. Хост может начать игру.";
  }

  const isHost = socket.id === data.hostId;
  startBtn.style.display = isHost ? "block" : "none";

  const myTurn = socket.id === data.turnPlayerId;
  guessInput.disabled = !(data.started && myTurn);
  guessBtn.disabled = !(data.started && myTurn);
});

socket.on("systemMessage", function (text) {
  addChatLine("[СИСТЕМА] " + text);
});

socket.on("chatMessage", function (data) {
  addChatLine(data.name + ": " + data.text);
});

socket.on("gameOver", function (data) {
  statusText.textContent =
   "Победил " + data.winnerName + ". Загаданное число: " + data.secretNumber;
});
function renderPlayers(data) {
  playersList.innerHTML = "";
  data.players.forEach(function (player) {
    const li = document.createElement("li");
    let text = player.name;
    if (player.id === data.hostId) {
      text += " (хост)";
    }
    if (player.id === data.turnPlayerId && data.started) {
      text += " (ходит)";
    }
    li.textContent = text;
    playersList.appendChild(li);
  });
}
function renderHistory(history) {
  historyList.innerHTML = "";
  history.forEach(function (item) {
    const li = document.createElement("li");
    li.textContent = item.playerName + ": " + item.guess + " - " + item.result;
    historyList.appendChild(li);
  });
}
function addChatLine(text) {
  const div = document.createElement("div");
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}