// ============== ENGINE.JS — Three.js Scene, Environment, Lighting ==============

class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 12, 18);
        this.cameraOffset = new THREE.Vector3(0, 12, 18);
        this.cameraTarget = new THREE.Vector3();

        // Clock
        this.clock = new THREE.Clock();
        this.items = [];
        this.platforms = [];

        window.addEventListener('resize', () => this.onResize());
    }

    init() {
        this.createLighting();
        this.createTerrain();
        this.createEnvironment();
        this.spawnItems();
    }

    createLighting() {
        // Ambient
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);

        // Sun
        this.sunLight = new THREE.DirectionalLight(0xFFD700, 1.2);
        this.sunLight.position.set(50, 80, 30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -60;
        this.sunLight.shadow.camera.right = 60;
        this.sunLight.shadow.camera.top = 60;
        this.sunLight.shadow.camera.bottom = -60;
        this.scene.add(this.sunLight);

        // Red accent light
        const redLight = new THREE.PointLight(0xC8102E, 0.6, 80);
        redLight.position.set(-20, 15, -20);
        this.scene.add(redLight);

        // Gold accent
        const goldLight = new THREE.PointLight(0xFFD700, 0.4, 60);
        goldLight.position.set(30, 10, 25);
        this.scene.add(goldLight);

        // Hemisphere
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x2d5a27, 0.4);
        this.scene.add(hemi);
    }

    createTerrain() {
        // Main ground
        const groundGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
        // Add some height variation
        const verts = groundGeo.attributes.position;
        for (let i = 0; i < verts.count; i++) {
            const x = verts.getX(i);
            const y = verts.getY(i);
            const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 1.5 +
                Math.sin(x * 0.05 + 1) * Math.cos(y * 0.08) * 2;
            verts.setZ(i, noise);
        }
        groundGeo.computeVertexNormals();
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x2d5a27, roughness: 0.9, metalness: 0.0,
            flatShading: true
        });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Water plane
        const waterGeo = new THREE.PlaneGeometry(200, 200);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a5276, transparent: true, opacity: 0.6,
            roughness: 0.2, metalness: 0.5
        });
        this.water = new THREE.Mesh(waterGeo, waterMat);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -2;
        this.scene.add(this.water);
    }

    createEnvironment() {
        // === Bamboo thickets ===
        for (let i = 0; i < 40; i++) {
            this.createBamboo(
                (Math.random() - 0.5) * 120,
                (Math.random() - 0.5) * 120
            );
        }

        // === Citadel Gate (Cổng Thành Cổ Loa) ===
        this.createCitadelGate(0, 0, -40);

        // === Stilt Houses ===
        this.createStiltHouse(-25, 0, 15);
        this.createStiltHouse(-35, 0, 25);
        this.createStiltHouse(30, 0, -15);

        // === Lotus Platforms ===
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = 20 + Math.random() * 15;
            this.createLotusPlatform(
                Math.cos(angle) * r,
                1 + Math.random() * 3,
                Math.sin(angle) * r
            );
        }

        // === Stone lanterns ===
        for (let i = 0; i < 10; i++) {
            this.createLantern(
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 80
            );
        }

        // === Torii-style Vietnamese gate pillars ===
        this.createGatePillars(15, 0, 0);
        this.createGatePillars(-15, 0, -20);
    }

    createBamboo(x, z) {
        const group = new THREE.Group();
        const count = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const h = 6 + Math.random() * 8;
            const geo = new THREE.CylinderGeometry(0.08, 0.12, h, 6);
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0.25, 0.5 + Math.random() * 0.3, 0.3 + Math.random() * 0.15),
                roughness: 0.8
            });
            const bamboo = new THREE.Mesh(geo, mat);
            bamboo.position.set(
                (Math.random() - 0.5) * 1.5,
                h / 2,
                (Math.random() - 0.5) * 1.5
            );
            bamboo.rotation.x = (Math.random() - 0.5) * 0.1;
            bamboo.rotation.z = (Math.random() - 0.5) * 0.1;
            bamboo.castShadow = true;
            group.add(bamboo);

            // Leaves at top
            const leafGeo = new THREE.SphereGeometry(1 + Math.random(), 5, 4);
            const leafMat = new THREE.MeshStandardMaterial({
                color: 0x228B22, roughness: 0.9, flatShading: true
            });
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.copy(bamboo.position);
            leaf.position.y = h - 0.5;
            leaf.castShadow = true;
            group.add(leaf);
        }
        group.position.set(x, 0, z);
        this.scene.add(group);
    }

    createCitadelGate(x, y, z) {
        const group = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.7, flatShading: true });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xC8102E, roughness: 0.5, flatShading: true });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3, metalness: 0.6 });

        // Pillars
        [-6, 6].forEach(px => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 2), wallMat);
            pillar.position.set(px, 5, 0);
            pillar.castShadow = true;
            group.add(pillar);
        });

        // Top beam
        const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 3), wallMat);
        beam.position.set(0, 10, 0);
        beam.castShadow = true;
        group.add(beam);

        // Roof
        const roofGeo = new THREE.ConeGeometry(10, 4, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 13, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Gold ornament
        const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), goldMat);
        ornament.position.set(0, 15.5, 0);
        group.add(ornament);

        // Walls extending outward
        [-1, 1].forEach(side => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 1.5), wallMat);
            wall.position.set(side * 17, 3, 0);
            wall.castShadow = true;
            wall.receiveShadow = true;
            group.add(wall);
        });

        group.position.set(x, y, z);
        this.scene.add(group);
    }

    createStiltHouse(x, y, z) {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8, flatShading: true });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, flatShading: true });

        // Stilts
        for (let sx = -2; sx <= 2; sx += 2) {
            for (let sz = -1.5; sz <= 1.5; sz += 3) {
                const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), woodMat);
                stilt.position.set(sx, 1.5, sz);
                stilt.castShadow = true;
                group.add(stilt);
            }
        }

        // Floor
        const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 4), woodMat);
        floor.position.set(0, 3, 0);
        floor.castShadow = true;
        group.add(floor);

        // Walls
        const wallBack = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.5, 0.2), woodMat);
        wallBack.position.set(0, 4.4, -1.8);
        group.add(wallBack);

        // Roof
        const roofGeo = new THREE.ConeGeometry(4.5, 2.5, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 6.8, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        group.position.set(x, y, z);
        this.scene.add(group);
    }

    createLotusPlatform(x, y, z) {
        const group = new THREE.Group();
        // Platform
        const platGeo = new THREE.CylinderGeometry(2.5, 2, 0.5, 12);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x7B8F6B, roughness: 0.7, flatShading: true });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.castShadow = true;
        plat.receiveShadow = true;
        group.add(plat);

        // Lotus petals
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const petalGeo = new THREE.SphereGeometry(0.8, 6, 4);
            petalGeo.scale(1, 0.3, 1.5);
            const petalMat = new THREE.MeshStandardMaterial({
                color: i % 2 === 0 ? 0xFF69B4 : 0xFFB6C1,
                roughness: 0.6, flatShading: true
            });
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.position.set(Math.cos(angle) * 1.8, 0.3, Math.sin(angle) * 1.8);
            petal.rotation.y = -angle;
            group.add(petal);
        }

        group.position.set(x, y, z);
        group.userData = { type: 'platform', radius: 2.5 };
        this.platforms.push(group);
        this.scene.add(group);
    }

    createLantern(x, z) {
        const group = new THREE.Group();
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, flatShading: true });

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), stoneMat);
        group.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2, 6), stoneMat);
        pole.position.y = 1.15;
        group.add(pole);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), stoneMat);
        top.position.y = 2.3;
        group.add(top);

        // Glow
        const light = new THREE.PointLight(0xFFAA33, 0.5, 8);
        light.position.y = 2.3;
        group.add(light);

        group.position.set(x, 0, z);
        this.scene.add(group);
    }

    createGatePillars(x, y, z) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xC8102E, roughness: 0.5, flatShading: true });
        [-3, 3].forEach(px => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 6, 8), mat);
            pillar.position.set(x + px, 3, z);
            pillar.castShadow = true;
            this.scene.add(pillar);
        });
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 0.6), mat);
        topBeam.position.set(x, 6.3, z);
        this.scene.add(topBeam);
    }

    spawnItems() {
        const itemDefs = [
            { type: 'banhChung', color: 0x228B22, emoji: '🍚', effect: 'hp', value: 30 },
            { type: 'traDa', color: 0x00BCD4, emoji: '🧊', effect: 'stamina', value: 40 },
        ];
        for (let i = 0; i < 12; i++) {
            const def = itemDefs[i % 2];
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;
            this.createItem(x, 1.2, z, def);
        }
    }

    createItem(x, y, z, def) {
        const geo = def.type === 'banhChung'
            ? new THREE.BoxGeometry(0.8, 0.8, 0.8)
            : new THREE.OctahedronGeometry(0.5);
        const mat = new THREE.MeshStandardMaterial({
            color: def.color, roughness: 0.3, metalness: 0.4,
            emissive: def.color, emissiveIntensity: 0.3
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.userData = { ...def, collected: false };

        // Glow
        const glow = new THREE.PointLight(def.color, 0.4, 5);
        glow.position.copy(mesh.position);
        glow.position.y += 0.5;
        mesh.userData.glow = glow;
        this.scene.add(glow);

        this.items.push(mesh);
        this.scene.add(mesh);
    }

    updateItems(dt) {
        const time = this.clock.getElapsedTime();
        this.items.forEach(item => {
            if (!item.userData.collected) {
                item.rotation.y += dt * 2;
                item.position.y = 1.2 + Math.sin(time * 2 + item.position.x) * 0.3;
            }
        });
    }

    updateCamera(targetPos, dt) {
        this.cameraTarget.lerp(targetPos, 4 * dt);
        const desired = this.cameraTarget.clone().add(this.cameraOffset);
        this.camera.position.lerp(desired, 3 * dt);
        this.camera.lookAt(this.cameraTarget.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
