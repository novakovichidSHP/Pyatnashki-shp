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

  const initialPuzzle = parsePuzzleFromUrl() ?? defaultPuzzle;
  const initialTiles = [...initialPuzzle.tiles];

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
