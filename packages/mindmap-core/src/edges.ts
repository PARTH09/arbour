/** Shared connector geometry for the canvas and SVG export. */

export function buildEdgePath(
  style: "bezier" | "straight" | "orthogonal",
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  if (style === "straight") return `M ${sx} ${sy} L ${tx} ${ty}`;
  if (style === "orthogonal") return orthogonalPath(sx, sy, tx, ty);
  const dx = Math.max(36, Math.abs(tx - sx) * 0.45);
  const direction = tx >= sx ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + direction * dx} ${sy}, ${tx - direction * dx} ${ty}, ${tx} ${ty}`;
}

/**
 * Whimsical-style fork: short stub from the parent, then a rail, then into the child.
 * Chooses horizontal vs vertical primary based on delta, and never overshoots the midpoint
 * (which used to draw reverse stubs through nearby topics).
 */
function orthogonalPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return `M ${sx} ${sy} L ${tx} ${ty}`;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dy) < 0.5) return `M ${sx} ${sy} L ${tx} ${ty}`;
    const stub = stubLength(dx);
    const railX = sx + stub;
    return `M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${tx} ${ty}`;
  }

  if (Math.abs(dx) < 0.5) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const stub = stubLength(dy);
  const railY = sy + stub;
  return `M ${sx} ${sy} L ${sx} ${railY} L ${tx} ${railY} L ${tx} ${ty}`;
}

function stubLength(delta: number): number {
  const gap = Math.abs(delta);
  if (gap < 2) return 0;
  // Stay on the parent side of the midpoint so the rail never pasts the child.
  const maxStub = Math.max(0, gap / 2 - 2);
  const preferred = Math.min(28, Math.max(10, gap * 0.35));
  const length = Math.min(preferred, maxStub);
  return length * Math.sign(delta);
}
