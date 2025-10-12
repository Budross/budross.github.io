/**
 * SimplexNoise implementation for 2D noise generation
 * Based on Stefan Gustavson's implementation
 */
export class SimplexNoise {
  constructor(seed = Math.random()) {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    this.perm = [];
    this.permMod12 = [];

    // Initialize permutation table with seed
    this.initializePermutations(seed);
  }

  initializePermutations(seed) {
    // Use a simple seeded random number generator
    let random = this.seededRandom(seed);

    // Create base permutation array
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using Fisher-Yates algorithm with seeded random
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Extend permutation table
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  // Simple seeded pseudo-random number generator
  seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;

    return function() {
      s = s * 16807 % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Dot product helper
  dot(g, x, y) {
    return g[0] * x + g[1] * y;
  }

  // 2D simplex noise
  noise2D(xin, yin) {
    let n0, n1, n2; // Noise contributions from the three corners

    // Skew the input space to determine which simplex cell we're in
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2; // Hairy factor for 2D
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t; // Unskew the cell origin back to (x,y) space
    const Y0 = j - t;
    const x0 = xin - X0; // The x,y distances from the cell origin
    const y0 = yin - Y0;

    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
      i1 = 1; j1 = 0; // lower triangle, XY order: (0,0)->(1,0)->(1,1)
    } else {
      i1 = 0; j1 = 1; // upper triangle, YX order: (0,0)->(0,1)->(1,1)
    }

    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0); // (x,y) of grad3 used for 2D gradient
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70.0 * (n0 + n1 + n2);
  }

  // Octave noise for more natural terrain
  octaveNoise2D(x, y, octaves = 4, persistence = 0.5, scale = 1.0) {
    let value = 0.0;
    let amplitude = 1.0;
    let frequency = scale;
    let maxValue = 0.0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue; // Normalize to [-1, 1]
  }

  // Ridged noise for mountain-like features
  ridgedNoise2D(x, y, octaves = 4, persistence = 0.5, scale = 1.0) {
    let value = 0.0;
    let amplitude = 1.0;
    let frequency = scale;
    let maxValue = 0.0;

    for (let i = 0; i < octaves; i++) {
      let n = Math.abs(this.noise2D(x * frequency, y * frequency));
      n = 1.0 - n; // Invert
      n = n * n; // Square for sharper ridges
      value += n * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }

  // Billow noise for cloud-like effects
  billowNoise2D(x, y, octaves = 4, persistence = 0.5, scale = 1.0) {
    let value = 0.0;
    let amplitude = 1.0;
    let frequency = scale;
    let maxValue = 0.0;

    for (let i = 0; i < octaves; i++) {
      value += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

// Utility function to create a seeded noise instance
export function createNoise(seed = Math.random()) {
  return new SimplexNoise(seed);
}

// Noise utility functions
export const NoiseUtils = {
  // Normalize noise value from [-1, 1] to [0, 1]
  normalize(value) {
    return (value + 1) * 0.5;
  },

  // Map normalized value [0, 1] to custom range
  mapRange(value, min, max) {
    return min + value * (max - min);
  },

  // Smooth step function for smoother transitions
  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  },

  // Linear interpolation
  lerp(a, b, t) {
    return a + t * (b - a);
  }
};