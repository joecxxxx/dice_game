// ==============================
// 📦 Backend: Node.js + Socket.IO
// ==============================
// Save as: server.js

// ... [unchanged backend code] ...

    socket.on('hold', gameId => {
      const game = games[gameId];
      if (!game) return;
      const currentPlayer = game.players[game.turnIndex];

      if (currentPlayer.score + game.roundScore === 100) {
        currentPlayer.score = 100;
        currentPlayer.coins += game.pot;
        game.pot = 0;
        io.to(gameId).emit('gameOver', currentPlayer.name);
        return; // Stop further turn processing
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

    socket.on('playAgain', gameId => {
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


<!-- index.html -->
<!-- ... [unchanged HTML head + styles + layout] ... -->

<script>
  // ... [existing JS code] ...

  socket.on('gameOver', winnerName => {
    alert(`${winnerName} has won the game and the pot!`);
    const again = confirm("Play again with the same players?");
    if (again) socket.emit('playAgain', currentGameId);
  });

  // ... [rest of JS code] ...
</script>
// JavaScript Document