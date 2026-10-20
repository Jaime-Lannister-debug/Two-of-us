// 五角星用圆形碰撞体求解；十列十层，100 颗恰好装满瓶身。
export const WIDTH = 264,
  HEIGHT = 300,
  RADIUS = 12;
export function makeStars(ids, old = []) {
  const previous = new Map(old.map((p) => [p.id, p]));
  return ids.slice(0, 100).map(
    (id, i) =>
      previous.get(id) || {
        id,
        x: 15 + (i % 10) * 26,
        y: HEIGHT - 15 - Math.floor(i / 10) * 29.5,
        vx: 0,
        vy: 0,
        angle: i * 0.43,
        spin: 0,
      },
  );
}
export function shakeStars(stars, random = Math.random) {
  for (const p of stars) {
    p.vx = (random() - 0.5) * 380;
    p.vy = -180 - random() * 320;
    p.spin = (random() - 0.5) * 10;
  }
}
export function stepStars(stars, elapsed) {
  const dt = Math.min(Math.max(elapsed, 0), 1 / 30) / 3;
  for (let step = 0; step < 3; step++) {
    for (const p of stars) {
      p.vy += 740 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.spin *= 0.995;
      p.vx *= 0.997;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < stars.length; i++)
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i],
            b = stars[j];
          let dx = b.x - a.x,
            dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          if (distance >= RADIUS * 2) continue;
          if (distance < 0.001) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const nx = dx / distance,
            ny = dy / distance,
            overlap = (RADIUS * 2 - distance) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (speed < 0) {
            const impulse = -0.72 * speed;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }
        }
      for (const p of stars) {
        if (p.x < RADIUS) {
          p.x = RADIUS;
          p.vx = Math.abs(p.vx) * 0.65;
        }
        if (p.x > WIDTH - RADIUS) {
          p.x = WIDTH - RADIUS;
          p.vx = -Math.abs(p.vx) * 0.65;
        }
        if (p.y < RADIUS) {
          p.y = RADIUS;
          p.vy = Math.abs(p.vy) * 0.6;
        }
        if (p.y > HEIGHT - RADIUS) {
          p.y = HEIGHT - RADIUS;
          p.vy = -Math.abs(p.vy) * 0.48;
          p.vx *= 0.96;
        }
      }
    }
  }
}
