// ============== GAME.JS — Main Game Loop, Input, HUD ==============

// Global combo name display
function showComboName(name) {
    const el = document.getElementById('comboName');
    if (!el) return;
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 1500);
}

// Damage popup
function showDmgPopup(x, y, value, type) {
    const div = document.createElement('div');
    div.className = `dmg-popup ${type}`;
    div.textContent = (type === 'heal' ? '+' : '') + Math.round(value);
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.engine = new GameEngine(this.canvas);
        this.player = null;
        this.enemyMgr = null;
        this.running = false;
        this.paused = false;

        // Input
        this.input = {
            w: false, a: false, s: false, d: false,
            space: false, shift: false,
            j: false, k: false,
            q: false, e: false, r: false
        };
        this.setupInput();

        // Start button
        document.getElementById('btnStart').addEventListener('click', () => this.start());
    }

    setupInput() {
        const keyMap = {
            'KeyW': 'w', 'ArrowUp': 'w',
            'KeyA': 'a', 'ArrowLeft': 'a',
            'KeyS': 's', 'ArrowDown': 's',
            'KeyD': 'd', 'ArrowRight': 'd',
            'Space': 'space', 'ShiftLeft': 'shift', 'ShiftRight': 'shift',
            'KeyJ': 'j', 'KeyK': 'k',
            'KeyQ': 'q', 'KeyE': 'e', 'KeyR': 'r'
        };

        // One-shot keys (consume on press)
        const oneShot = new Set(['space', 'shift', 'j', 'k', 'e', 'r']);

        window.addEventListener('keydown', (e) => {
            e.preventDefault();
            const key = keyMap[e.code];
            if (key) {
                if (oneShot.has(key)) {
                    this.input[key] = true; // Will be consumed in update
                } else {
                    this.input[key] = true;
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = keyMap[e.code];
            if (key && !new Set(['space', 'shift', 'j', 'k', 'e', 'r']).has(key)) {
                this.input[key] = false;
            }
            // Release hold keys
            if (key === 'q') this.input.q = false;
        });
    }

    start() {
        // Hide title
        document.getElementById('titleScreen').classList.add('hidden');
        document.getElementById('hud').classList.add('visible');

        // Init engine
        this.engine.init();

        // Create player
        this.player = new Player(this.engine.scene);

        // Create enemies
        this.enemyMgr = new EnemyManager(this.engine.scene);
        this.enemyMgr.init();

        this.running = true;
        this.gameLoop();
    }

    gameLoop() {
        if (!this.running) return;
        requestAnimationFrame(() => this.gameLoop());

        const dt = Math.min(this.engine.clock.getDelta(), 0.05);
        if (this.paused) return;

        // Update player
        this.player.update(dt, this.input);

        // Get player attack hitboxes
        const hitboxes = this.player.getHitboxes();

        // Update enemies
        const combatResult = this.enemyMgr.update(dt, this.player.mesh.position, hitboxes);

        // Apply damage to player
        if (combatResult.damageToPlayer > 0) {
            this.player.takeDamage(combatResult.damageToPlayer);
            this.screenShake();

            // Project enemy position to screen for popup
            const screenPos = this.project(this.player.mesh.position);
            showDmgPopup(screenPos.x, screenPos.y, combatResult.damageToPlayer, 'taken');
        }

        // Show damage dealt popups
        combatResult.hitResults.forEach(result => {
            const screenPos = this.project(result.pos);
            showDmgPopup(screenPos.x, screenPos.y, result.damage, 'dealt');

            // Player gains mana from kills
            if (result.enemy.dead) {
                this.player.mana = Math.min(this.player.maxMana, this.player.mana + 15);
                this.player.score += result.enemy.type === 'boss' ? 500 : 100;
                this.player.kills = combatResult.kills;
            }
        });

        // Check item collection
        this.engine.items.forEach(item => {
            if (!item.userData.collected) {
                const dist = item.position.distanceTo(this.player.mesh.position);
                if (dist < 2.5) {
                    this.player.collectItem(item);
                    const screenPos = this.project(item.position);
                    const val = item.userData.value;
                    showDmgPopup(screenPos.x, screenPos.y, val, 'heal');
                }
            }
        });

        // Update items animation
        this.engine.updateItems(dt);

        // Update camera
        this.engine.updateCamera(this.player.mesh.position, dt);

        // Update HUD
        this.updateHUD();

        // Check death
        if (this.player.dead) {
            this.showDeath();
        }

        // Check victory (kill 20 enemies)
        if (this.player.kills >= 20 && !this.player.dead) {
            this.showVictory();
        }

        // Render
        this.engine.render();
    }

    project(worldPos) {
        const v = worldPos.clone();
        v.project(this.engine.camera);
        return {
            x: (v.x * 0.5 + 0.5) * window.innerWidth,
            y: (-v.y * 0.5 + 0.5) * window.innerHeight
        };
    }

    screenShake() {
        const cam = this.engine.camera;
        const origPos = cam.position.clone();
        let shakeTime = 0;
        const shake = () => {
            shakeTime += 16;
            if (shakeTime > 200) return;
            cam.position.x = origPos.x + (Math.random() - 0.5) * 0.5;
            cam.position.y = origPos.y + (Math.random() - 0.5) * 0.3;
            requestAnimationFrame(shake);
        };
        shake();
    }

    updateHUD() {
        const p = this.player;
        document.getElementById('hpBar').style.width = (p.hp / p.maxHp * 100) + '%';
        document.getElementById('staminaBar').style.width = (p.stamina / p.maxStamina * 100) + '%';
        document.getElementById('manaBar').style.width = (p.mana / p.maxMana * 100) + '%';
        document.getElementById('hpText').textContent = Math.round(p.hp);
        document.getElementById('staminaText').textContent = Math.round(p.stamina);
        document.getElementById('manaText').textContent = Math.round(p.mana);
        document.getElementById('killsText').textContent = `Hạ: ${p.kills}/20`;
        document.getElementById('scoreText').textContent = `Điểm: ${p.score}`;

        // Skill cooldowns
        this.updateCooldownUI('cdQ', p.shielding ? 1 : 0, 1);
        this.updateCooldownUI('cdE', p.arrowCooldown, p.arrowCdMax);
        this.updateCooldownUI('cdR', p.ultimateCooldown, p.ultimateCdMax);
    }

    updateCooldownUI(id, current, max) {
        const el = document.getElementById(id);
        if (current > 0) {
            el.style.display = 'block';
            el.style.height = (current / max * 100) + '%';
        } else {
            el.style.display = 'none';
        }
    }

    showDeath() {
        this.paused = true;
        document.getElementById('deathScreen').classList.add('show');
    }

    showVictory() {
        this.paused = true;
        document.getElementById('victoryScreen').classList.add('show');
        document.getElementById('victoryStats').innerHTML =
            `Điểm: <strong style="color:#FFD700">${this.player.score}</strong> | ` +
            `Hạ gục: <strong style="color:#FFD700">${this.player.kills}</strong> | ` +
            `HP còn lại: <strong style="color:#66BB6A">${Math.round(this.player.hp)}%</strong>`;
    }

    restart() {
        // Remove old objects
        while (this.engine.scene.children.length > 0) {
            this.engine.scene.remove(this.engine.scene.children[0]);
        }
        this.engine.items = [];
        this.engine.platforms = [];

        // Hide overlays
        document.getElementById('deathScreen').classList.remove('show');
        document.getElementById('victoryScreen').classList.remove('show');

        // Re-init
        this.engine.init();
        this.player = new Player(this.engine.scene);
        this.enemyMgr = new EnemyManager(this.engine.scene);
        this.enemyMgr.init();
        this.paused = false;
    }
}

// ============== INIT ==============
const game = new Game();
