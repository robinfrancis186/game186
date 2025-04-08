class Game {
    constructor() {
        this.socket = io();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};
        this.player = null;
        this.gameState = {
            players: {},
            projectiles: [],
            powerUps: [],
            flags: {},
            scores: { red: 0, blue: 0 },
            leaderboard: []
        };
        this.loading = true;
        this.lastShot = 0;
        this.shootCooldown = 500; // milliseconds
        this.powerUpEffects = {};
        this.particles = [];
        this.bulletTrails = [];
        this.effects = {
            explosions: [],
            impacts: []
        };
        
        // Visual settings
        this.colors = {
            red: {
                primary: '#ff3333',
                secondary: '#ff6666',
                trail: 'rgba(255, 51, 51, 0.3)'
            },
            blue: {
                primary: '#3333ff',
                secondary: '#6666ff',
                trail: 'rgba(51, 51, 255, 0.3)'
            }
        };
        
        // Add bullet speed
        this.bulletSpeed = 15;
        this.maxBulletTrails = 50;
        
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadAssets();
        this.gameLoop();
    }

    loadAssets() {
        // Initialize weapon sprites with default values
        this.weaponSprites = {
            ak47: null,
            glock: null,
            revolver: null,
            shotgun: null
        };

        // Create a promise for each asset
        const loadPromises = Object.keys(this.weaponSprites).map(weapon => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`Loaded ${weapon} sprite`);
                    this.weaponSprites[weapon] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load ${weapon} sprite, using default`);
                    // Create a default colored rectangle for missing sprites
                    const canvas = document.createElement('canvas');
                    canvas.width = 40;
                    canvas.height = 40;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(0, 0, 40, 40);
                    this.weaponSprites[weapon] = canvas;
                    resolve();
                };
                img.src = `/assets/weapons/${weapon}.png`;
            });
        });

        // Wait for all assets to load or fail
        Promise.all(loadPromises)
            .then(() => {
                console.log('All assets loaded or defaulted');
                this.loading = false;
                document.getElementById('loadingOverlay').classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading assets:', error);
                this.loading = false;
                document.getElementById('loadingOverlay').classList.add('hidden');
            });
    }

    setupEventListeners() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
        
        // Mouse controls
        this.canvas.addEventListener('mousedown', (e) => this.handleShoot(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleAim(e));
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            document.getElementById('connectionStatus').textContent = 'Connected';
            document.getElementById('connectionStatus').className = 'connected';
            
            const playerName = prompt('Enter your name:') || 'Player' + Math.floor(Math.random() * 1000);
            this.socket.emit('playerJoin', { name: playerName });
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            document.getElementById('connectionStatus').textContent = 'Disconnected';
            document.getElementById('connectionStatus').className = 'disconnected';
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            document.getElementById('connectionStatus').textContent = 'Connection Error';
            document.getElementById('connectionStatus').className = 'disconnected';
        });

        this.socket.on('gameState', (state) => {
            this.gameState = state;
            this.player = state.players[this.socket.id];
        });

        this.socket.on('powerUpSpawned', (powerUp) => {
            this.gameState.powerUps.push(powerUp);
        });

        this.socket.on('flagsSpawned', (flags) => {
            this.gameState.flags = flags;
        });

        this.socket.on('leaderboardUpdate', (leaderboard) => {
            this.gameState.leaderboard = leaderboard;
            this.updateLeaderboardUI();
        });
    }

    handleShoot(e) {
        if (!this.player || this.loading) return;
        
        const now = Date.now();
        if (now - this.lastShot < this.shootCooldown) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const angle = Math.atan2(mouseY - this.player.y, mouseX - this.player.x);
        
        // Create bullet with velocity
        const bullet = {
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(angle) * this.bulletSpeed,
            vy: Math.sin(angle) * this.bulletSpeed,
            team: this.player.team,
            createdAt: now
        };
        
        this.socket.emit('playerShoot', { angle, bullet });
        this.lastShot = now;
        
        // Visual feedback
        this.createMuzzleFlash(this.player.x, this.player.y, angle);
        this.createShootingParticles(this.player.x, this.player.y, angle);
    }

    createMuzzleFlash(x, y, angle) {
        const flash = {
            x, y, angle,
            lifetime: 0.1, // seconds
            createdAt: Date.now()
        };
        
        this.powerUpEffects.muzzleFlash = flash;
    }

    createShootingParticles(x, y, angle) {
        for (let i = 0; i < 8; i++) {
            const spread = (Math.random() - 0.5) * Math.PI / 4;
            const speed = Math.random() * 5 + 2;
            const lifetime = Math.random() * 0.5 + 0.2;
            
            this.particles.push({
                x, y,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                alpha: 1,
                lifetime,
                createdAt: Date.now(),
                color: this.player.team === 'red' ? this.colors.red.secondary : this.colors.blue.secondary
            });
        }
    }

    createImpactEffect(x, y, team) {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = Math.random() * 3 + 1;
            
            this.effects.impacts.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                lifetime: 0.3,
                createdAt: Date.now(),
                color: team === 'red' ? this.colors.red.secondary : this.colors.blue.secondary
            });
        }
    }

    handleAim(e) {
        if (!this.player) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.player.angle = Math.atan2(mouseY - this.player.y, mouseX - this.player.x);
    }

    update() {
        if (!this.player) return;

        // Update player movement
        this.updatePlayerMovement();
        
        // Update particles
        this.updateParticles();
        
        // Update bullet trails
        this.updateBulletTrails();
        
        // Update effects
        this.updateEffects();
    }

    updatePlayerMovement() {
        let dx = 0;
        let dy = 0;
        
        if (this.keys['w'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['s'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['a'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['d'] || this.keys['ArrowRight']) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }

        const speedMultiplier = this.player.powerUps.speed ? this.player.powerUps.speed.value : 1;
        
        this.player.x += dx * 5 * speedMultiplier;
        this.player.y += dy * 5 * speedMultiplier;

        // Keep player in bounds
        this.player.x = Math.max(20, Math.min(this.canvas.width - 20, this.player.x));
        this.player.y = Math.max(20, Math.min(this.canvas.height - 20, this.player.y));

        if (dx !== 0 || dy !== 0) {
            this.socket.emit('playerMove', { x: this.player.x, y: this.player.y });
        }
    }

    updateParticles() {
        this.particles = this.particles.filter(particle => {
            const elapsed = (Date.now() - particle.createdAt) / 1000;
            if (elapsed >= particle.lifetime) return false;
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha = 1 - (elapsed / particle.lifetime);
            
            return true;
        });
    }

    updateBulletTrails() {
        // Add new bullet positions to trails
        Object.values(this.gameState.projectiles).forEach(projectile => {
            this.bulletTrails.push({
                x: projectile.x,
                y: projectile.y,
                team: projectile.team,
                createdAt: Date.now()
            });
        });
        
        // Remove old trails
        this.bulletTrails = this.bulletTrails
            .filter(trail => Date.now() - trail.createdAt < 100)
            .slice(-this.maxBulletTrails);
    }

    updateEffects() {
        // Update impacts
        this.effects.impacts = this.effects.impacts.filter(impact => {
            const elapsed = (Date.now() - impact.createdAt) / 1000;
            if (elapsed >= impact.lifetime) return false;
            
            impact.x += impact.vx;
            impact.y += impact.vy;
            impact.alpha = 1 - (elapsed / impact.lifetime);
            impact.vx *= 0.95;
            impact.vy *= 0.95;
            
            return true;
        });
    }

    checkPowerUpCollection() {
        this.gameState.powerUps.forEach((powerUp, index) => {
            const distance = Math.hypot(
                this.player.x - powerUp.x,
                this.player.y - powerUp.y
            );
            
            if (distance < 30) {
                this.socket.emit('collectPowerUp', { powerUpId: powerUp.id });
                this.gameState.powerUps.splice(index, 1);
            }
        });
    }

    checkFlagInteraction() {
        if (this.gameState.flags) {
            Object.entries(this.gameState.flags).forEach(([team, flag]) => {
                const distance = Math.hypot(
                    this.player.x - flag.x,
                    this.player.y - flag.y
                );
                
                if (distance < 30) {
                    this.socket.emit('captureFlag', { team });
                }
            });
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.loading) {
            this.drawLoadingScreen();
            return;
        }
        
        // Draw game elements in order
        this.drawBackground();
        this.drawBulletTrails();
        this.drawPowerUps();
        this.drawFlags();
        this.drawPlayers();
        this.drawProjectiles();
        this.drawParticles();
        this.drawEffects();
        this.drawHUD();
    }

    drawLoadingScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading game assets...', this.canvas.width / 2, this.canvas.height / 2);
        
        // Show loading progress
        const loadedCount = Object.values(this.weaponSprites).filter(sprite => sprite !== null).length;
        const totalCount = Object.keys(this.weaponSprites).length;
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`${loadedCount}/${totalCount} assets loaded`, this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    drawBackground() {
        // Create subtle grid pattern
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawBulletTrails() {
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        
        for (let i = 1; i < this.bulletTrails.length; i++) {
            const prev = this.bulletTrails[i - 1];
            const curr = this.bulletTrails[i];
            
            if (prev.team === curr.team) {
                const gradient = this.ctx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
                const color = curr.team === 'red' ? this.colors.red : this.colors.blue;
                
                gradient.addColorStop(0, color.trail);
                gradient.addColorStop(1, color.primary);
                
                this.ctx.strokeStyle = gradient;
                this.ctx.beginPath();
                this.ctx.moveTo(prev.x, prev.y);
                this.ctx.lineTo(curr.x, curr.y);
                this.ctx.stroke();
            }
        }
    }

    drawPlayers() {
        Object.values(this.gameState.players).forEach(player => {
            // Draw player body
            this.ctx.save();
            this.ctx.translate(player.x, player.y);
            this.ctx.rotate(player.angle);
            
            // Draw team color
            this.ctx.fillStyle = player.team === 'red' ? '#ff0000' : '#0000ff';
            this.ctx.fillRect(-20, -20, 40, 40);
            
            // Draw health bar
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(-20, -30, 40 * (player.health / 100), 5);
            
            // Draw power-up effects
            if (player.powerUps.shield) {
                this.ctx.strokeStyle = '#00ffff';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(-25, -25, 50, 50);
            }
            
            this.ctx.restore();
            
            // Draw player name and score
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${player.name} (${player.score})`, player.x, player.y - 40);
        });
    }

    drawProjectiles() {
        this.gameState.projectiles.forEach(projectile => {
            const color = projectile.team === 'red' ? this.colors.red : this.colors.blue;
            
            // Draw bullet glow
            const gradient = this.ctx.createRadialGradient(
                projectile.x, projectile.y, 0,
                projectile.x, projectile.y, 10
            );
            gradient.addColorStop(0, color.primary);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(projectile.x, projectile.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw bullet core
            this.ctx.fillStyle = color.secondary;
            this.ctx.beginPath();
            this.ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.fillStyle = `rgba(${particle.color}, ${particle.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawEffects() {
        // Draw impacts
        this.effects.impacts.forEach(impact => {
            this.ctx.fillStyle = `rgba(${impact.color}, ${impact.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(impact.x, impact.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawHUD() {
        // Draw ammo count
        if (this.player) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Ammo: ${this.player.ammo}`, 20, 30);
            
            // Draw cooldown indicator
            const cooldown = (Date.now() - this.lastShot) / this.shootCooldown;
            if (cooldown < 1) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + cooldown * 0.5})`;
                this.ctx.fillRect(20, 40, 100 * cooldown, 5);
            }
        }
    }

    drawPowerUps() {
        this.gameState.powerUps.forEach(powerUp => {
            this.ctx.fillStyle = this.getPowerUpColor(powerUp.type);
            this.ctx.fillRect(powerUp.x - 15, powerUp.y - 15, 30, 30);
        });
    }

    drawFlags() {
        if (this.gameState.flags) {
            Object.entries(this.gameState.flags).forEach(([team, flag]) => {
                this.ctx.fillStyle = team === 'red' ? '#ff0000' : '#0000ff';
                this.ctx.fillRect(flag.x - 10, flag.y - 10, 20, 20);
            });
        }
    }

    getPowerUpColor(type) {
        const colors = {
            health: '#00ff00',
            speed: '#ffff00',
            damage: '#ff0000',
            shield: '#00ffff'
        };
        return colors[type] || '#ffffff';
    }

    updateLeaderboardUI() {
        const leaderboardElement = document.getElementById('leaderboard');
        if (!leaderboardElement) return;

        leaderboardElement.innerHTML = '<h2>Leaderboard</h2>';
        this.gameState.leaderboard.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.textContent = `${index + 1}. ${player.name} - ${player.score} (${player.kills}/${player.deaths})`;
            leaderboardElement.appendChild(entry);
        });
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
