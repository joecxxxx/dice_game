// ✅ Clean server.js for Render deployment

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000; // Render uses dynamic ports

const games = {}; // In-memory game store

// Create game route
app.post('/create-game', (req, res) => {
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  games[gameId] = {
    players: [],
    pot: 0,
    turnIndex: 0,
    state: 'lobby',
    roundScore: 0
  };
  res.json({ gameId });
});

// Join game route
app.post('/join-game', (req, res) => {
  const { gameId, playerName } = req.body;
  const game = games[gameId];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.state !== 'lobby') return res.status(400).json({ error: 'Game already started' });
  res.json({ success: true });
});

io.on('connection', (socket) => {
  socket.on('joinGame', ({ gameId, playerName }) => {
    const game = games[gameId];
    if (!game) return;
    const player = { id: socket.id, name: playerName, coins: 25, score: 0 };
    game.players.push(player);
    socket.join(gameId);
    io.to(gameId).emit('updatePlayers', game.players);
  });

  socket.on('startGame', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    game.state = 'playing';
    game.roundScore = 0;
    io.to(gameId).emit('gameStarted');
    io.to(gameId).emit('yourTurn', game.players[game.turnIndex].id);
  });

  socket.on('rollDice', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    const currentPlayer = game.players[game.turnIndex];
    const roll = Math.floor(Math.random() * 6) + 1;
    if (roll === 1) {
      game.roundScore = 0;
      currentPlayer.coins -= 1;
      game.pot += 1;
      io.to(gameId).emit('diceResult', { roll, roundScore: 0 });
      setTimeout(() => {
        game.turnIndex = (game.turnIndex + 1) % game.players.length;
        io.to(gameId).emit('yourTurn', game.players[game.turnIndex].id);
        io.to(gameId).emit('updatePlayers', game.players);
      }, 1500);
    } else {
      game.roundScore += roll;
      io.to(gameId).emit('diceResult', { roll, roundScore: game.roundScore });
    }
  });

  socket.on('hold', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    const currentPlayer = game.players[game.turnIndex];
    if (currentPlayer.score + game.roundScore === 100) {
      currentPlayer.score = 100;
      currentPlayer.coins += game.pot;
      game.pot = 0;
      io.to(gameId).emit('gameOver', currentPlayer.name);
      return;
    } else if (currentPlayer.score + game.roundScore > 100 || currentPlayer.score + game.roundScore === 99) {
      currentPlayer.coins -= 1;
      game.pot += 1;
    } else {
      currentPlayer.score += game.roundScore;
    }
    game.roundScore = 0;
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    io.to(gameId).emit('updatePlayers', game.players);
    io.to(gameId).emit('yourTurn', game.players[game.turnIndex].id);
  });

  socket.on('playAgain', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    game.state = 'playing';
    game.roundScore = 0;
    game.pot = 0;
    game.turnIndex = 0;
    for (const player of game.players) {
      // Keep coins as-is
      player.score = 0;
    }
    io.to(gameId).emit('updatePlayers', game.players);
    io.to(gameId).emit('gameStarted');
    io.to(gameId).emit('yourTurn', game.players[game.turnIndex].id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
