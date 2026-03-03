// ============== PLAYER.JS — Character Controller, Combat, Skills ==============

class Player {
    constructor(scene) {
        this.scene = scene;
        this.mesh = this.createModel();
        scene.add(this.mesh);

        // Stats
        this.hp = 100; this.maxHp = 100;
        this.stamina = 100; this.maxStamina = 100;
        this.mana = 0; this.maxMana = 100;
        this.attackDamage = 15;
        this.moveSpeed = 12;

        // Physics
        this.velocity = new THREE.Vector3();
        this.grounded = false;
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.gravity = -30;
        this.jumpForce = 12;

        // Combat
        this.comboQueue = [];
        this.comboTimer = 0;
        this.comboWindow = 0.8;
        this.attacking = false;
        this.attackTimer = 0;
        this.attackDuration = 0.3;
        this.attackHitbox = [];
        this.phase = 1; // 1=Bamboo, 2=Divine

        // Skills
        this.shielding = false;
        this.shieldMesh = null;
        this.arrowCooldown = 0;
        this.arrowCdMax = 3;
        this.ultimateCooldown = 0;
        this.ultimateCdMax = 15;
        this.dragonActive = false;
        this.dragonTimer = 0;
        this.dragonMesh = null;
        this.dragonParticles = [];

        // Dash
        this.dashing = false;
        this.dashTimer = 0;
        this.dashDuration = 0.2;
        this.dashCooldown = 0;
        this.dashCdMax = 1;
        this.dashSpeed = 35;
        this.dashDir = new THREE.Vector3();

        // Visual
        this.facingAngle = 0;
        this.invincible = false;
        this.invTimer = 0;
        this.dead = false;

        // Score
        this.kills = 0;
        this.score = 0;

        // Create shield mesh (hidden)
        this.createShield();
    }

    createModel() {
        const group = new THREE.Group();

        // Body
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.6, metalness: 0.3 });
        const armorMat = new THREE.MeshStandardMaterial({ color: 0xCD853F, roughness: 0.4, metalness: 0.5 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xC8102E, roughness: 0.5 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xDEB887, roughness: 0.7 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3, metalness: 0.7 });

        // Legs
        [-0.25, 0.25].forEach(x => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), bodyMat);
            leg.position.set(x, 0.5, 0);
            leg.castShadow = true;
            group.add(leg);
        });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.5), armorMat);
        torso.position.set(0, 1.6, 0);
        torso.castShadow = true;
        group.add(torso);

        // Armor plate
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.55), goldMat);
        plate.position.set(0, 1.8, 0);
        group.add(plate);

        // Arms
        [-0.6, 0.6].forEach(x => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 0.25), skinMat);
            arm.position.set(x, 1.5, 0);
            arm.castShadow = true;
            group.add(arm);
        });

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.set(0, 2.5, 0);
        head.castShadow = true;
        group.add(head);

        // Headband (red)
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), redMat);
        band.position.set(0, 2.55, 0);
        group.add(band);

        // Headband tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), redMat);
        tail.position.set(0, 2.55, -0.5);
        group.add(tail);

        // Weapon: bamboo staff (phase 1)
        const staff = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
            new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.7 })
        );
        staff.position.set(0.7, 1.5, 0);
        staff.rotation.z = -0.3;
        staff.name = 'weapon';
        group.add(staff);

        // Jade talisman glow
        const talisman = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.15),
            new THREE.MeshStandardMaterial({ color: 0x00FF88, emissive: 0x00FF88, emissiveIntensity: 0.5 })
        );
        talisman.position.set(0, 2.0, 0.3);
        talisman.name = 'talisman';
        group.add(talisman);

        group.position.set(0, 0, 0);
        return group;
    }

    createShield() {
        const geo = new THREE.SphereGeometry(2.5, 16, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x228B22, transparent: true, opacity: 0.25,
            emissive: 0x228B22, emissiveIntensity: 0.3, side: THREE.DoubleSide
        });
        this.shieldMesh = new THREE.Mesh(geo, mat);
        this.shieldMesh.visible = false;
        this.scene.add(this.shieldMesh);
    }

    update(dt, input) {
        if (this.dead) return;

        this.updateMovement(dt, input);
        this.updateCombat(dt, input);
        this.updateSkills(dt, input);
        this.updateCooldowns(dt);
        this.updateVisuals(dt);

        // Stamina regen
        if (!this.dashing && !this.attacking) {
            this.stamina = Math.min(this.maxStamina, this.stamina + 8 * dt);
        }

        // Mana passive regen (slow)
        this.mana = Math.min(this.maxMana, this.mana + 1 * dt);
    }

    updateMovement(dt, input) {
        // Horizontal movement
        const moveDir = new THREE.Vector3();
        if (input.w) moveDir.z -= 1;
        if (input.s) moveDir.z += 1;
        if (input.a) moveDir.x -= 1;
        if (input.d) moveDir.x += 1;

        if (this.dashing) {
            this.dashTimer -= dt;
            this.mesh.position.add(this.dashDir.clone().multiplyScalar(this.dashSpeed * dt));
            if (this.dashTimer <= 0) this.dashing = false;
        } else if (moveDir.length() > 0 && !this.attacking && !this.shielding) {
            moveDir.normalize();
            const speed = this.moveSpeed * (this.shielding ? 0.3 : 1);
            this.mesh.position.x += moveDir.x * speed * dt;
            this.mesh.position.z += moveDir.z * speed * dt;
            this.facingAngle = Math.atan2(moveDir.x, moveDir.z);
        }

        // Facing rotation
        const targetRot = this.facingAngle;
        let diff = targetRot - this.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.mesh.rotation.y += diff * 10 * dt;

        // Gravity & jumping
        this.velocity.y += this.gravity * dt;
        this.mesh.position.y += this.velocity.y * dt;

        // Ground check
        const groundY = this.getGroundY(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y <= groundY) {
            this.mesh.position.y = groundY;
            this.velocity.y = 0;
            this.grounded = true;
            this.jumpCount = 0;
        } else {
            this.grounded = false;
        }

        // Jump
        if (input.space && this.jumpCount < this.maxJumps) {
            this.velocity.y = this.jumpForce;
            this.jumpCount++;
            input.space = false; // consume
        }

        // Dash
        if (input.shift && this.dashCooldown <= 0 && this.stamina >= 20 && !this.dashing) {
            this.dashing = true;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = this.dashCdMax;
            this.stamina -= 20;
            this.dashDir.set(
                Math.sin(this.facingAngle),
                0,
                Math.cos(this.facingAngle)
            );
            this.invincible = true;
            this.invTimer = this.dashDuration;
            input.shift = false;
        }

        // Bounds
        this.mesh.position.x = Math.max(-95, Math.min(95, this.mesh.position.x));
        this.mesh.position.z = Math.max(-95, Math.min(95, this.mesh.position.z));
    }

    getGroundY(x, z) {
        return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 1.5 +
            Math.sin(x * 0.05 + 1) * Math.cos(z * 0.08) * 2;
    }

    updateCombat(dt, input) {
        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboQueue = [];
        }

        // Attack timer
        if (this.attacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.attacking = false;
        }

        // J = light attack (X), K = heavy attack (Y)
        if ((input.j || input.k) && !this.attacking) {
            const type = input.j ? 'X' : 'Y';
            input.j = false; input.k = false;

            this.attacking = true;
            this.attackTimer = this.attackDuration;
            this.comboQueue.push(type);
            this.comboTimer = this.comboWindow;

            // Check combo patterns
            const combo = this.comboQueue.join('-');
            const attackInfo = this.resolveCombo(combo);
            this.performAttack(attackInfo);

            if (this.comboQueue.length >= 3) {
                this.comboQueue = [];
            }
        }
    }

    resolveCombo(combo) {
        if (this.phase === 1) {
            if (combo === 'X-X-Y') return { name: 'Tre Già Măng Mọc', damage: this.attackDamage * 2.5, range: 3.5, stun: true, aoe: false };
            if (combo.endsWith('X')) return { name: 'Đòn Tre', damage: this.attackDamage, range: 2.5, stun: false, aoe: false };
            if (combo.endsWith('Y')) return { name: 'Đập Mạnh', damage: this.attackDamage * 1.5, range: 3, stun: false, aoe: false };
        } else {
            if (combo === 'X-Y-X') return { name: 'Long Quy Xuất Thế', damage: this.attackDamage * 3, range: 4, stun: false, aoe: true };
            if (combo.endsWith('X')) return { name: 'Chém Gươm', damage: this.attackDamage * 1.2, range: 3, stun: false, aoe: false };
            if (combo.endsWith('Y')) return { name: 'Sóng Nước', damage: this.attackDamage * 1.8, range: 3.5, stun: true, aoe: false };
        }
        return { name: 'Đánh', damage: this.attackDamage, range: 2.5, stun: false, aoe: false };
    }

    performAttack(info) {
        // Show combo name
        if (typeof showComboName === 'function') showComboName(info.name);

        // Get facing direction
        const fwd = new THREE.Vector3(
            Math.sin(this.mesh.rotation.y),
            0,
            Math.cos(this.mesh.rotation.y)
        );
        const attackOrigin = this.mesh.position.clone().add(fwd.clone().multiplyScalar(1.5));
        attackOrigin.y += 1.5;

        // Create visual slash
        this.createSlashEffect(attackOrigin, fwd, info);

        // Hitbox
        this.attackHitbox = [{
            pos: attackOrigin,
            range: info.range,
            damage: info.damage * this.getPatriotismMultiplier(),
            stun: info.stun,
            aoe: info.aoe
        }];
    }

    getPatriotismMultiplier() {
        return 1 + (this.mana / this.maxMana) * 0.5;
    }

    createSlashEffect(pos, dir, info) {
        const color = info.stun ? 0xFFD700 : (this.phase === 1 ? 0x228B22 : 0x00BFFF);
        const geo = new THREE.RingGeometry(0.3, info.range * 0.8, 8, 1, 0, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
        const slash = new THREE.Mesh(geo, mat);
        slash.position.copy(pos);
        slash.lookAt(pos.clone().add(dir));
        this.scene.add(slash);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.3) { this.scene.remove(slash); slash.geometry.dispose(); slash.material.dispose(); return; }
            slash.material.opacity = 0.7 * (1 - elapsed / 0.3);
            slash.scale.setScalar(1 + elapsed * 3);
            requestAnimationFrame(animate);
        };
        animate();
    }

    updateSkills(dt, input) {
        // Q: Shield (Tường Tre Vệ Quốc)
        this.shielding = input.q && this.stamina > 0;
        if (this.shielding) {
            this.stamina -= 15 * dt;
            this.shieldMesh.visible = true;
            this.shieldMesh.position.copy(this.mesh.position);
            this.shieldMesh.position.y += 1.5;
            this.shieldMesh.rotation.y += dt * 3;
            this.invincible = true;
        } else {
            this.shieldMesh.visible = false;
            if (!this.dashing) this.invincible = false;
        }

        // E: Arrow barrage (Vạn Tiễn Xuyên Tâm)
        if (input.e && this.arrowCooldown <= 0 && this.stamina >= 30) {
            this.fireArrows();
            this.arrowCooldown = this.arrowCdMax;
            this.stamina -= 30;
            input.e = false;
            if (typeof showComboName === 'function') showComboName('Vạn Tiễn Xuyên Tâm');
        }

        // R: Ultimate (Hào Khí Thăng Long)
        if (input.r && this.ultimateCooldown <= 0 && this.mana >= 80) {
            this.activateUltimate();
            this.ultimateCooldown = this.ultimateCdMax;
            this.mana -= 80;
            input.r = false;
            if (typeof showComboName === 'function') showComboName('🐉 Hào Khí Thăng Long!');
        }

        // Update dragon animation
        if (this.dragonActive) {
            this.dragonTimer -= dt;
            this.updateDragon(dt);
            if (this.dragonTimer <= 0) this.deactivateDragon();
        }
    }

    fireArrows() {
        const origin = this.mesh.position.clone();
        origin.y += 2;
        for (let i = 0; i < 8; i++) {
            const angle = this.mesh.rotation.y + (i - 3.5) * 0.15;
            const dir = new THREE.Vector3(Math.sin(angle), 0.1, Math.cos(angle));
            this.createArrow(origin.clone(), dir);
        }
        this.attackHitbox.push({
            pos: origin.clone().add(new THREE.Vector3(
                Math.sin(this.mesh.rotation.y) * 6, 0,
                Math.cos(this.mesh.rotation.y) * 6
            )),
            range: 8, damage: this.attackDamage * 2, stun: false, aoe: true
        });
    }

    createArrow(pos, dir) {
        const geo = new THREE.ConeGeometry(0.08, 0.6, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00BFFF, emissive: 0x00BFFF });
        const arrow = new THREE.Mesh(geo, mat);
        arrow.position.copy(pos);
        arrow.lookAt(pos.clone().add(dir));
        arrow.rotateX(Math.PI / 2);
        this.scene.add(arrow);

        const speed = 30;
        const startTime = Date.now();
        const fly = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 1) { this.scene.remove(arrow); return; }
            arrow.position.add(dir.clone().multiplyScalar(speed * 0.016));
            requestAnimationFrame(fly);
        };
        fly();
    }

    activateUltimate() {
        this.dragonActive = true;
        this.dragonTimer = 4;
        this.phase = 2; // Upgrade to phase 2

        // Create dragon mesh
        const dragonGroup = new THREE.Group();
        const segments = 20;
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 0.5,
            transparent: true, opacity: 0.8, metalness: 0.6
        });

        for (let i = 0; i < segments; i++) {
            const size = 0.6 - (i / segments) * 0.4;
            const seg = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), bodyMat);
            seg.name = `seg_${i}`;
            dragonGroup.add(seg);
        }

        // Dragon head
        const headMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFCC00, emissiveIntensity: 0.6, metalness: 0.7 });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1), headMat);
        head.name = 'dragonHead';
        dragonGroup.add(head);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        [-0.25, 0.25].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), eyeMat);
            eye.position.set(x, 0.15, -0.4);
            head.add(eye);
        });

        dragonGroup.position.copy(this.mesh.position);
        this.dragonMesh = dragonGroup;
        this.scene.add(dragonGroup);

        // Dragon light
        this.dragonLight = new THREE.PointLight(0xFFD700, 3, 30);
        this.scene.add(this.dragonLight);

        // AOE damage
        this.attackHitbox.push({
            pos: this.mesh.position.clone(),
            range: 15, damage: this.attackDamage * 5, stun: true, aoe: true
        });

        // Self heal 50% HP
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5);
    }

    updateDragon(dt) {
        if (!this.dragonMesh) return;
        const time = Date.now() / 1000;
        const center = this.mesh.position;

        // Spiral upward
        const progress = 1 - (this.dragonTimer / 4);
        const height = progress * 20;
        const radius = 5 + progress * 3;

        // Update dragon segments in spiral
        const segments = this.dragonMesh.children.filter(c => c.name.startsWith('seg_'));
        segments.forEach((seg, i) => {
            const offset = i * 0.3;
            const angle = time * 3 + offset;
            seg.position.set(
                center.x + Math.cos(angle) * radius,
                height - i * 0.5 + 5,
                center.z + Math.sin(angle) * radius
            );
        });

        // Head follows first segment
        const head = this.dragonMesh.getObjectByName('dragonHead');
        if (head && segments[0]) {
            head.position.copy(segments[0].position);
            head.position.y += 0.5;
            head.lookAt(center.x, height + 5, center.z);
        }

        // Dragon light
        if (this.dragonLight) {
            this.dragonLight.position.copy(center);
            this.dragonLight.position.y = height + 5;
            this.dragonLight.intensity = 3 * (1 - progress);
        }

        // Ground particles
        if (Math.random() > 0.7) {
            this.createDragonParticle(center);
        }
    }

    createDragonParticle(center) {
        const geo = new THREE.SphereGeometry(0.15, 4, 3);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.8 });
        const p = new THREE.Mesh(geo, mat);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 8;
        p.position.set(center.x + Math.cos(angle) * r, 0.5, center.z + Math.sin(angle) * r);
        this.scene.add(p);
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 1) { this.scene.remove(p); return; }
            p.position.y += dt * 5;
            p.material.opacity = 0.8 * (1 - elapsed);
            requestAnimationFrame(animate);
        };
        animate();
    }

    deactivateDragon() {
        this.dragonActive = false;
        if (this.dragonMesh) { this.scene.remove(this.dragonMesh); this.dragonMesh = null; }
        if (this.dragonLight) { this.scene.remove(this.dragonLight); this.dragonLight = null; }
    }

    updateCooldowns(dt) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.arrowCooldown > 0) this.arrowCooldown -= dt;
        if (this.ultimateCooldown > 0) this.ultimateCooldown -= dt;
        if (this.invTimer > 0) { this.invTimer -= dt; if (this.invTimer <= 0 && !this.shielding) this.invincible = false; }
    }

    updateVisuals(dt) {
        // Talisman glow pulse
        const talisman = this.mesh.getObjectByName('talisman');
        if (talisman) {
            talisman.rotation.y += dt * 2;
            const pulse = 0.3 + Math.sin(Date.now() / 500) * 0.2;
            talisman.material.emissiveIntensity = pulse;
        }

        // Invincibility flash
        if (this.invincible) {
            this.mesh.visible = Math.floor(Date.now() / 100) % 2 === 0;
        } else {
            this.mesh.visible = true;
        }
    }

    takeDamage(amount) {
        if (this.invincible || this.dead) return;
        this.hp -= amount;
        this.invincible = true;
        this.invTimer = 0.5;

        // Add mana from taking damage
        this.mana = Math.min(this.maxMana, this.mana + 5);

        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }

    collectItem(item) {
        if (item.userData.collected) return;
        item.userData.collected = true;
        item.visible = false;
        if (item.userData.glow) item.userData.glow.visible = false;

        if (item.userData.effect === 'hp') {
            this.hp = Math.min(this.maxHp, this.hp + item.userData.value);
        } else if (item.userData.effect === 'stamina') {
            this.stamina = Math.min(this.maxStamina, this.stamina + item.userData.value);
        }
    }

    getHitboxes() {
        const hb = [...this.attackHitbox];
        this.attackHitbox = [];
        return hb;
    }
}
