// ============== ENEMIES.JS — Enemy AI, Spawning, Combat ==============

class Enemy {
    constructor(scene, x, z, type) {
        this.scene = scene;
        this.type = type || 'shadow';
        this.mesh = this.createModel();
        this.mesh.position.set(x, 0, z);
        scene.add(this.mesh);

        this.hp = type === 'boss' ? 200 : 40;
        this.maxHp = this.hp;
        this.defense = type === 'boss' ? 8 : 3;
        this.attackDamage = type === 'boss' ? 20 : 10;
        this.attackRange = type === 'boss' ? 4 : 2.5;
        this.detectRange = type === 'boss' ? 30 : 18;
        this.moveSpeed = type === 'boss' ? 4 : 5;
        this.attackCooldown = 0;
        this.attackCdMax = type === 'boss' ? 1.5 : 2;
        this.stunTimer = 0;
        this.dead = false;
        this.deathTimer = 0;
        this.state = 'idle'; // idle, chase, attack, stunned

        // Patrol
        this.patrolOrigin = new THREE.Vector3(x, 0, z);
        this.patrolTarget = this.getRandomPatrolPoint();
        this.patrolTimer = 0;

        // HP bar
        this.hpBar = this.createHpBar();
        this.mesh.add(this.hpBar);
    }

    createModel() {
        const group = new THREE.Group();
        const isBoss = this.type === 'boss';
        const scale = isBoss ? 1.5 : 1;
        const bodyColor = isBoss ? 0x4A0020 : 0x1a1a2e;
        const glowColor = isBoss ? 0xFF0000 : 0x6A0DAD;

        const mat = new THREE.MeshStandardMaterial({
            color: bodyColor, roughness: 0.5, metalness: 0.3,
            emissive: glowColor, emissiveIntensity: 0.2
        });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 1.4 * scale, 0.5 * scale), mat);
        body.position.y = 1.2 * scale;
        body.castShadow = true;
        group.add(body);

        // Head
        const headMat = new THREE.MeshStandardMaterial({
            color: bodyColor, emissive: glowColor, emissiveIntensity: 0.3
        });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale), headMat);
        head.position.y = 2.2 * scale;
        head.castShadow = true;
        group.add(head);

        // Eyes (glowing)
        const eyeMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xFF0000 : 0xFF00FF });
        [-0.12, 0.12].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 4, 4), eyeMat);
            eye.position.set(x * scale, 2.3 * scale, -0.25 * scale);
            group.add(eye);
        });

        // Legs
        [-0.2, 0.2].forEach(x => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.8 * scale, 0.25 * scale), mat);
            leg.position.set(x * scale, 0.4 * scale, 0);
            group.add(leg);
        });

        // Boss horns
        if (isBoss) {
            const hornMat = new THREE.MeshStandardMaterial({ color: 0x8B0000, metalness: 0.5 });
            [-0.3, 0.3].forEach(x => {
                const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 4), hornMat);
                horn.position.set(x, 2.7, 0);
                horn.rotation.z = x > 0 ? -0.3 : 0.3;
                group.add(horn);
            });
        }

        return group;
    }

    createHpBar() {
        const group = new THREE.Group();
        const bgGeo = new THREE.PlaneGeometry(1, 0.1);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        group.add(bg);

        const fillGeo = new THREE.PlaneGeometry(1, 0.1);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide });
        this.hpFill = new THREE.Mesh(fillGeo, fillMat);
        group.add(this.hpFill);

        const s = this.type === 'boss' ? 1.5 : 1;
        group.position.y = 3 * s;
        return group;
    }

    getRandomPatrolPoint() {
        return new THREE.Vector3(
            this.patrolOrigin.x + (Math.random() - 0.5) * 10,
            0,
            this.patrolOrigin.z + (Math.random() - 0.5) * 10
        );
    }

    update(dt, playerPos) {
        if (this.dead) {
            this.deathTimer += dt;
            this.mesh.scale.setScalar(Math.max(0, 1 - this.deathTimer * 2));
            this.mesh.position.y -= dt * 2;
            return this.deathTimer > 1;
        }

        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.state = 'stunned';
            this.mesh.rotation.z = Math.sin(Date.now() / 50) * 0.1;
            return false;
        }
        this.mesh.rotation.z = 0;

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        const dist = this.mesh.position.distanceTo(playerPos);

        if (dist < this.attackRange) {
            this.state = 'attack';
            this.lookAt(playerPos, dt);
            if (this.attackCooldown <= 0) {
                this.attackCooldown = this.attackCdMax;
                return 'attack'; // Signal to game to deal damage
            }
        } else if (dist < this.detectRange) {
            this.state = 'chase';
            this.lookAt(playerPos, dt);
            const dir = playerPos.clone().sub(this.mesh.position).normalize();
            this.mesh.position.x += dir.x * this.moveSpeed * dt;
            this.mesh.position.z += dir.z * this.moveSpeed * dt;
        } else {
            this.state = 'idle';
            this.patrol(dt);
        }

        // Ground follow
        const gY = Math.sin(this.mesh.position.x * 0.1) * Math.cos(this.mesh.position.z * 0.1) * 1.5 +
            Math.sin(this.mesh.position.x * 0.05 + 1) * Math.cos(this.mesh.position.z * 0.08) * 2;
        this.mesh.position.y = gY;

        // HP bar face camera + update
        this.hpBar.lookAt(playerPos.x, this.hpBar.getWorldPosition(new THREE.Vector3()).y, playerPos.z);
        const hpRatio = this.hp / this.maxHp;
        this.hpFill.scale.x = hpRatio;
        this.hpFill.position.x = -(1 - hpRatio) / 2;

        // Bobbing animation
        const bob = Math.sin(Date.now() / 300) * 0.15;
        this.mesh.children[0].position.y = (this.type === 'boss' ? 1.8 : 1.2) + bob;

        return false;
    }

    lookAt(target, dt) {
        const angle = Math.atan2(
            target.x - this.mesh.position.x,
            target.z - this.mesh.position.z
        );
        let diff = angle - this.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.mesh.rotation.y += diff * 5 * dt;
    }

    patrol(dt) {
        this.patrolTimer += dt;
        if (this.patrolTimer > 4) {
            this.patrolTimer = 0;
            this.patrolTarget = this.getRandomPatrolPoint();
        }
        const dir = this.patrolTarget.clone().sub(this.mesh.position).normalize();
        this.mesh.position.x += dir.x * this.moveSpeed * 0.3 * dt;
        this.mesh.position.z += dir.z * this.moveSpeed * 0.3 * dt;
        this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    takeDamage(amount, stun) {
        const actualDmg = Math.max(1, amount - this.defense);
        this.hp -= actualDmg;
        if (stun) this.stunTimer = 1.5;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
        // Flash red
        this.mesh.children.forEach(c => {
            if (c.material) {
                const orig = c.material.emissiveIntensity;
                c.material.emissiveIntensity = 1;
                setTimeout(() => { if (c.material) c.material.emissiveIntensity = orig; }, 150);
            }
        });
        return actualDmg;
    }
}


class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 8;
        this.maxEnemies = 10;
        this.waveCount = 0;
        this.bossSpawned = false;
        this.totalKills = 0;
    }

    init() {
        // Initial enemies
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const r = 20 + Math.random() * 15;
            this.spawnEnemy(Math.cos(angle) * r, Math.sin(angle) * r, 'shadow');
        }
    }

    spawnEnemy(x, z, type) {
        if (this.enemies.length >= this.maxEnemies) return;
        const enemy = new Enemy(this.scene, x, z, type);
        this.enemies.push(enemy);
    }

    update(dt, playerPos, playerHitboxes) {
        this.spawnTimer += dt;

        // Spawn waves
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.waveCount++;
            const count = Math.min(3, 1 + Math.floor(this.waveCount / 3));
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 25 + Math.random() * 15;
                this.spawnEnemy(
                    playerPos.x + Math.cos(angle) * r,
                    playerPos.z + Math.sin(angle) * r,
                    'shadow'
                );
            }

            // Boss every 5 waves
            if (this.waveCount % 5 === 0 && !this.bossSpawned) {
                const angle = Math.random() * Math.PI * 2;
                this.spawnEnemy(
                    playerPos.x + Math.cos(angle) * 20,
                    playerPos.z + Math.sin(angle) * 20,
                    'boss'
                );
                this.bossSpawned = true;
            }
        }

        let damageToPlayer = 0;
        const results = [];

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const updateResult = enemy.update(dt, playerPos);

            if (updateResult === true) {
                // Dead and animation finished
                this.scene.remove(enemy.mesh);
                this.enemies.splice(i, 1);
                continue;
            }

            if (updateResult === 'attack' && !enemy.dead) {
                damageToPlayer += enemy.attackDamage;
            }

            // Check player hitboxes against enemy
            if (!enemy.dead) {
                for (const hb of playerHitboxes) {
                    const dist = hb.pos.distanceTo(enemy.mesh.position);
                    if (dist < hb.range) {
                        const dmg = enemy.takeDamage(hb.damage, hb.stun);
                        results.push({ enemy, damage: dmg, pos: enemy.mesh.position.clone() });
                        if (enemy.dead) {
                            this.totalKills++;
                            if (enemy.type === 'boss') this.bossSpawned = false;
                        }
                    }
                }
            }
        }

        return { damageToPlayer, hitResults: results, kills: this.totalKills };
    }

    getAliveCount() { return this.enemies.filter(e => !e.dead).length; }
}
