export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

export function createRunSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param) {
    const parsed = Number.parseInt(param, 10);
    if (Number.isFinite(parsed)) {
      return parsed >>> 0;
    }
  }

  const randomPart = Math.floor(Math.random() * 0xffffffff);
  return (Date.now() ^ randomPart) >>> 0;
}
