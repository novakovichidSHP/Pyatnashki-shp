import {
  hasTileBackgrounds,
  normalizeTileBackground,
  sanitizeTileBackgrounds,
} from "./resources.js";

export function encodePuzzle({ width, height, tiles, backgrounds }) {
  const total = width * height;
  let normalizedBackgrounds = null;

  if (Array.isArray(backgrounds)) {
    normalizedBackgrounds = sanitizeTileBackgrounds(backgrounds, total);
  }

  const payloadObject = { w: width, h: height, t: tiles };

  if (normalizedBackgrounds && hasTileBackgrounds(normalizedBackgrounds)) {
    payloadObject.b = normalizedBackgrounds;
  }

  const payload = JSON.stringify(payloadObject);
  return toUrlSafeBase64(payload);
}

export function decodePuzzle(payload) {
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const text = atob(padded);
  const { w, h, t, b } = JSON.parse(text);

  if (!Number.isInteger(w) || !Number.isInteger(h)) {
    throw new Error("Некорректные размеры");
  }

  const expectedLength = w * h;
  if (!Array.isArray(t) || t.length !== expectedLength) {
    throw new Error("Некорректное количество плиток");
  }

  const numericTiles = t.map((value) => Number(value));
  const tileSet = new Set(numericTiles);
  if (tileSet.size !== expectedLength || !tileSet.has(0)) {
    throw new Error("Плитки должны быть уникальны и содержать пустую");
  }

  let normalizedBackgrounds = null;
  if (Array.isArray(b)) {
    if (b.length !== expectedLength) {
      throw new Error("Некорректное количество фонов");
    }
    normalizedBackgrounds = b.map((value) => normalizeTileBackground(value));
  } else if (typeof b !== "undefined" && b !== null) {
    throw new Error("Некорректный формат фонов");
  }

  return {
    width: w,
    height: h,
    tiles: numericTiles,
    ...(normalizedBackgrounds && hasTileBackgrounds(normalizedBackgrounds)
      ? { backgrounds: normalizedBackgrounds }
      : {}),
  };
}

function toUrlSafeBase64(text) {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
