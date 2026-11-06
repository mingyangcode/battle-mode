import { useEffect, useRef } from "react";
import { audio } from "../audio/AudioEngine";

/** Read-only visual branch. Never participates in playback scheduling. */
export function WaterRippleVisualizer({ active = false, paused = false, phase = "READY", mock = false }: { active?: boolean; paused?: boolean; phase?: string; mock?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, paused, phase });
  state.current = { active, paused, phase };
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, clock = 0, width = 1, height = 1;
    let rms = 0, bass = 0, mid = 0, strength = .22;
    let meter: ReturnType<typeof audio.createMeter> | undefined;
    const samples = new Uint8Array(128), frequencies = new Uint8Array(64);
    function release() { meter?.dispose(); meter = undefined; }
    function draw(dt: number) {
      const s = state.current;
      if (s.active && !s.paused && !document.hidden && !mock && !meter && !motion.matches) {
        try { meter = audio.createMeter(); } catch { /* Idle visual fallback. */ }
      }
      if (!s.active) release();
      let r = 0, b = 0, m = 0;
      if (mock && s.active) { r = .18 + Math.sin(clock * 1.8) * .08; b = .3 + Math.sin(clock) * .15; m = .25; }
      else if (meter) {
        meter.analyser.getByteTimeDomainData(samples);
        meter.analyser.getByteFrequencyData(frequencies);
        r = Math.sqrt(samples.reduce((sum, n) => sum + ((n - 128) / 128) ** 2, 0) / samples.length);
        b = frequencies.slice(0, 5).reduce((sum, n) => sum + n, 0) / (5 * 255);
        m = frequencies.slice(5, 24).reduce((sum, n) => sum + n, 0) / (19 * 255);
      }
      const smooth = 1 - Math.exp(-dt * 4);
      rms += (r - rms) * smooth; bass += (b - bass) * smooth; mid += (m - mid) * smooth;
      const target = !s.active ? .22 : ["JUDGING", "INTER_ROUND_BG", "TRANSITION_TO_NEXT"].includes(s.phase) ? .28 : s.phase === "POST_B" ? .48 : s.phase.startsWith("PRE") ? .7 : 1;
      strength += (target - strength) * smooth;
      const dark = document.documentElement.dataset.theme === "dark";
      ctx!.clearRect(0, 0, width, height);
      const x = width * .48, y = height * .45, extent = Math.hypot(width, height) * .64;
      const glow = ctx!.createRadialGradient(x, y, 0, x, y, extent);
      glow.addColorStop(0, `rgba(111,238,121,${dark ? .055 : .045})`); glow.addColorStop(1, "rgba(111,238,121,0)");
      ctx!.fillStyle = glow; ctx!.fillRect(0, 0, width, height);
      if (motion.matches) return;
      for (let layer = 0; layer < 5; layer++) {
        const age = (clock * (.035 + bass * .008) + layer / 5) % 1;
        const radius = extent * (.12 + age * .88);
        const envelope = Math.sin(age * Math.PI);
        const opacity = Math.min(dark ? .25 : .25, (dark ? .08 : .14) + rms * .3) * envelope * strength;
        ctx!.beginPath();
        for (let i = 0; i <= 96; i++) {
          const angle = i / 96 * Math.PI * 2;
          const distortion = Math.sin(angle * 3 + clock * .3 + layer) * .024 + Math.sin(angle * 5 - clock * .18) * (.009 + mid * .012);
          const rad = radius * (1 + distortion);
          const px = x + Math.cos(angle) * rad, py = y + Math.sin(angle) * rad * .85;
          if (!i) ctx!.moveTo(px, py); else ctx!.lineTo(px, py);
        }
        ctx!.closePath(); ctx!.strokeStyle = `rgba(${!dark && layer < 2 ? "54,185,107" : "111,238,121"},${opacity})`; ctx!.lineWidth = Math.min(2,1.2 + rms * 2); ctx!.stroke();
      }
    }
    function tick(now: number) {
      frame = 0;
      if (document.hidden || motion.matches || state.current.paused) return;
      const dt = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now; clock += dt;
      try { draw(dt); } catch { release(); }
      frame = requestAnimationFrame(tick);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (document.hidden || state.current.paused || motion.matches) release();
      if (!document.hidden && !state.current.paused) {
        if (motion.matches) draw(0); else frame = requestAnimationFrame(tick);
      }
    }
    function resize() {
      const box = el!.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      width = box.width; height = box.height;
      el!.width = Math.round(width * dpr); el!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0);
    }
    const observer = new ResizeObserver(resize); observer.observe(el);
    const theme = new MutationObserver(() => { if (motion.matches || state.current.paused) draw(0); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("visibilitychange", update); motion.addEventListener("change", update);
    // Prop changes are signalled without resetting the ripple clock or smoothing.
    el.addEventListener("ripple-state", update);
    resize(); update();
    return () => { cancelAnimationFrame(frame); release(); observer.disconnect(); theme.disconnect(); document.removeEventListener("visibilitychange", update); motion.removeEventListener("change", update); el.removeEventListener("ripple-state", update); };
  }, [mock]);
  useEffect(() => { canvas.current?.dispatchEvent(new Event("ripple-state")); }, [active, paused]);
  return <canvas ref={canvas} className="water-ripple" aria-hidden="true" />;
}
