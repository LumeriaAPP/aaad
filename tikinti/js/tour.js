// Virtual tur: mənzilin içində birinci şəxs gəzintisi
import * as THREE from 'three';
import { BUILDING } from './data.js';

const EYE = 1.62;
const RADIUS = 0.28;

export class Tour {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.active = false;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.joy = new THREE.Vector2();
    this.walkTarget = null;
    this.lookTarget = null;
    this.data = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onMove = null; // mini xəritə üçün geri çağırış

    const ringGeo = new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.renderOrder = 5;
    this.ring.visible = false;

    this._bind();
  }

  _bind() {
    const c = this.canvas;
    let down = null;
    c.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      down = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this._hover(e);
      if (!down || down.id !== e.pointerId) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved += Math.abs(dx) + Math.abs(dy);
      down.x = e.clientX;
      down.y = e.clientY;
      const k = e.pointerType === 'touch' ? 0.006 : 0.0035;
      this.yaw += dx * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, -1.2, 1.2);
      this.lookTarget = null;
    });
    const up = (e) => {
      if (!this.active || !down) return;
      if (down.moved < 6) this._click(e);
      down = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => (down = null));
    c.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + e.deltaY * 0.03, 40, 85);
      this.camera.updateProjectionMatrix();
    }, { passive: false });
    // Düymələr fiziki yerinə görə (e.code) tanınır — klaviaturanın dili (AZ, RU, EN) fərq etmir
    const KEYMAP = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
    };
    const keyOf = (e) => KEYMAP[e.code] || { w: 'w', a: 'a', s: 's', d: 'd', ц: 'w', ф: 'a', ы: 's', в: 'd', ü: 'w' }[e.key?.toLowerCase()];
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range'))) return;
      const k = keyOf(e);
      if (k) {
        this.keys.add(k);
        this.walkTarget = null;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { const k = keyOf(e); if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindJoystick(el) {
    const knob = el.querySelector('.joy-knob');
    let id = null, cx = 0, cy = 0;
    const R = 44;
    const set = (x, y) => {
      const v = new THREE.Vector2(x - cx, y - cy);
      if (v.length() > R) v.setLength(R);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
      this.joy.set(v.x / R, v.y / R);
      this.walkTarget = null;
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      id = e.pointerId;
      el.setPointerCapture(id);
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      set(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy.set(0, 0);
      knob.style.transform = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  _ray(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.data.group, true);
    for (const h of hits) {
      if (!h.object.visible || (h.object.material && h.object.material.visible === false)) continue;
      if (h.object.material && h.object.material.transparent && h.object.material.opacity < 0.3) continue;
      return h;
    }
    return null;
  }

  _floorPoint(h) {
    if (!h || !h.face) return null;
    if (Math.abs(h.point.y - this.data.baseY) > 0.1) return null;
    return h.point;
  }

  _hover(e) {
    const p = this._floorPoint(this._ray(e));
    this.ring.visible = !!p;
    if (p) this.ring.position.set(p.x, this.data.baseY + 0.02, p.z);
  }

  _click(e) {
    const h = this._ray(e);
    const p = this._floorPoint(h);
    if (p) {
      this.walkTarget = new THREE.Vector3(p.x, 0, p.z);
    } else if (h) {
      // divara/əşyaya klik — ora bax
      const d = h.point.clone().sub(this.camera.position);
      this.lookTarget = { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
    }
  }

  start(data) {
    this.data = data;
    this.active = true;
    this.pos = new THREE.Vector3(data.start.x, 0, data.start.z);
    const d = data.startLook.clone().sub(data.start);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = 0;
    this.walkTarget = null;
    this.lookTarget = null;
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this._apply();
  }

  stop() {
    this.active = false;
    this.keys.clear();
    this.joy.set(0, 0);
    this.ring.visible = false;
  }

  goToRoom(room) {
    const r = room.rect;
    this.walkTarget = new THREE.Vector3((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    this.walkTarget.teleport = true;
  }

  _collide(p) {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of this.data.colliders) {
        const nx = THREE.MathUtils.clamp(p.x, c.x0, c.x1);
        const nz = THREE.MathUtils.clamp(p.z, c.z0, c.z1);
        const dx = p.x - nx, dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * RADIUS;
          p.z = nz + (dz / d) * RADIUS;
        } else {
          // mərkəz düzbucaqlının içindədir — ən yaxın tərəfə it
          const opts = [[c.x0 - RADIUS - p.x, 0], [c.x1 + RADIUS - p.x, 0], [0, c.z0 - RADIUS - p.z], [0, c.z1 + RADIUS - p.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          p.x += opts[0][0];
          p.z += opts[0][1];
        }
      }
    }
    const b = this.data.bounds;
    p.x = THREE.MathUtils.clamp(p.x, b.x0 + RADIUS, b.x1 - RADIUS);
    p.z = THREE.MathUtils.clamp(p.z, b.z0 + RADIUS, b.z1 - RADIUS);
  }

  update(dt) {
    if (!this.active) return;
    const speed = 2.3;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) move.add(fwd);
    if (k.has('s') || k.has('arrowdown')) move.sub(fwd);
    if (k.has('d')) move.add(right);
    if (k.has('a')) move.sub(right);
    if (k.has('arrowleft')) this.yaw += dt * 1.8;
    if (k.has('arrowright')) this.yaw -= dt * 1.8;
    if (this.joy.lengthSq() > 0.01) {
      move.addScaledVector(fwd, -this.joy.y);
      move.addScaledVector(right, this.joy.x);
    }
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt * Math.min(1, move.length() || 1));
      this.pos.add(move);
    } else if (this.walkTarget) {
      const d = this.walkTarget.clone().sub(this.pos).setY(0);
      const dist = d.length();
      if (this.walkTarget.teleport) {
        this.pos.lerp(this.walkTarget, Math.min(1, dt * 4));
        if (dist < 0.05) this.walkTarget = null;
      } else {
        const step = Math.min(dist, speed * 1.2 * dt);
        if (dist < 0.05) this.walkTarget = null;
        else {
          const before = this.pos.clone();
          this.pos.addScaledVector(d.normalize(), step);
          // yolda ilişib qalsa, dayan
          this._collide(this.pos);
          if (this.pos.distanceTo(before) < step * 0.2) this.walkTarget = null;
          // gedilən istiqamətə yavaşca dön
          const targetYaw = Math.atan2(-d.x, -d.z);
          let dy = targetYaw - this.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.yaw += dy * Math.min(1, dt * 2.5);
        }
      }
    }
    if (this.lookTarget) {
      let dy = this.lookTarget.yaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 5);
      this.pitch += (THREE.MathUtils.clamp(this.lookTarget.pitch, -1, 1) - this.pitch) * Math.min(1, dt * 5);
      if (Math.abs(dy) < 0.002) this.lookTarget = null;
    }
    if (!this.walkTarget || !this.walkTarget.teleport) this._collide(this.pos);
    this._apply();
  }

  _apply() {
    const c = this.camera;
    c.position.set(this.pos.x, this.data.baseY + EYE, this.pos.z);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.pitch, this.yaw, 0);
    if (this.onMove) this.onMove(this.pos, this.yaw);
  }

  // Mini xəritədə mövqe (mərtəbə koordinatları → plan SVG koordinatları)
  static toPlan(pos, slot) {
    return { x: pos.x + BUILDING.width / 2 - slot.ox, y: pos.z + BUILDING.depth / 2 - slot.oz };
  }
}
