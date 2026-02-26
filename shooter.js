        // Game setup
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const gameContainer = document.getElementById('game-container');

        const scoreEl = document.getElementById('score');
        const levelEl = document.getElementById('level');
        const livesEl = document.getElementById('lives');
        const uiContainer = document.getElementById('ui-container');
        const mobileControls = document.getElementById('mobile-controls');

        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnThrust = document.getElementById('btn-thrust');
        const btnShoot = document.getElementById('btn-shoot');
        const startScreen = document.getElementById('start-screen');
        const gameOverScreen = document.getElementById('game-over-screen');
        const startButton = document.getElementById('start-button');
        const gameExitButton = document.getElementById('game-exit-button');
        const restartButton = document.getElementById('restart-button');
        const finalScoreEl = document.getElementById('final-score');

        let player;
        let projectiles = [];
        let asteroids = [];
        let particles = [];
        let stars = [];
        let keys = {};
        let lastShotTime = 0;
        let shotCooldown = 150; // milliseconds between shots
        let score = 0;
        let level = 1;
        let lives = 3;
        let gameOver = false;
        let gameRunning = false;
        let levelColors = {
            1: { bg: '#0b0410', ui: '#ff0055', accent: '#00f3ff' },
            2: { bg: '#020b14', ui: '#00ffcc', accent: '#ff00ff' },
            3: { bg: '#14020b', ui: '#faff00', accent: '#ff0055' },
            4: { bg: '#141402', ui: '#00ffff', accent: '#ffea00' },
            5: { bg: '#021414', ui: '#ff00ff', accent: '#00ffcc' },
            6: { bg: '#140214', ui: '#00ff55', accent: '#ff00ff' },
            7: { bg: '#1c0404', ui: '#ff00aa', accent: '#ff3300' },
            8: { bg: '#04041c', ui: '#00aaff', accent: '#3300ff' },
            9: { bg: '#1c1004', ui: '#00ffcc', accent: '#ff8800' },
            10: { bg: '#10041c', ui: '#ffeb3b', accent: '#aa00ff' }
        };
        let audioContext;
        let masterGain;
        let thrustSound;
        let backgroundMusic;
        let thrustAudio;

        function resizeCanvas() {
            canvas.width = gameContainer.clientWidth;
            canvas.height = gameContainer.clientHeight;
            createStars();
        }
        window.addEventListener('resize', resizeCanvas);

        function initAudio() {
            if (!audioContext) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioCtx();
                masterGain = audioContext.createGain();
                masterGain.gain.value = 0.25;
                masterGain.connect(audioContext.destination);
            }
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Load audio files
            if (!backgroundMusic) {
                backgroundMusic = new Audio('audio/background.mp3');
                backgroundMusic.loop = true;
                backgroundMusic.volume = 0.3;
            }
            if (!thrustAudio) {
                thrustAudio = new Audio('audio/fighter jet thrust.mp3');
                thrustAudio.loop = true;
                thrustAudio.volume = 0.4;
            }
        }

        function startThrustSound() {
            initAudio();
            if (thrustAudio && !thrustSound) {
                thrustAudio.play().catch(e => console.log('Thrust sound play failed:', e));
                thrustSound = true;
            }
        }

        function stopThrustSound() {
            if (thrustAudio && thrustSound) {
                thrustAudio.pause();
                thrustAudio.currentTime = 0;
                thrustSound = false;
            }
        }

        function updateThrustSound(active) {
            if (active) startThrustSound();
            else stopThrustSound();
        }

        function returnToMenu() {
            gameRunning = false;
            gameOver = false;
            stopThrustSound();
            cancelAnimationFrame(animationFrameId);

            if (backgroundMusic) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0;
            }

            projectiles = [];
            asteroids = [];
            particles = [];
            if (player) player.velocity = { x: 0, y: 0 };

            gameOverScreen.style.display = 'none';
            startScreen.style.display = 'flex';
            uiContainer.style.display = 'none';
            mobileControls.style.display = 'none';
            createStars();
        }




        // Player Class
        class Player {
            constructor(x, y, radius, color) {
                this.x = x; this.y = y; this.radius = radius; this.color = color;
                this.angle = 0; this.rotation = 0;
                this.velocity = { x: 0, y: 0 };
                this.thrust = 0.05; this.friction = 0.99;
                this.isThrusting = false;
                this.invincible = false;
                this.invincibilityFrames = 180; // 3 seconds at 60fps
            }

            draw() {
                if (this.invincible && Math.floor(this.invincibilityFrames / 10) % 2 === 0) return;

                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.beginPath();
                ctx.moveTo(0, -this.radius);
                ctx.lineTo(this.radius / 1.5, this.radius);
                ctx.lineTo(-this.radius / 1.5, this.radius);
                ctx.closePath();
                ctx.strokeStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                ctx.lineWidth = 2;
                ctx.stroke();

                if (this.isThrusting) {
                    ctx.beginPath();
                    const flameSize = Math.random() * 5 + 10;
                    ctx.moveTo(0, this.radius + 3);
                    ctx.lineTo(this.radius / 2, this.radius + flameSize);
                    ctx.lineTo(-this.radius / 2, this.radius + flameSize);
                    ctx.closePath();
                    ctx.fillStyle = 'orange';
                    ctx.shadowColor = 'orange';
                    ctx.shadowBlur = 15;
                    ctx.fill();
                }
                ctx.restore();
            }

            update() {
                this.draw();
                if (this.invincible) this.invincibilityFrames--;
                if (this.invincibilityFrames <= 0) this.invincible = false;

                this.angle += this.rotation;
                if (this.isThrusting) {
                    this.velocity.x += Math.sin(this.angle) * this.thrust;
                    this.velocity.y -= Math.cos(this.angle) * this.thrust;
                }
                this.velocity.x *= this.friction; this.velocity.y *= this.friction;
                this.x += this.velocity.x; this.y += this.velocity.y;

                if (this.x > canvas.width + this.radius) this.x = -this.radius;
                if (this.x < -this.radius) this.x = canvas.width + this.radius;
                if (this.y > canvas.height + this.radius) this.y = -this.radius;
                if (this.y < -this.radius) this.y = canvas.height + this.radius;
            }
        }

        class Projectile { // ... (same as before, but with glow)
            constructor(x, y, radius, color, velocity) {
                this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity;
            }
            draw() {
                ctx.save();
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.restore();
            }
            update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; }
        }

        class Asteroid { // ... (same as before, but with glow)
            constructor(x, y, radius, color, velocity, points) {
                this.x = x; this.y = y; this.radius = radius; this.color = color;
                this.velocity = velocity; this.points = points;
                this.angle = 0; this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.beginPath();
                ctx.moveTo(this.points[0].x, this.points[0].y);
                for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
                ctx.closePath();
                ctx.strokeStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
            update() {
                this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; this.angle += this.rotationSpeed;
                if (this.x > canvas.width + this.radius) this.x = -this.radius;
                if (this.x < -this.radius) this.x = canvas.width + this.radius;
                if (this.y > canvas.height + this.radius) this.y = -this.radius;
                if (this.y < -this.radius) this.y = canvas.height + this.radius;
            }
        }

        class Particle {
            constructor(x, y, radius, color, velocity) {
                this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity;
                this.alpha = 1; this.friction = 0.98;
            }
            draw() {
                ctx.save();
                ctx.globalAlpha = this.alpha;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.restore();
            }
            update() {
                this.draw();
                this.velocity.x *= this.friction; this.velocity.y *= this.friction;
                this.x += this.velocity.x; this.y += this.velocity.y;
                this.alpha -= 0.02;
            }
        }

        // --- Game Logic ---
        function addAsteroid(x, y, radius) {
            const baseSpeed = 1;
            const speedMultiplier = 1 + (level * 0.15);
            const velocity = {
                x: (Math.random() - 0.5) * baseSpeed * speedMultiplier,
                y: (Math.random() - 0.5) * baseSpeed * speedMultiplier
            };
            const points = createAsteroidShape(radius);
            const colorScheme = levelColors[Math.min(level, 10)] || levelColors[10];
            asteroids.push(new Asteroid(x, y, radius, colorScheme.ui, velocity, points));
        }

        function updateLevelColors() {
            const colorScheme = levelColors[Math.min(level, 10)] || levelColors[10];

            // Update body background
            document.body.style.background = colorScheme.bg;
            document.body.style.color = colorScheme.ui;

            // Update canvas background
            const canvas = document.getElementById('gameCanvas');
            if (canvas) {
                canvas.style.background = colorScheme.bg;
            }

            // Update UI text colors
            const uiContainer = document.getElementById('ui-container');
            if (uiContainer) {
                uiContainer.style.color = colorScheme.ui;
                uiContainer.style.textShadow = `0 0 8px ${colorScheme.accent}80`;
            }

            // Update player color
            if (player) player.color = colorScheme.accent;

            // Update game container border
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                gameContainer.style.borderColor = colorScheme.ui;
                gameContainer.style.boxShadow = `0 0 30px ${colorScheme.accent}60, inset 0 0 30px ${colorScheme.bg}CC`;
            }
        }

        function updateUI() {
            scoreEl.textContent = `Score: ${score}`;
            levelEl.textContent = `Level: ${level}`;
            livesEl.innerHTML = '';
            for (let i = 0; i < lives; i++) {
                const life = document.createElement('div');
                life.className = 'life-ship';
                livesEl.appendChild(life);
            }
            updateLevelColors();
        }

        function createExplosion(obj, color) {
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(obj.x, obj.y, Math.random() * 2, color, {
                    x: (Math.random() - 0.5) * (Math.random() * 8),
                    y: (Math.random() - 0.5) * (Math.random() * 8)
                }));
            }
        }

        function createStars() {
            stars = [];
            const starCount = 200 + (level * 20);
            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 2,
                    alpha: Math.random() * 0.7 + 0.3
                });
            }
        }

        function createAsteroidShape(radius) { /* ... (same as before) ... */
            const points = []; const sides = Math.floor(Math.random() * 5 + 7);
            for (let i = 0; i < sides; i++) {
                const angle = (Math.PI * 2 / sides) * i;
                const length = radius * (1 + (Math.random() * 0.4 - 0.2));
                points.push({ x: Math.cos(angle) * length, y: Math.sin(angle) * length });
            } return points;
        }

        function createAsteroids() {
            const baseAsteroids = 4;
            const numAsteroids = baseAsteroids + level + Math.floor(level / 2);
            for (let i = 0; i < numAsteroids; i++) {
                let x, y;
                do {
                    x = Math.random() * canvas.width;
                    y = Math.random() * canvas.height;
                } while (Math.hypot(x - player.x, y - player.y) < 150);
                const minRadius = 25 + (level * 2);
                const maxRadius = 40 + (level * 3);
                const radius = Math.random() * (maxRadius - minRadius) + minRadius;
                addAsteroid(x, y, radius);
            }
        }

        function resetPlayer() {
            player.x = canvas.width / 2; player.y = canvas.height / 2;
            player.velocity = { x: 0, y: 0 };
            player.invincible = true;
            player.invincibilityFrames = 180;
        }

        // --- Animation Loop ---
        let animationFrameId;
        function animate() {
            if (gameOver) return;
            animationFrameId = requestAnimationFrame(animate);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw stars
            stars.forEach(star => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.fill();
                ctx.restore();
            });

            player.isThrusting = keys['ArrowUp'] || keys['w'];
            updateThrustSound(player.isThrusting);
            if (keys['ArrowLeft'] || keys['a']) player.rotation = -0.05;
            else if (keys['ArrowRight'] || keys['d']) player.rotation = 0.05;
            else player.rotation = 0;

            // Continuous shooting when spacebar is held
            if (keys[' '] || keys['Space']) {
                shoot();
            }

            player.update();

            for (let i = particles.length - 1; i >= 0; i--) {
                if (particles[i].alpha <= 0) particles.splice(i, 1);
                else particles[i].update();
            }

            for (let i = projectiles.length - 1; i >= 0; i--) {
                projectiles[i].update();
                if (projectiles[i].x < 0 || projectiles[i].x > canvas.width || projectiles[i].y < 0 || projectiles[i].y > canvas.height) {
                    projectiles.splice(i, 1);
                }
            }

            for (let i = asteroids.length - 1; i >= 0; i--) {
                const asteroid = asteroids[i]; asteroid.update();

                if (!player.invincible && Math.hypot(player.x - asteroid.x, player.y - asteroid.y) < player.radius + asteroid.radius) {
                    createExplosion(player, '#0f0');
                    lives--; updateUI();
                    if (lives <= 0) { endGame(); return; }
                    resetPlayer();
                }

                for (let j = projectiles.length - 1; j >= 0; j--) {
                    const projectile = projectiles[j];
                    if (Math.hypot(projectile.x - asteroid.x, projectile.y - asteroid.y) < projectile.radius + asteroid.radius) {
                        createExplosion(asteroid, '#fff');
                        if (asteroid.radius > 20) {
                            score += 50;
                            const newRadius = asteroid.radius / 2;
                            addAsteroid(asteroid.x, asteroid.y, newRadius);
                            addAsteroid(asteroid.x, asteroid.y, newRadius);
                        } else score += 100;
                        asteroids.splice(i, 1); projectiles.splice(j, 1);
                        updateUI();
                        break;
                    }
                }
            }
            if (asteroids.length === 0) {
                level++;
                createAsteroids();
                updateUI();
            }
        }

        function init() {
            score = 0; level = 1; lives = 3; gameOver = false;
            const colorScheme = levelColors[1];
            player = new Player(canvas.width / 2, canvas.height / 2, 15, colorScheme.accent);
            projectiles = []; asteroids = []; particles = [];
            createAsteroids();
            updateUI();
        }

        function shoot() {
            if (!gameRunning || gameOver) return;
            const now = Date.now();
            if (now - lastShotTime < shotCooldown) return; // Enforce cooldown

            lastShotTime = now;
            const velocity = { x: Math.sin(player.angle) * 6, y: -Math.cos(player.angle) * 6 };
            projectiles.push(new Projectile(player.x + Math.sin(player.angle) * player.radius, player.y - Math.cos(player.angle) * player.radius, 3, '#0ff', velocity));
        }

        function startGame() {
            gameRunning = true;
            initAudio();
            stopThrustSound();
            startScreen.style.display = 'none';
            gameOverScreen.style.display = 'none';
            uiContainer.style.display = 'flex';

            if (window.innerWidth <= 900) {
                mobileControls.style.display = 'flex';
            }

            init();

            // Start background music
            if (backgroundMusic) {
                backgroundMusic.play().catch(e => console.log('Background music play failed:', e));
            }

            animate();
        }

        function endGame() {
            gameOver = true; gameRunning = false;
            stopThrustSound();
            cancelAnimationFrame(animationFrameId);

            // Stop background music
            if (backgroundMusic) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0;
            }

            finalScoreEl.textContent = `Your Score: ${score}`;
            gameOverScreen.style.display = 'flex';
            uiContainer.style.display = 'none';
            mobileControls.style.display = 'none';
        }

        // --- Event Listeners ---
        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', startGame);
        gameExitButton.addEventListener('click', returnToMenu);

        window.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); }
        });
        window.addEventListener('keyup', (e) => { keys[e.key] = false; });

        // Touch events mapping to keys
        const setupTouch = (btn, keyString) => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyString] = true; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyString] = false; });
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); keys[keyString] = true; });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); keys[keyString] = false; });
            btn.addEventListener('mouseleave', (e) => { e.preventDefault(); keys[keyString] = false; });
        };

        setupTouch(btnLeft, 'ArrowLeft');
        setupTouch(btnRight, 'ArrowRight');
        setupTouch(btnThrust, 'ArrowUp');
        setupTouch(btnShoot, ' ');

        // Handle resize layout changes smoothly
        window.addEventListener('resize', () => {
            if (gameRunning && window.innerWidth <= 900) {
                mobileControls.style.display = 'flex';
            } else {
                mobileControls.style.display = 'none';
            }
        });

        // Initial setup
        resizeCanvas();

