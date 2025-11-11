import { encodePuzzle, decodePuzzle } from "../scripts/puzzle.js";
import {
  TILE_BACKGROUNDS,
  hasTileBackgrounds,
  normalizeTileBackground,
  sanitizeTileBackgrounds,
} from "../scripts/resources.js";

document.addEventListener("DOMContentLoaded", () => {
  const widthInput = document.getElementById("width");
  const heightInput = document.getElementById("height");
  const autofillSelect = document.getElementById("autofill");
  const modeSelect = document.getElementById("mode");
  const applyButton = document.getElementById("apply");
  const preview = document.getElementById("preview");
  const payloadField = document.getElementById("payload");
  const urlField = document.getElementById("url");
  const generateButton = document.getElementById("generate");
  const copyButton = document.getElementById("copy");
  const copyStatus = document.getElementById("copy-status");
  const validationMessage = document.getElementById("validation");

  const backgroundOptions = [
    { id: "", label: "Без фона" },
    ...TILE_BACKGROUNDS,
  ];

  let gridWidth = clamp(Number(widthInput.value), 2, 8);
  let gridHeight = clamp(Number(heightInput.value), 2, 8);
  let tileMode = modeSelect?.value ?? "default";
  let gridBackgrounds = Array.from(
    { length: gridWidth * gridHeight },
    () => "",
  );
  let lastValidResult = { payload: "", url: "" };

  const initialFromUrl = readFromUrl();
  let initialValues = null;

  if (initialFromUrl) {
    gridWidth = initialFromUrl.width;
    gridHeight = initialFromUrl.height;
    widthInput.value = gridWidth.toString();
    heightInput.value = gridHeight.toString();
    initialValues = initialFromUrl.tiles.map((value) =>
      value === 0 ? "" : value.toString(),
    );
    const total = gridWidth * gridHeight;
    const sanitizedFromUrl = sanitizeTileBackgrounds(
      initialFromUrl.backgrounds ?? [],
      total,
    );
    if (hasTileBackgrounds(sanitizedFromUrl)) {
      tileMode = "images";
      gridBackgrounds = sanitizedFromUrl;
    } else {
      gridBackgrounds = Array.from({ length: total }, () => "");
    }
  } else {
    gridBackgrounds = Array.from({ length: gridWidth * gridHeight }, () => "");
  }

  if (modeSelect) {
    modeSelect.value = tileMode;
  }

  buildGrid(
    initialValues ?? createSequenceValues(gridWidth, gridHeight),
    gridBackgrounds,
  );
  updateResult();

  applyButton.addEventListener("click", () => {
    const previousWidth = gridWidth;
    const previousHeight = gridHeight;

    gridWidth = clamp(Number(widthInput.value), 2, 8);
    gridHeight = clamp(Number(heightInput.value), 2, 8);
    widthInput.value = gridWidth.toString();
    heightInput.value = gridHeight.toString();

    const total = gridWidth * gridHeight;
    if (gridWidth !== previousWidth || gridHeight !== previousHeight) {
      gridBackgrounds = Array.from({ length: total }, () => "");
    } else {
      gridBackgrounds = sanitizeTileBackgrounds(gridBackgrounds, total);
    }

    const mode = autofillSelect.value;
    let values = [];

    if (mode === "clear") {
      values = Array(total).fill("");
    } else if (mode === "random") {
      values = createRandomValues(gridWidth, gridHeight);
    } else {
      values = createSequenceValues(gridWidth, gridHeight);
    }

    buildGrid(values, gridBackgrounds);
    updateResult();
  });

  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      tileMode = modeSelect.value;
      const currentValues = readCurrentInputValues();
      gridBackgrounds = sanitizeTileBackgrounds(
        gridBackgrounds,
        gridWidth * gridHeight,
      );
      buildGrid(currentValues, gridBackgrounds);
      markDirty();
      updateResult();
    });
  }

  generateButton.addEventListener("click", () => {
    updateResult();
  });

  copyButton.addEventListener("click", async () => {
    if (!urlField.value) {
      updateResult();
    }

    if (!urlField.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(urlField.value);
      copyStatus.textContent = "Ссылка скопирована";
    } catch (error) {
      console.warn("Не удалось скопировать", error);
      copyStatus.textContent = "Скопируйте ссылку вручную";
    }

    setTimeout(() => {
      copyStatus.textContent = "";
    }, 2500);
  });

  function buildGrid(values, backgrounds) {
    preview.innerHTML = "";
    preview.style.setProperty("--columns", gridWidth);
    preview.dataset.mode = tileMode;

    const total = gridWidth * gridHeight;
    const sanitizedBackgrounds = sanitizeTileBackgrounds(
      backgrounds ?? gridBackgrounds,
      total,
    );
    gridBackgrounds = sanitizedBackgrounds;

    const cells = Array.from({ length: total }, (_, index) => ({
      value: values?.[index] ?? "",
      background: gridBackgrounds[index] ?? "",
    }));

    cells.forEach(({ value, background }, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "preview-cell";
      wrapper.dataset.index = index.toString();

      if (tileMode === "images") {
        applyPreviewBackground(wrapper, background);
      } else {
        applyPreviewBackground(wrapper, "");
      }

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.maxLength = 3;
      input.placeholder = "0";
      input.value = value;
      input.dataset.index = index.toString();

      input.addEventListener("input", () => {
        copyStatus.textContent = "";
        markDirty();
      });

      wrapper.appendChild(input);

      if (tileMode === "images") {
        const select = document.createElement("select");
        select.className = "preview-background-select";
        select.dataset.index = index.toString();

        backgroundOptions.forEach(({ id, label }) => {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = label;
          select.appendChild(option);
        });

        select.value = normalizeTileBackground(background);

        select.addEventListener("change", () => {
          const normalized = normalizeTileBackground(select.value);
          gridBackgrounds[index] = normalized;
          applyPreviewBackground(wrapper, normalized);
          copyStatus.textContent = "";
          markDirty();
        });

        wrapper.appendChild(select);
      }

      preview.appendChild(wrapper);
    });
  }

  function updateResult() {
    const { tiles, backgrounds, error } = collectTiles();

    if (error) {
      validationMessage.dataset.state = "error";
      validationMessage.textContent = error;
      if (lastValidResult.payload && lastValidResult.url) {
        payloadField.value = lastValidResult.payload;
        urlField.value = lastValidResult.url;
      } else {
        payloadField.value = "";
        urlField.value = "";
      }
      return;
    }

    validationMessage.textContent = "";
    delete validationMessage.dataset.state;

    const payload = encodePuzzle({
      width: gridWidth,
      height: gridHeight,
      tiles,
      backgrounds: tileMode === "images" ? backgrounds : undefined,
    });
    const targetUrl = buildTargetUrl(payload);
    payloadField.value = payload;
    urlField.value = targetUrl;
    lastValidResult = { payload, url: targetUrl };
  }

  function collectTiles() {
    const inputs = Array.from(preview.querySelectorAll("input[data-index]"));
    if (inputs.length !== gridWidth * gridHeight) {
      return { tiles: [], backgrounds: [], error: "Поле не готово" };
    }

    const tiles = inputs.map((input) => {
      const trimmed = input.value.trim();
      if (trimmed === "") {
        return 0;
      }
      const number = Number.parseInt(trimmed, 10);
      return Number.isNaN(number) ? NaN : number;
    });

    if (tiles.some((value) => Number.isNaN(value))) {
      return {
        tiles: [],
        backgrounds: [],
        error: "Используйте только числа или оставляйте клетку пустой",
      };
    }

    const zeroCount = tiles.filter((value) => value === 0).length;
    if (zeroCount !== 1) {
      return { tiles: [], backgrounds: [], error: "Должна быть ровно одна пустая клетка" };
    }

    const expectedNumbers = Array.from(
      { length: tiles.length - 1 },
      (_, i) => i + 1,
    );
    const providedNumbers = tiles.filter((value) => value !== 0);

    expectedNumbers.sort((a, b) => a - b);
    providedNumbers.sort((a, b) => a - b);

    if (expectedNumbers.length !== providedNumbers.length) {
      return {
        tiles: [],
        backgrounds: [],
        error: "Заполните все клетки числами от 1 до N-1",
      };
    }

    for (let i = 0; i < expectedNumbers.length; i += 1) {
      if (expectedNumbers[i] !== providedNumbers[i]) {
        return {
          tiles: [],
          backgrounds: [],
          error: "Используйте каждое число от 1 до N-1 по одному разу",
        };
      }
    }

    const sanitizedBackgrounds = sanitizeTileBackgrounds(
      gridBackgrounds,
      gridWidth * gridHeight,
    );
    gridBackgrounds = sanitizedBackgrounds;

    return { tiles, backgrounds: sanitizedBackgrounds, error: null };
  }

  function createSequenceValues(width, height) {
    const total = width * height;
    return Array.from({ length: total }, (_, index) => {
      if (index === total - 1) return "";
      return (index + 1).toString();
    });
  }

  function createRandomValues(width, height) {
    const total = width * height;
    let candidate = [];

    do {
      candidate = shuffle(Array.from({ length: total }, (_, index) => index));
    } while (!isSolvable(candidate, width, height));

    return candidate.map((value) => (value === 0 ? "" : value.toString()));
  }

  function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function isSolvable(tiles, width, height) {
    const withoutZero = tiles.filter((value) => value !== 0);
    let inversions = 0;
    for (let i = 0; i < withoutZero.length; i += 1) {
      for (let j = i + 1; j < withoutZero.length; j += 1) {
        if (withoutZero[i] > withoutZero[j]) {
          inversions += 1;
        }
      }
    }

    if (width % 2 !== 0) {
      return inversions % 2 === 0;
    }

    const emptyIndex = tiles.indexOf(0);
    const emptyRowFromBottom = height - Math.floor(emptyIndex / width);
    if (emptyRowFromBottom % 2 === 0) {
      return inversions % 2 === 1;
    }

    return inversions % 2 === 0;
  }

  function readCurrentInputValues() {
    return Array.from(preview.querySelectorAll("input[data-index]"), (input) =>
      input.value,
    );
  }

  function buildTargetUrl(payload) {
    const baseUrl = new URL("../", window.location.href);
    baseUrl.search = "";
    baseUrl.hash = "";
    const href = baseUrl.href.endsWith("/") ? baseUrl.href : `${baseUrl.href}/`;
    return `${href}?p=${payload}`;
  }

  function readFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const payload = params.get("p");
    if (!payload) return null;

    try {
      return decodePuzzle(payload);
    } catch (error) {
      console.warn("Не удалось прочитать p", error);
      return null;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyPreviewBackground(element, backgroundName) {
    if (!element) return;
    if (backgroundName) {
      const encoded = encodeURIComponent(backgroundName);
      element.style.backgroundImage = `url(../pics/${encoded})`;
      element.dataset.hasBackground = "true";
    } else {
      element.style.backgroundImage = "none";
      delete element.dataset.hasBackground;
    }
  }

  function markDirty() {
    if (validationMessage.dataset.state !== "error") {
      validationMessage.textContent = "Поле изменено. Нажмите «Создать ссылку».";
      validationMessage.dataset.state = "info";
    }
  }
});
