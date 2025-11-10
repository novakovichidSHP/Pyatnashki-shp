import { decodePuzzle } from "./puzzle.js";

const defaultPuzzle = {
  width: 4,
  height: 4,
  tiles: Array.from({ length: 15 }, (_, i) => i + 1).concat(0),
};

document.addEventListener("DOMContentLoaded", () => {
  const boardElement = document.getElementById("board");
  const moveCountElement = document.getElementById("move-count");
  const timerElement = document.getElementById("timer");
  const messageElement = document.getElementById("message");
  const boardSizeElement = document.getElementById("board-size");
  const restartButton = document.getElementById("restart");
  const openSettingsButton = document.getElementById("open-settings");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsButton = document.getElementById("close-settings");
  const cancelSettingsButton = document.getElementById("cancel-settings");
  const settingsForm = document.getElementById("settings-form");
  const widthInput = document.getElementById("settings-width");
  const heightInput = document.getElementById("settings-height");
  const presetSelect = document.getElementById("settings-preset");
  const rebuildButton = document.getElementById("settings-rebuild");
  const gridContainer = document.getElementById("settings-grid");
  const statusElement = document.getElementById("settings-status");

  const initialPuzzle = parsePuzzleFromUrl() ?? defaultPuzzle;
  let initialTiles = [...initialPuzzle.tiles];

  let state = {
    ...initialPuzzle,
    tiles: [...initialTiles],
    moves: 0,
    seconds: 0,
    timer: null,
    started: false,
  };

  boardSizeElement.textContent = `${state.width} × ${state.height}`;
  renderBoard();
  window.addEventListener("resize", sizeBoard);

  restartButton.addEventListener("click", () => {
    resetState();
  });

  if (openSettingsButton) {
    setupSettingsModal();
  }

  function resetState() {
    clearInterval(state.timer);
    state = {
      ...state,
      tiles: [...initialTiles],
      moves: 0,
      seconds: 0,
      timer: null,
      started: false,
    };
    moveCountElement.textContent = "0";
    timerElement.textContent = formatTime(0);
    messageElement.textContent = "";
    messageElement.classList.remove("message-win");
    renderBoard();
  }

  function startTimer() {
    if (state.started) return;
    state.started = true;
    state.timer = setInterval(() => {
      state.seconds += 1;
      timerElement.textContent = formatTime(state.seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
    state.started = false;
  }

  function renderBoard() {
    boardElement.innerHTML = "";
    boardElement.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
    boardElement.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;

    state.tiles.forEach((value, index) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.role = "gridcell";
      tile.className = "tile" + (value === 0 ? " empty" : "");
      tile.dataset.index = index.toString();

      if (value !== 0) {
        tile.textContent = value.toString();
        tile.setAttribute("aria-label", `Плитка ${value}`);
      } else {
        tile.setAttribute("aria-hidden", "true");
        tile.tabIndex = -1;
      }

      tile.addEventListener("click", () => handleTileClick(index));
      boardElement.appendChild(tile);
    });

    sizeBoard();
  }

  function sizeBoard() {
    const minEdge = 240;
    const safeHorizontal = Math.max(window.innerWidth - 240, minEdge);
    const safeVertical = Math.max(window.innerHeight - 360, minEdge);
    const maxWidth = Math.min(480, safeHorizontal);
    const maxHeight = Math.min(480, safeVertical);
    const ratio = state.width / state.height;

    let boardWidth = maxWidth;
    let boardHeight = boardWidth / ratio;

    if (boardHeight > maxHeight) {
      boardHeight = maxHeight;
      boardWidth = boardHeight * ratio;
    }

    if (boardWidth < minEdge || boardHeight < minEdge) {
      const scale = Math.max(minEdge / boardWidth, minEdge / boardHeight);
      boardWidth = Math.min(maxWidth, boardWidth * scale);
      boardHeight = Math.min(maxHeight, boardHeight * scale);
    }

    boardElement.style.width = `${Math.round(boardWidth)}px`;
    boardElement.style.height = `${Math.round(boardHeight)}px`;
  }

  function handleTileClick(index) {
    const emptyIndex = state.tiles.indexOf(0);
    if (!isAdjacent(index, emptyIndex, state.width)) {
      return;
    }

    startTimer();

    const newTiles = [...state.tiles];
    [newTiles[index], newTiles[emptyIndex]] = [
      newTiles[emptyIndex],
      newTiles[index],
    ];

    state.tiles = newTiles;
    state.moves += 1;
    moveCountElement.textContent = state.moves.toString();

    renderBoard();

    if (isSolved(state.tiles)) {
      stopTimer();
      messageElement.textContent = `Готово! Вы собрали поле за ${state.moves} ходов и ${formatTime(state.seconds)}.`;
      messageElement.classList.add("message-win");
    }
  }

  function setupSettingsModal() {
    if (
      !settingsModal ||
      !gridContainer ||
      !widthInput ||
      !heightInput ||
      !settingsForm ||
      !statusElement
    ) {
      return;
    }

    let editorWidth = state.width;
    let editorHeight = state.height;

    openSettingsButton.addEventListener("click", () => {
      syncEditorWithState();
      openModal();
    });

    closeSettingsButton?.addEventListener("click", closeModal);
    cancelSettingsButton?.addEventListener("click", closeModal);

    rebuildButton?.addEventListener("click", () => {
      const width = clamp(Number(widthInput.value), 2, 8);
      const height = clamp(Number(heightInput.value), 2, 8);
      widthInput.value = width.toString();
      heightInput.value = height.toString();

      const mode = presetSelect?.value ?? "sequence";
      let values = [];

      if (mode === "random") {
        values = createRandomTiles(width, height).map(toEditorValue);
      } else if (mode === "clear") {
        values = Array(width * height).fill("");
      } else {
        values = createSequenceTiles(width, height).map(toEditorValue);
      }

      buildSettingsGrid(width, height, values);
      setStatus("Сетка обновлена. Измените числа при необходимости.", "info");
    });

    settingsModal?.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.close === "true") {
        closeModal();
      }
    });

    settingsForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      const width = clamp(Number(widthInput.value), 2, 8);
      const height = clamp(Number(heightInput.value), 2, 8);
      widthInput.value = width.toString();
      heightInput.value = height.toString();

      if (width !== editorWidth || height !== editorHeight) {
        setStatus("Обновите сетку после изменения размеров.", "error");
        return;
      }

      const { tiles, error } = collectTilesFromGrid();
      if (error) {
        setStatus(error, "error");
        return;
      }

      applyPuzzle({ width, height, tiles });
      closeModal();
    });

    function syncEditorWithState() {
      editorWidth = state.width;
      editorHeight = state.height;
      widthInput.value = state.width.toString();
      heightInput.value = state.height.toString();
      if (presetSelect) {
        presetSelect.value = "sequence";
      }
      buildSettingsGrid(
        state.width,
        state.height,
        state.tiles.map((value) => (value === 0 ? "" : value.toString())),
      );
      setStatus("", null);
    }

    function openModal() {
      if (!settingsModal) return;
      settingsModal.dataset.open = "true";
      settingsModal.setAttribute("aria-hidden", "false");
      document.body.dataset.modalOpen = "true";
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        widthInput.focus();
        widthInput.select();
      }, 0);
    }

    function closeModal() {
      if (!settingsModal) return;
      delete settingsModal.dataset.open;
      settingsModal.setAttribute("aria-hidden", "true");
      document.body.removeAttribute("data-modal-open");
      window.removeEventListener("keydown", handleKeyDown);
      setStatus("", null);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    }

    function buildSettingsGrid(width, height, values) {
      editorWidth = width;
      editorHeight = height;
      gridContainer.innerHTML = "";
      gridContainer.style.setProperty("--columns", width.toString());

      const total = width * height;
      const cells = Array.from({ length: total }, (_, index) => values?.[index] ?? "");

      cells.forEach((value, index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.pattern = "[0-9]*";
        input.maxLength = 3;
        input.placeholder = "0";
        input.value = value;
        input.dataset.index = index.toString();

        input.addEventListener("input", () => {
          if (statusElement.dataset.state !== "error") {
            setStatus("Поле изменено. Нажмите «Применить».", "info");
          }
        });

        gridContainer.appendChild(input);
      });
    }

    function collectTilesFromGrid() {
      const inputs = Array.from(gridContainer.querySelectorAll("input"));
      if (inputs.length !== editorWidth * editorHeight) {
        return {
          tiles: [],
          error: "Обновите сетку после изменения размеров.",
        };
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
          error: "Используйте только числа или оставьте клетку пустой.",
        };
      }

      const zeroCount = tiles.filter((value) => value === 0).length;
      if (zeroCount !== 1) {
        return {
          tiles: [],
          error: "Должна быть ровно одна пустая клетка.",
        };
      }

      const total = editorWidth * editorHeight;
      const sortedTiles = [...tiles].sort((a, b) => a - b);
      for (let i = 0; i < total; i += 1) {
        if (sortedTiles[i] !== i) {
          return {
            tiles: [],
            error: "Используйте каждое число от 1 до N-1 по одному разу.",
          };
        }
      }

      return { tiles, error: null };
    }

    function applyPuzzle({ width, height, tiles }) {
      clearInterval(state.timer);
      initialTiles = [...tiles];
      state = {
        ...state,
        width,
        height,
        tiles: [...tiles],
        moves: 0,
        seconds: 0,
        timer: null,
        started: false,
      };
      boardSizeElement.textContent = `${width} × ${height}`;
      moveCountElement.textContent = "0";
      timerElement.textContent = formatTime(0);
      messageElement.textContent = "";
      messageElement.classList.remove("message-win");
      renderBoard();
    }

    function setStatus(message, stateKey) {
      if (!statusElement) return;
      statusElement.textContent = message;
      if (!stateKey) {
        delete statusElement.dataset.state;
      } else {
        statusElement.dataset.state = stateKey;
      }
    }
  }
});

function isAdjacent(indexA, indexB, width) {
  const rowA = Math.floor(indexA / width);
  const colA = indexA % width;
  const rowB = Math.floor(indexB / width);
  const colB = indexB % width;

  const manhattan = Math.abs(rowA - rowB) + Math.abs(colA - colB);
  return manhattan === 1;
}

function isSolved(tiles) {
  for (let i = 0; i < tiles.length - 1; i += 1) {
    if (tiles[i] !== i + 1) {
      return false;
    }
  }
  return tiles[tiles.length - 1] === 0;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function parsePuzzleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const payload = params.get("p");
  if (!payload) return null;

  try {
    return decodePuzzle(payload);
  } catch (error) {
    console.warn("Не удалось прочитать поле из URL", error);
    return null;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createSequenceTiles(width, height) {
  const total = width * height;
  return Array.from({ length: total }, (_, index) =>
    index === total - 1 ? 0 : index + 1,
  );
}

function createRandomTiles(width, height) {
  const total = width * height;
  let candidate = [];

  do {
    candidate = shuffle(Array.from({ length: total }, (_, index) => index));
  } while (!isPuzzleSolvable(candidate, width, height));

  return candidate;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isPuzzleSolvable(tiles, width, height) {
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

function toEditorValue(value) {
  return value === 0 ? "" : value.toString();
}
