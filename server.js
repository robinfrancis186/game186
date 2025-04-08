const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve static files from public directory
app.use(express.static('public'));

// Game state
const gameState = {
    players: {},
    projectiles: [],
    powerUps: [],
    flags: {},
    gameMode: 'deathmatch', // 'deathmatch', 'team_deathmatch', 'capture_the_flag'
    teams: {
        red: [],
        blue: []
    },
    scores: {
        red: 0,
        blue: 0
    },
    leaderboard: []
};

// Game settings
const GAME_SETTINGS = {
    bulletSpeed: 15,
    bulletLifetime: 2000, // milliseconds
    bulletDamage: 20,
    mapWidth: 800,
    mapHeight: 600
};

// Power-up types and their effects
const POWER_UPS = {
    health: { type: 'health', value: 50, duration: 0 },
    speed: { type: 'speed', value: 1.5, duration: 10000 },
    damage: { type: 'damage', value: 2, duration: 10000 },
    shield: { type: 'shield', value: 50, duration: 10000 }
};

// Spawn power-ups
function spawnPowerUp() {
    const types = Object.keys(POWER_UPS);
    const type = types[Math.floor(Math.random() * types.length)];
    const powerUp = {
        ...POWER_UPS[type],
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * 700 + 50,
        y: Math.random() * 500 + 50
    };
    gameState.powerUps.push(powerUp);
    io.emit('powerUpSpawned', powerUp);
}

// Spawn flags for CTF
function spawnFlags() {
    gameState.flags = {
        red: { x: 100, y: 300, carrier: null },
        blue: { x: 700, y: 300, carrier: null }
    };
    io.emit('flagsSpawned', gameState.flags);
}

// Update leaderboard
function updateLeaderboard() {
    gameState.leaderboard = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    io.emit('leaderboardUpdate', gameState.leaderboard);
}

// Update game state
function updateGame() {
    // Update projectiles
    gameState.projectiles = gameState.projectiles.filter(projectile => {
        // Move projectile
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;
        
        // Check if projectile is out of bounds
        if (projectile.x < 0 || projectile.x > GAME_SETTINGS.mapWidth ||
            projectile.y < 0 || projectile.y > GAME_SETTINGS.mapHeight) {
            return false;
        }
        
        // Check if projectile has expired
        if (Date.now() - projectile.createdAt > GAME_SETTINGS.bulletLifetime) {
            return false;
        }
        
        // Check for collisions with players
        Object.entries(gameState.players).forEach(([id, player]) => {
            if (player.team !== projectile.team) {
                const dx = player.x - projectile.x;
                const dy = player.y - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 20) { // Hit radius
                    player.health -= GAME_SETTINGS.bulletDamage;
                    
                    // Handle player death
                    if (player.health <= 0) {
                        handlePlayerDeath(id, projectile.playerId);
                    }
                    
                    // Emit hit event
                    io.emit('playerHit', {
                        playerId: id,
                        damage: GAME_SETTINGS.bulletDamage,
                        x: projectile.x,
                        y: projectile.y
                    });
                    
                    return false;
                }
            }
        });
        
        return true;
    });
    
    // Emit updated game state
    io.emit('gameState', gameState);
}

function handlePlayerDeath(targetId, killerId) {
    const target = gameState.players[targetId];
    const killer = gameState.players[killerId];
    
    // Reset target's health and position
    target.health = 100;
    target.x = Math.random() * (GAME_SETTINGS.mapWidth - 100) + 50;
    target.y = Math.random() * (GAME_SETTINGS.mapHeight - 100) + 50;
    target.deaths++;
    
    // Update killer's score
    if (killer) {
        killer.kills++;
        killer.score += 100;
        
        // Team scoring
        if (gameState.gameMode === 'team_deathmatch' || gameState.gameMode === 'capture_the_flag') {
            if (killer.team !== target.team) {
                gameState.scores[killer.team]++;
            }
        }
    }
    
    updateLeaderboard();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle player join
    socket.on('playerJoin', (data) => {
        const team = gameState.gameMode === 'team_deathmatch' || gameState.gameMode === 'capture_the_flag'
            ? gameState.teams.red.length <= gameState.teams.blue.length ? 'red' : 'blue'
            : null;

        if (team) {
            gameState.teams[team].push(socket.id);
        }

        gameState.players[socket.id] = {
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
            health: 100,
            armor: 100,
            ammo: 100,
            name: data.name,
            team: team,
            score: 0,
            kills: 0,
            deaths: 0,
            powerUps: {}
        };

        io.emit('gameState', gameState);
    });

    // Handle player movement
    socket.on('playerMove', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            io.emit('gameState', gameState);
        }
    });

    // Handle player shoot
    socket.on('playerShoot', (data) => {
        if (gameState.players[socket.id]) {
            const player = gameState.players[socket.id];
            
            // Create new projectile
            const projectile = {
                ...data.bullet,
                playerId: socket.id,
                id: Math.random().toString(36).substr(2, 9)
            };
            
            gameState.projectiles.push(projectile);
        }
    });

    // Handle power-up collection
    socket.on('collectPowerUp', (data) => {
        const powerUpIndex = gameState.powerUps.findIndex(p => p.id === data.powerUpId);
        if (powerUpIndex !== -1) {
            const powerUp = gameState.powerUps[powerUpIndex];
            const player = gameState.players[socket.id];
            
            // Apply power-up effect
            if (powerUp.type === 'health') {
                player.health = Math.min(100, player.health + powerUp.value);
            } else {
                player.powerUps[powerUp.type] = powerUp;
                // Remove power-up after duration
                setTimeout(() => {
                    delete player.powerUps[powerUp.type];
                    io.emit('gameState', gameState);
                }, powerUp.duration);
            }
            
            // Remove power-up from game
            gameState.powerUps.splice(powerUpIndex, 1);
            io.emit('gameState', gameState);
            
            // Spawn new power-up
            setTimeout(spawnPowerUp, 10000);
        }
    });

    // Handle flag capture
    socket.on('captureFlag', (data) => {
        if (gameState.gameMode === 'capture_the_flag') {
            const player = gameState.players[socket.id];
            const flag = gameState.flags[data.team];
            
            if (flag.carrier === null && player.team !== data.team) {
                // Pick up flag
                flag.carrier = socket.id;
            } else if (flag.carrier === socket.id) {
                // Score point
                gameState.scores[player.team]++;
                flag.carrier = null;
                flag.x = data.team === 'red' ? 100 : 700;
                flag.y = 300;
                
                // Update player score
                player.score += 500;
                updateLeaderboard();
            }
            
            io.emit('gameState', gameState);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove from team
        if (gameState.players[socket.id]?.team) {
            const teamIndex = gameState.teams[gameState.players[socket.id].team].indexOf(socket.id);
            if (teamIndex !== -1) {
                gameState.teams[gameState.players[socket.id].team].splice(teamIndex, 1);
            }
        }
        
        delete gameState.players[socket.id];
        io.emit('gameState', gameState);
    });
});

// Initialize game
spawnPowerUp();
if (gameState.gameMode === 'capture_the_flag') {
    spawnFlags();
}

// Start game loop
setInterval(updateGame, 1000 / 60); // 60 FPS

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Handle server errors
http.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error('Port 3000 is already in use. Please try a different port or close the existing server.');
        process.exit(1);
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    io.close(() => {
        console.log('Socket.IO server closed');
        http.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or close the existing server.`);
        process.exit(1);
    }
}); 