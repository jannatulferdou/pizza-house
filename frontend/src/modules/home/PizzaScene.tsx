import { useEffect, useRef } from "react";
import { useLayoutEffect, useState } from "react";
import type { PlateFinish, PizzaConfiguration } from "@pizza-house/shared/types";
import { defaultPizza } from "@pizza-house/shared/pizza-options";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
function texture(kind: "crust" | "sauce") {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = kind === "crust" ? "#d69b4e" : "#bb3820";
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 54;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 9000; i++) {
    const x = rand() * 1024,
      y = rand() * 1024,
      r = rand() * (kind === "crust" ? 22 : 35) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle =
      kind === "crust"
        ? `rgba(${rand() > 0.4 ? "80,36,10" : "255,215,132"},${rand() * 0.22})`
        : `rgba(${rand() > 0.5 ? "255,134,48" : "94,20,8"},${rand() * 0.25})`;
    ctx.fill();
  }
  if (kind === "crust") {
    for (let i = 0; i < 240; i++) {
      ctx.beginPath();
      ctx.ellipse(
        rand() * 1024,
        rand() * 1024,
        2 + rand() * 9,
        2 + rand() * 6,
        rand() * 6,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = `rgba(53,24,12,${0.15 + rand() * 0.55})`;
      ctx.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}
export default function PizzaScene({
  reveal = false,
  finish = "Ivory",
  customize = false,
  options = defaultPizza,
  paused = false,
}: {
  reveal?: boolean;
  finish?: PlateFinish;
  customize?: boolean;
  options?: PizzaConfiguration;
  paused?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    plateRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const alignedInitialHash = useRef(false);
  const [systemReduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reduced = systemReduced || paused;
  const configurationKey = JSON.stringify(options);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    plateRef.current?.color.set(
      { Ivory: "#d9d1c0", Charcoal: "#353b39", Terracotta: "#b45030" }[finish],
    );
  }, [finish]);
  // Restore ScrollTrigger's pin wrapper before React removes the parent.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      parent.classList.add("is-fallback");
      return () => parent.classList.remove("is-fallback");
    }
    const lowPower =
      navigator.hardwareConcurrency <= 4 ||
      ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
        8) <= 4;
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1 : 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    camera.position.set(0, 6.5, 8.5);
    camera.lookAt(0, 0, 0);
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff5df, 0x716048, 1.15));
    const light = new THREE.DirectionalLight(0xffecd4, 2.7);
    light.position.set(-3, 8, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024);
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 6;
    light.shadow.camera.bottom = -5;
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 5;
    scene.add(light);
    const rimLight = new THREE.DirectionalLight(0xffe0a0, 1.2);
    rimLight.position.set(3, 3, -4);
    scene.add(rimLight);
    const pizza = new THREE.Group();
    pizza.rotation.y = -0.18;
    scene.add(pizza);
    const crustTex = texture("crust"),
      sauceTex = texture("sauce");
    crustTex.colorSpace = sauceTex.colorSpace = THREE.SRGBColorSpace;
    const crust = new THREE.MeshStandardMaterial({
        map: crustTex,
        roughness: 0.85,
        bumpMap: crustTex,
        bumpScale: 0.06,
      }),
      sauce = new THREE.MeshStandardMaterial({
        map: sauceTex,
        roughness: 0.42,
      }),
      cheese = new THREE.MeshStandardMaterial({
        color: "#ffe4a1",
        roughness: 0.42,
      }),
      basilMat = new THREE.MeshStandardMaterial({
        color: "#326522",
        roughness: 0.65,
        side: THREE.DoubleSide,
      });
    function mesh<G extends THREE.BufferGeometry>(
      geo: G,
      mat: THREE.Material,
      parent: THREE.Object3D,
      x = 0,
      y = 0,
      z = 0,
    ) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    plateRef.current = new THREE.MeshStandardMaterial({
      color: { Ivory: "#d9d1c0", Charcoal: "#353b39", Terracotta: "#b45030" }[
        finish
      ],
      roughness: 0.32,
      metalness: 0.22,
    });
    const plate = new THREE.Group();
    pizza.add(plate);
    mesh(
      new THREE.CylinderGeometry(2.43, 2.3, 0.065, 96),
      plateRef.current,
      plate,
      0,
      -0.19,
    );
    const rim = mesh(
      new THREE.TorusGeometry(2.36, 0.055, 12, 100),
      plateRef.current,
      plate,
      0,
      -0.14,
    );
    rim.rotation.x = Math.PI / 2;
    const base = new THREE.Group(),
      toppings = new THREE.Group(),
      leaves = new THREE.Group();
    const slice = new THREE.Group(),
      sliceBase = new THREE.Group(),
      sliceToppings = new THREE.Group(),
      sliceLeaves = new THREE.Group();
    slice.add(sliceBase, sliceToppings, sliceLeaves);
    pizza.add(base, toppings, leaves, slice);
    const sliceAngle = Math.PI / 4;
    const isSlice = (x: number, z: number) => {
      const angle = Math.atan2(x, z);
      return angle >= 0 && angle <= sliceAngle;
    };
    const baseHeight = options.crust === "thin" ? 0.09 : 0.16;
    mesh(
      new THREE.CylinderGeometry(
        2.15,
        2.1,
        baseHeight,
        80,
        1,
        false,
        sliceAngle,
        Math.PI * 2 - sliceAngle,
      ),
      crust,
      base,
    );
    mesh(
      new THREE.CylinderGeometry(
        2.15,
        2.1,
        baseHeight,
        18,
        1,
        false,
        0,
        sliceAngle,
      ),
      crust,
      sliceBase,
    );
    const crustRadius =
      options.crust === "thin"
        ? 0.12
        : options.crust === "cheese"
          ? 0.23
          : 0.185;
    const torus = mesh(
      new THREE.TorusGeometry(
        1.99,
        crustRadius,
        20,
        100,
        Math.PI * 2 - sliceAngle,
      ),
      crust,
      base,
      0,
      0.09,
    );
    torus.rotation.x = Math.PI / 2;
    torus.rotation.z = Math.PI / 2;
    const sliceCrust = mesh(
      new THREE.TorusGeometry(1.99, crustRadius, 20, 16, sliceAngle),
      crust,
      sliceBase,
      0,
      0.09,
    );
    sliceCrust.rotation.x = Math.PI / 2;
    sliceCrust.rotation.z = Math.PI / 4;
    for (const crustMesh of [torus, sliceCrust]) {
      const pos = crustMesh.geometry.attributes.position;
      const uv = crustMesh.geometry.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i);
        const a = Math.atan2(y, x);
        // Planar UVs keep toasted spots round instead of stretching around the rim.
        uv.setXY(i, (x + 2.3) / 4.6, (y + 2.3) / 4.6);
        pos.setZ(
          i,
          pos.getZ(i) + Math.sin(a * 17) * 0.025 + Math.cos(a * 31) * 0.015,
        );
      }
      crustMesh.geometry.computeVertexNormals();
    }
    mesh(
      new THREE.CylinderGeometry(
        1.92,
        1.92,
        0.035,
        80,
        1,
        false,
        sliceAngle,
        Math.PI * 2 - sliceAngle,
      ),
      sauce,
      toppings,
      0,
      0.115,
    );
    mesh(
      new THREE.CylinderGeometry(
        1.92,
        1.92,
        0.035,
        18,
        1,
        false,
        0,
        sliceAngle,
      ),
      sauce,
      sliceToppings,
      0,
      0.115,
    );
    let seed = 179;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (
      let i = 0;
      i < (options.toppings.includes("mozzarella") ? 42 : 28);
      i++
    ) {
      const a = rand() * Math.PI * 2,
        r = Math.sqrt(rand()) * 1.58;
      const m = mesh(
        new THREE.SphereGeometry(0.2 + rand() * 0.17, 16, 10),
        cheese,
        isSlice(Math.cos(a) * r, Math.sin(a) * r) ? sliceToppings : toppings,
        Math.cos(a) * r,
        0.17,
        Math.sin(a) * r,
      );
      m.scale.set(1, 0.15, 0.6 + rand() * 0.5);
      const cheesePositions = m.geometry.attributes.position;
      for (let j = 0; j < cheesePositions.count; j++) {
        const x = cheesePositions.getX(j),
          y = cheesePositions.getY(j),
          z = cheesePositions.getZ(j);
        const ripple = 1 + Math.sin(x * 24 + z * 15) * 0.1;
        cheesePositions.setXYZ(j, x * ripple, y, z * ripple);
      }
      m.geometry.computeVertexNormals();
      m.rotation.y = rand() * 6;
      for (let j = 0; j < 3; j++) {
        const b = mesh(
          new THREE.SphereGeometry(0.015 + rand() * 0.025, 7, 5),
          crust,
          m.parent!,
          m.position.x + (rand() - 0.5) * 0.3,
          0.205,
          m.position.z + (rand() - 0.5) * 0.25,
        );
        b.scale.y = 0.2;
      }
    }
    for (let i = 0; i < 11; i++) {
      const a = rand() * 6.28,
        r = 0.4 + rand() * 1.3;
      const group = new THREE.Group();
      group.position.set(Math.cos(a) * r, 0.245, Math.sin(a) * r);
      group.rotation.y = a;
      (isSlice(group.position.x, group.position.z) ? sliceLeaves : leaves).add(
        group,
      );
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.26);
      shape.bezierCurveTo(-0.25, -0.08, -0.2, 0.22, 0, 0.32);
      shape.bezierCurveTo(0.23, 0.14, 0.17, -0.1, 0, -0.26);
      const leaf = mesh(new THREE.ShapeGeometry(shape, 12), basilMat, group);
      const leafPositions = leaf.geometry.attributes.position;
      for (let j = 0; j < leafPositions.count; j++) {
        const x = leafPositions.getX(j),
          y = leafPositions.getY(j);
        leafPositions.setZ(j, Math.sin(y * 7) * 0.055 + Math.abs(x) * 0.18);
      }
      leaf.geometry.computeVertexNormals();
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.y = 0.18;
      const vein = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0.01, -0.3),
          new THREE.Vector3(0, 0.01, 0.25),
        ]),
        new THREE.LineBasicMaterial({ color: "#669b3e" }),
      );
      group.add(vein);
    }
    const satellites = new THREE.Group();
    scene.add(satellites);
    const tomatoMat = new THREE.MeshStandardMaterial({
      color: "#be3520",
      roughness: 0.3,
    });
    const tomatoGeo = new THREE.SphereGeometry(0.18, 18, 12);
    for (let i = 0; i < 7; i++) {
      const satellite = new THREE.Group();
      satellites.add(satellite);
      if (i % 2 === 0) {
        const tomato = mesh(tomatoGeo, tomatoMat, satellite);
        tomato.scale.y = 0.85;
        for (let j = 0; j < 5; j++) {
          const tip = mesh(
            new THREE.ConeGeometry(0.035, 0.17, 4),
            basilMat,
            satellite,
            0,
            0.16,
          );
          tip.rotation.z = 0.9;
          tip.rotation.y = j * Math.PI * 0.4;
        }
      } else {
        const leaf = (
          leaves.children[i % leaves.children.length] as THREE.Group
        ).clone();
        leaf.position.set(0, 0, 0);
        leaf.rotation.x = 0.5;
        leaf.scale.setScalar(1.3);
        satellite.add(leaf);
      }
    }
    const extraMaterials = {
      olives: new THREE.MeshStandardMaterial({
        color: "#24251b",
        roughness: 0.42,
      }),
      pepperoni: new THREE.MeshStandardMaterial({
        color: "#b63b20",
        roughness: 0.55,
      }),
      mushrooms: new THREE.MeshStandardMaterial({
        color: "#bca184",
        roughness: 0.85,
      }),
    };
    for (const topping of options.toppings) {
      if (topping === "mozzarella") continue;
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + topping.length,
          r = 0.5 + (i % 3) * 0.46;
        const x = Math.cos(a) * r,
          z = Math.sin(a) * r;
        const part = isSlice(x, z) ? sliceToppings : toppings;
        if (topping === "olives") {
          const olive = mesh(
            new THREE.TorusGeometry(0.1, 0.04, 8, 14),
            extraMaterials.olives,
            part,
            x,
            0.24,
            z,
          );
          olive.rotation.x = Math.PI / 2;
        } else if (topping === "pepperoni") {
          mesh(
            new THREE.CylinderGeometry(0.21, 0.2, 0.025, 18),
            extraMaterials.pepperoni,
            part,
            x,
            0.245,
            z,
          );
        } else {
          const cap = mesh(
            new THREE.SphereGeometry(
              0.17,
              12,
              8,
              0,
              Math.PI * 2,
              0,
              Math.PI / 2,
            ),
            extraMaterials.mushrooms,
            part,
            x,
            0.25,
            z,
          );
          cap.scale.y = 0.4;
          mesh(
            new THREE.BoxGeometry(0.07, 0.04, 0.19),
            extraMaterials.mushrooms,
            part,
            x,
            0.24,
            z + 0.1,
          );
        }
      }
    }
    const strands = Array.from({ length: 4 }, (_, i) => ({
      mesh: mesh(new THREE.CylinderGeometry(0.012, 0.026, 1, 8), cheese, pizza),
      anchor: new THREE.Vector3(i % 2 ? 0.7 : 0.03, 0.19, 0.65 + i * 0.27),
    }));
    const up = new THREE.Vector3(0, 1, 0),
      strandTip = new THREE.Vector3(),
      strandDirection = new THREE.Vector3();
    const ground = mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
      scene,
      0,
      -0.65,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;
    const labels = reveal
      ? parent.querySelector<HTMLElement>(".ingredient-labels")
      : null;
    const labelEls = labels ? [...labels.querySelectorAll("span")] : [];
    const leaderSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    leaderSvg.classList.add("leader-svg");
    leaderSvg.setAttribute("aria-hidden", "true");
    const lines = labelEls.map(() => {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("stroke", "#d7dea880");
      line.setAttribute("stroke-width", "1");
      leaderSvg.appendChild(line);
      return line;
    });
    if (reveal) parent.appendChild(leaderSvg);
    const state = {
      rotation: -0.18,
      explode: reduced && reveal ? 1 : 0,
      zoom: 1,
      tilt: reveal ? 0 : 0.12,
      drift: 0,
      progress: 0,
      sliceLift: 0,
    };
    let timeline: gsap.core.Timeline | undefined;
    const mobile = () => window.innerWidth <= 600;
    const chapters = [
      ...parent.querySelectorAll<HTMLElement>(".journey-chapter"),
    ];
    const steps = [
      ...parent.querySelectorAll<HTMLElement>(".journey-steps > span"),
    ];
    const progressBar = parent.querySelector<HTMLElement>(
      ".journey-progress i",
    );
    let activeChapter = -1;
    const setChapter = (index: number) => {
      if (activeChapter === index) return;
      activeChapter = index;
      chapters.forEach((chapter, i) => {
        chapter.style.opacity = i === index ? "1" : "0";
        chapter.style.visibility = i === index ? "visible" : "hidden";
        chapter.style.transform =
          i === index ? "translateY(0)" : "translateY(14px)";
        chapter.setAttribute("aria-hidden", String(i !== index));
        chapter.inert = i !== index;
      });
      steps.forEach((step, i) =>
        step.classList.toggle("is-active", i === index),
      );
    };
    if (reveal) setChapter(reduced ? 1 : 0);
    if (reveal && !reduced) {
      timeline = gsap.timeline({
        scrollTrigger: {
          trigger: parent,
          start: "top top",
          end: () => `+=${window.innerHeight * (mobile() ? 3.1 : 3.8)}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      timeline
        .to(state, {
          rotation: 0.7,
          tilt: 0.14,
          zoom: 1.12,
          duration: 1.4,
          ease: "power1.inOut",
        })
        .to(state, {
          rotation: 1.25,
          tilt: -0.08,
          zoom: 0.91,
          explode: 1,
          duration: 1.5,
          ease: "power2.inOut",
        })
        .to(state, { rotation: 1.65, explode: 1, duration: 1.3, ease: "none" })
        .to(state, {
          rotation: 2.65,
          tilt: 0.15,
          zoom: 1.08,
          explode: 0,
          duration: 1.6,
          ease: "power2.inOut",
        })
        .to(state, { rotation: 3.7, duration: 0.7, ease: "power1.inOut" })
        .to(state, {
          sliceLift: 1,
          zoom: 0.95,
          tilt: 0.02,
          duration: 1.1,
          ease: "power2.inOut",
        })
        .to(state, { sliceLift: 1, duration: 0.8 });
      timeline.to(
        state,
        { progress: 1, duration: timeline.duration(), ease: "none" },
        0,
      );
    } else if (!reduced && !customize) {
      timeline = gsap.timeline({
        scrollTrigger: {
          trigger: parent.closest(".house-hero"),
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      timeline.to(state, {
        rotation: 0.85,
        tilt: -0.18,
        drift: -0.45,
        duration: 1,
        ease: "none",
      });
    }
    let pointer = { x: 0, y: 0 },
      current = { x: 0, y: 0 };
    const move = (e: PointerEvent) => {
      if (reduced || e.pointerType === "touch") return;
      const b = el.getBoundingClientRect();
      pointer.x = ((e.clientX - b.left) / b.width - 0.5) * 0.13;
      pointer.y = ((e.clientY - b.top) / b.height - 0.5) * 0.08;
    };
    const reset = () => {
      pointer.x = pointer.y = 0;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", reset);
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let visible = true;
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(el);
    let frame: number;
    let lastRender = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden) return;
      const now = performance.now();
      if (now - lastRender < (lowPower ? 32 : 16)) return;
      lastRender = now;
      current.x += (pointer.x - current.x) * 0.05;
      current.y += (pointer.y - current.y) * 0.05;
      pizza.rotation.y = state.rotation + current.x;
      pizza.rotation.x = state.tilt + current.y;
      const time = reduced ? 0 : performance.now() * 0.00045;
      pizza.position.y =
        state.drift + (reduced ? 0 : Math.sin(time * 1.5) * 0.045);
      leaves.position.y = state.explode * 1.65;
      toppings.position.y = state.explode * 0.85;
      sliceLeaves.position.y = leaves.position.y;
      sliceToppings.position.y = toppings.position.y;
      slice.position.set(
        state.sliceLift * 0.45,
        state.sliceLift * 1.25,
        state.sliceLift * 0.7,
      );
      slice.rotation.z = -state.sliceLift * 0.12;
      strands.forEach((strand) => {
        strand.mesh.visible = state.sliceLift > 0.025;
        strandTip
          .copy(strand.anchor)
          .applyQuaternion(slice.quaternion)
          .add(slice.position);
        strandDirection.subVectors(strandTip, strand.anchor);
        strand.mesh.position
          .copy(strand.anchor)
          .addScaledVector(strandDirection, 0.5);
        strand.mesh.scale.set(
          1 - state.sliceLift * 0.4,
          Math.max(0.001, strandDirection.length()),
          1 - state.sliceLift * 0.4,
        );
        if (strandDirection.lengthSq() > 0)
          strand.mesh.quaternion.setFromUnitVectors(
            up,
            strandDirection.normalize(),
          );
      });
      pizza.scale.setScalar(
        customize ? (options.size === "large" ? 1.03 : 0.9) : 1,
      );
      satellites.visible = !customize;
      plate.position.y = -state.explode * 0.35;
      leaves.rotation.y = state.explode * 0.16;
      satellites.children.forEach((satellite, i) => {
        const angle =
          (i / 7) * Math.PI * 2 + time * 0.12 + state.rotation * 0.25;
        const radius = 2.85 + Math.sin(i * 3) * 0.22;
        satellite.position.set(
          Math.cos(angle) * radius,
          0.4 + Math.sin(i * 2 + time) * 0.45 + state.explode * 0.7,
          Math.sin(angle) * radius,
        );
        satellite.rotation.set(time * 0.2 + i, angle, Math.sin(time + i) * 0.3);
        satellite.scale.setScalar(reveal ? 0.75 : 1);
      });
      const w = el.clientWidth,
        h = el.clientHeight;
      const aspect = w / h;
      const distance = reveal ? (aspect < 1 ? 12 : 8.8) : aspect < 1 ? 9 : 7.3;
      camera.position.set(
        reveal ? -0.6 : 0,
        (reveal ? 5.3 : 6.4) / state.zoom,
        distance / (mobile() ? 1 : state.zoom),
      );
      camera.lookAt(0, reveal ? 0.5 : 0, 0);
      renderer.render(scene, camera);
      el.classList.add("ready");
      if (reveal) {
        if (!reduced)
          setChapter(
            state.progress < 0.22
              ? 0
              : state.progress < 0.53
                ? 1
                : state.progress < 0.79
                  ? 2
                  : 3,
          );
        if (progressBar)
          progressBar.style.transform = `scaleX(${reduced ? 1 : state.progress})`;
      }
      if (labels) {
        const opacity = reduced ? 1 : Math.max(0, (state.explode - 0.25) * 1.4);
        labels.style.opacity = String(opacity);
        leaderSvg.style.opacity = String(opacity);
        const offset = el.offsetTop;
        [leaves, toppings, base].forEach((part, i) => {
          const point = part
            .localToWorld(new THREE.Vector3(0.7, 0.22, 0))
            .project(camera);
          const x = (point.x * 0.5 + 0.5) * w + el.offsetLeft,
            y = (-point.y * 0.5 + 0.5) * h + offset;
          const label = labelEls[i];
          const labelY = y + (i - 1) * (mobile() ? 12 : 22);
          label.style.top = labelY + "px";
          const endX = label.offsetLeft - 8;
          lines[i].setAttribute("x1", String(x));
          lines[i].setAttribute("y1", String(y));
          lines[i].setAttribute("x2", String(endX));
          lines[i].setAttribute("y2", String(labelY + 8));
        });
      }
    };
    render();
    const refreshFrame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      const target =
        window.location.hash &&
        document.getElementById(window.location.hash.slice(1));
      if (
        !alignedInitialHash.current &&
        reveal &&
        target &&
        !parent.contains(target)
      )
        target.scrollIntoView({ behavior: "instant" });
      alignedInitialHash.current = true;
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(refreshFrame);
      leaderSvg.remove();
      timeline?.scrollTrigger?.kill();
      timeline?.kill();
      observer.disconnect();
      intersection.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", reset);
      scene.traverse((o) => {
        const drawable = o as THREE.Mesh;
        drawable.geometry?.dispose();
        if (drawable.material) {
          for (const m of Array.isArray(drawable.material)
            ? drawable.material
            : [drawable.material])
            m.dispose();
        }
      });
      crustTex.dispose();
      sauceTex.dispose();
      Object.values(extraMaterials).forEach((material) => material.dispose());
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      el.classList.remove("ready");
      plateRef.current = null;
      chapters.forEach((chapter) => {
        chapter.removeAttribute("style");
        chapter.removeAttribute("aria-hidden");
        chapter.inert = false;
      });
    };
    // The scene is constructed once; finish updates the existing material.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, reduced, customize, configurationKey]);
  return (
    <div
      ref={host}
      className={"scene " + (reveal ? "scene-reveal" : "")}
      role="img"
      aria-label="Interactive 3D margherita pizza with golden crust, tomato, mozzarella and basil"
    >
      <div className="scene-preview pizza-fallback">
        <img src="/images/pizza.jpg" alt="" />
        <span>House margherita · tomato, mozzarella & basil</span>
      </div>
    </div>
  );
}
