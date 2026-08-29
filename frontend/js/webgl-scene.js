/**
 * Zynero WebGL scene
 * Neural field, holographic core, orbiting rings, and traveling energy sparks.
 */
(function initZyneroScene() {
  const boot = () => {
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas || typeof THREE === 'undefined') {
      console.warn('WebGL canvas or Three.js not found.');
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = () => window.innerWidth < 768;
    const isDesktop = () => window.innerWidth > 1024;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070a13, 0.012);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 0, 62);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;

    const COLOR_VIOLET = new THREE.Color(0x8b5cf6);
    const COLOR_PINK = new THREE.Color(0xec4899);
    const COLOR_CYAN = new THREE.Color(0x67e8f9);
    const COLOR_WHITE = new THREE.Color(0xf8fafc);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let running = true;

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let scrollY = window.scrollY || 0;
    let scrollSmooth = 0;

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    };

    /* ------------------------------------------------------------------ */
    /* Soft particle field                                                */
    /* ------------------------------------------------------------------ */
    const particleCount = isMobile() ? 420 : 1100;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const particleOrigins = [];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * 160;
      const y = (Math.random() - 0.5) * 110;
      const z = (Math.random() - 0.5) * 80 - 8;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      particleOrigins.push(new THREE.Vector3(x, y, z));

      const mix = Math.pow(Math.random(), 1.35);
      const c = COLOR_VIOLET.clone().lerp(COLOR_PINK, mix);
      if (Math.random() > 0.82) c.lerp(COLOR_CYAN, 0.55);
      else if (Math.random() > 0.9) c.lerp(COLOR_WHITE, 0.4);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      sizes[i] = 1.4 + Math.random() * 4.8;
      phases[i] = Math.random() * Math.PI * 2;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    particleGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime,
        uPixelRatio: uniforms.uPixelRatio
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          float t = uTime * 0.22 + aPhase;
          vec3 pos = position;
          pos.x += sin(t + position.y * 0.045) * 1.85;
          pos.y += cos(t * 0.85 + position.x * 0.04) * 1.35;
          pos.z += sin(t * 0.62 + position.z * 0.05) * 1.1;
          vTwinkle = 0.72 + 0.28 * sin(t * 2.4);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float dist = max(-mvPosition.z, 1.0);
          gl_PointSize = aSize * uPixelRatio * (90.0 / dist);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float d = length(uv);
          if (d > 1.0) discard;
          float glow = exp(-d * d * 3.8);
          float core = smoothstep(0.28, 0.0, d);
          vec3 col = vColor * (0.55 + core * 1.8) * vTwinkle;
          float alpha = (glow * 0.85 + core * 0.5) * vTwinkle;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const particleMesh = new THREE.Points(particleGeo, particleMat);
    scene.add(particleMesh);

    /* ------------------------------------------------------------------ */
    /* Neural connections                                                 */
    /* ------------------------------------------------------------------ */
    const maxDist = isMobile() ? 16 : 14.5;
    const maxLinks = isMobile() ? 2 : 3;
    const edges = [];
    const used = new Uint8Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      if (used[i] >= maxLinks) continue;
      let nearest = [];
      for (let j = i + 1; j < particleCount; j++) {
        if (used[j] >= maxLinks) continue;
        const d = particleOrigins[i].distanceTo(particleOrigins[j]);
        if (d < maxDist) nearest.push({ j, d });
      }
      nearest.sort((a, b) => a.d - b.d);
      const take = nearest.slice(0, maxLinks - used[i]);
      take.forEach(({ j }) => {
        if (used[j] >= maxLinks) return;
        edges.push([i, j]);
        used[i]++;
        used[j]++;
      });
    }

    const linePositions = new Float32Array(edges.length * 6);
    const lineProgress = new Float32Array(edges.length * 2);
    edges.forEach((pair, idx) => {
      const a = particleOrigins[pair[0]];
      const b = particleOrigins[pair[1]];
      const o = idx * 6;
      linePositions[o] = a.x;
      linePositions[o + 1] = a.y;
      linePositions[o + 2] = a.z;
      linePositions[o + 3] = b.x;
      linePositions[o + 4] = b.y;
      linePositions[o + 5] = b.z;
      lineProgress[idx * 2] = 0;
      lineProgress[idx * 2 + 1] = 1;
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('aProgress', new THREE.BufferAttribute(lineProgress, 1));

    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime,
        uColorA: { value: COLOR_VIOLET.clone() },
        uColorB: { value: COLOR_PINK.clone() }
      },
      vertexShader: `
        attribute float aProgress;
        varying float vProgress;
        void main() {
          vProgress = aProgress;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vProgress;
        void main() {
          float wave = fract(vProgress - uTime * 0.12);
          float pulse = smoothstep(0.0, 0.08, wave) * smoothstep(0.45, 0.12, wave);
          float base = 0.16 + pulse * 0.85;
          vec3 col = mix(uColorA, uColorB, vProgress);
          col += vec3(0.35, 0.55, 1.0) * pulse * 0.45;
          gl_FragColor = vec4(col, base);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const networkLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(networkLines);

    /* ------------------------------------------------------------------ */
    /* Traveling sparks along connections                                 */
    /* ------------------------------------------------------------------ */
    const sparkCount = Math.min(edges.length, isMobile() ? 48 : 110);
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkColor = new Float32Array(sparkCount * 3);
    const sparkSize = new Float32Array(sparkCount);
    const sparkMeta = [];

    for (let i = 0; i < sparkCount; i++) {
      const edge = edges[i % edges.length];
      sparkMeta.push({
        a: particleOrigins[edge[0]],
        b: particleOrigins[edge[1]],
        t: Math.random(),
        speed: 0.12 + Math.random() * 0.28,
        dir: Math.random() > 0.5 ? 1 : -1
      });
      const c = Math.random() > 0.5 ? COLOR_CYAN : COLOR_PINK;
      sparkColor[i * 3] = c.r;
      sparkColor[i * 3 + 1] = c.g;
      sparkColor[i * 3 + 2] = c.b;
      sparkSize[i] = 3.5 + Math.random() * 4.5;
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColor, 3));
    sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));

    const sparkMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: uniforms.uPixelRatio
      },
      vertexShader: `
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 1.0);
          gl_PointSize = aSize * uPixelRatio * (110.0 / dist);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float d = length(uv);
          if (d > 1.0) discard;
          float glow = exp(-d * d * 2.6);
          gl_FragColor = vec4(vColor * 1.6, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    function updateSparks(dt) {
      const arr = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkCount; i++) {
        const s = sparkMeta[i];
        s.t += dt * s.speed * s.dir;
        if (s.t > 1) { s.t = 1; s.dir = -1; }
        if (s.t < 0) { s.t = 0; s.dir = 1; }
        const i3 = i * 3;
        arr[i3] = s.a.x + (s.b.x - s.a.x) * s.t;
        arr[i3 + 1] = s.a.y + (s.b.y - s.a.y) * s.t;
        arr[i3 + 2] = s.a.z + (s.b.z - s.a.z) * s.t;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    /* ------------------------------------------------------------------ */
    /* Holographic AI core                                                */
    /* ------------------------------------------------------------------ */
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    function placeCore() {
      coreGroup.position.set(isDesktop() ? 18 : 0, isDesktop() ? 1.5 : 14, 0);
    }
    placeCore();

    const coreUniforms = {
      uTime: uniforms.uTime,
      uColorA: { value: new THREE.Color(0x8b5cf6) },
      uColorB: { value: new THREE.Color(0xec4899) },
      uOpacity: { value: 0.55 }
    };

    const holoVertex = `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `;

    const holoFragment = `
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        float fresnel = pow(1.0 - abs(dot(n, v)), 2.4);
        float scan = 0.55 + 0.45 * sin(vWorld.y * 2.4 - uTime * 2.2);
        float hex = abs(sin(vWorld.x * 3.5 + uTime) * sin(vWorld.y * 4.0 - uTime * 0.7));
        vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(uTime * 0.6 + vWorld.y * 0.4));
        col += fresnel * vec3(0.55, 0.85, 1.0);
        col += hex * 0.12;
        float alpha = uOpacity * (0.18 + fresnel * 0.85) * scan;
        gl_FragColor = vec4(col, clamp(alpha, 0.05, 0.95));
      }
    `;

    const outerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(11.5, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: coreUniforms.uTime,
          uColorA: coreUniforms.uColorA,
          uColorB: coreUniforms.uColorB,
          uOpacity: { value: 0.42 }
        },
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        wireframe: true
      })
    );
    coreGroup.add(outerCore);

    const innerCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7.2, 3),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: coreUniforms.uTime,
          uColorA: { value: new THREE.Color(0xec4899) },
          uColorB: { value: new THREE.Color(0xa78bfa) },
          uOpacity: { value: 0.7 }
        },
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreGroup.add(innerCore);

    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf5d0fe,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreGroup.add(nucleus);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(14.5, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      })
    );
    coreGroup.add(halo);

    const rings = [];
    const ringConfigs = [
      { r: 13.5, t: 0.045, rx: Math.PI / 2.2, rz: 0.3, speed: 0.22, color: 0x8b5cf6 },
      { r: 16.2, t: 0.03, rx: Math.PI / 3.4, rz: 1.1, speed: -0.16, color: 0xec4899 },
      { r: 18.8, t: 0.02, rx: Math.PI / 5, rz: -0.6, speed: 0.11, color: 0x67e8f9 }
    ];
    ringConfigs.forEach((cfg) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.r, cfg.t, 12, 128),
        new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = cfg.rx;
      ring.rotation.z = cfg.rz;
      ring.userData.speed = cfg.speed;
      coreGroup.add(ring);
      rings.push(ring);
    });

    /* ------------------------------------------------------------------ */
    /* Interaction                                                        */
    /* ------------------------------------------------------------------ */
    const onPointerMove = (event) => {
      const cx = event.touches ? event.touches[0].clientX : event.clientX;
      const cy = event.touches ? event.touches[0].clientY : event.clientY;
      mouse.targetX = (cx / window.innerWidth) * 2 - 1;
      mouse.targetY = (cy / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('scroll', () => {
      scrollY = window.scrollY || 0;
    }, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
      uniforms.uPixelRatio.value = renderer.getPixelRatio();
      placeCore();
    };
    window.addEventListener('resize', onResize);

    document.addEventListener('visibilitychange', () => {
      running = document.visibilityState === 'visible';
      if (running) {
        clock.getDelta();
        animate();
      }
    });

    /* ------------------------------------------------------------------ */
    /* Animation                                                          */
    /* ------------------------------------------------------------------ */
    const damp = (current, target, lambda, dt) =>
      current + (target - current) * (1 - Math.exp(-lambda * dt));

    let raf = 0;

    function animate() {
      if (!running) return;
      raf = requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      uniforms.uTime.value = elapsed;

      if (!prefersReducedMotion) {
        mouse.x = damp(mouse.x, mouse.targetX, 3.2, dt);
        mouse.y = damp(mouse.y, mouse.targetY, 3.2, dt);
        scrollSmooth = damp(scrollSmooth, scrollY, 2.4, dt);

        particleMesh.rotation.y = mouse.x * 0.18 + elapsed * 0.018;
        particleMesh.rotation.x = mouse.y * 0.1;
        networkLines.rotation.copy(particleMesh.rotation);
        sparks.rotation.copy(particleMesh.rotation);

        coreGroup.rotation.y += dt * 0.22;
        outerCore.rotation.y += dt * 0.18;
        outerCore.rotation.x += dt * 0.07;
        innerCore.rotation.y -= dt * 0.28;
        innerCore.rotation.z += dt * 0.11;

        const pulse = 1 + Math.sin(elapsed * 2.05) * 0.045;
        innerCore.scale.setScalar(pulse);
        nucleus.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.12);
        nucleus.material.opacity = 0.38 + Math.sin(elapsed * 2.4) * 0.18;

        rings.forEach((ring, i) => {
          ring.rotation.z += dt * ring.userData.speed;
          ring.rotation.y += dt * ring.userData.speed * 0.35;
          ring.material.opacity = 0.38 + Math.sin(elapsed * 1.4 + i) * 0.18;
        });

        updateSparks(dt);

        const scrollInfluence = scrollSmooth * 0.0012;
        camera.position.x = mouse.x * 4.5;
        camera.position.y = -scrollInfluence * 16 + mouse.y * 2.2;
        camera.position.z = 62 - Math.min(scrollInfluence * 8, 18);
        camera.lookAt(mouse.x * 3, 2 - scrollInfluence * 6, 0);

        placeCore();
        coreGroup.position.y += scrollInfluence * 10;
        coreGroup.position.x += mouse.x * 1.6;
      } else {
        renderer.render(scene, camera);
        return;
      }

      renderer.render(scene, camera);
    }

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
