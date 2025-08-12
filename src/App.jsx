import { useEffect, useState } from "react";
import * as ChessJS from "chess.js";
import { Chessboard } from "react-chessboard";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// chess.js export compatibility
const Chess = ChessJS.Chess || ChessJS.default;

// Curated test positions
const TEST_FENS = [
  { name: "Start", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { name: "After 1. e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
  { name: "After 1... c5", fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2" },
  { name: "En passant available", fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3" },
  { name: "Castle both sides", fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1" },
  { name: "Kiwipete", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" },
  { name: "Promotion test", fen: "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1" },
  { name: "Bare kings", fen: "8/8/8/8/8/8/8/4K2k w - - 0 1" },
];

function computeBoardWidth() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  return Math.max(280, Math.min(420, Math.floor(vw * 0.9)));
}

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardWidth, setBoardWidth] = useState(computeBoardWidth());

  // FEN loader state
  const [fenText, setFenText] = useState(() => game.fen());
  const [fenError, setFenError] = useState("");
  const [lastLoadedName, setLastLoadedName] = useState("");

  // Responsive sizing
  useEffect(() => {
    const onResize = () => setBoardWidth(computeBoardWidth());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Moves
  function onPieceDrop(from, to) {
    try {
      const next = new Chess(game.fen());
      const move = next.move({ from, to, promotion: "q" });
      if (!move) return false;      // illegal -> snap back
      setGame(next);                // legal -> update
      setFenText(next.fen());
      setFenError("");
      return true;
    } catch {
      return false;
    }
  }

  function reset() {
    const next = new Chess();
    setGame(next);
    setFenText(next.fen());
    setFenError("");
    setLastLoadedName("");
  }

  function undo() {
    const next = new Chess(game.fen());
    next.undo();
    setGame(next);
    setFenText(next.fen());
  }

  // FEN validation/load
  function validateFen(fen) {
    if (Chess.validate_fen) return Chess.validate_fen(fen); // {valid, error}
    try {
      new Chess(fen);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e?.message || "Invalid FEN" };
    }
  }

  function loadFen() {
    const raw = fenText.trim().replace(/\s+/g, " ");
    const chk = validateFen(raw);
    if (!chk.valid) {
      setFenError(chk.error || "Invalid FEN.");
      return;
    }
    const next = new Chess(raw);
    setGame(next);
    setFenText(next.fen());
    setFenError("");
    setLastLoadedName("Custom FEN");
  }

  // Random test FEN
  function loadRandomFen() {
    const pick = TEST_FENS[Math.floor(Math.random() * TEST_FENS.length)];
    try {
      const next = new Chess(pick.fen);
      setGame(next);
      setFenText(next.fen());
      setFenError("");
      setLastLoadedName(pick.name);
    } catch (e) {
      setFenError(e?.message || "Invalid FEN.");
    }
  }

  async function copyCurrentFen() {
    try { await navigator.clipboard.writeText(game.fen()); } catch {}
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>Chessburn</h1>
      <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
        Burn chess patterns into your brain.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={undo}>Undo</button>
        <button onClick={copyCurrentFen}>Copy FEN</button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Chessboard
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            boardWidth={boardWidth}
          />
        </div>
      </DndProvider>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="fen" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          FEN Loader
        </label>
        <input
          id="fen"
          type="text"
          value={fenText}
          onChange={(e) => setFenText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
              e.preventDefault();
              loadFen();
            }
          }}
          placeholder="Paste a 6-field FEN and press Enter or Load"
          style={{
            width: "100%",
            padding: "10px",
            fontFamily: "monospace",
            borderRadius: 6,
            border: fenError ? "2px solid #c62828" : "1px solid #ccc",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={loadFen}>Load FEN</button>
          <button
            onClick={() => {
              const start = new Chess();
              setFenText(start.fen());
              setFenError("");
              setLastLoadedName("Start");
            }}
          >
            Start FEN
          </button>
          <button onClick={loadRandomFen} title="Load a random known-good test position">
            Random test FEN
          </button>
        </div>
        {lastLoadedName && (
          <div style={{ marginTop: 6, color: "#555" }}>
            Loaded: <strong>{lastLoadedName}</strong>
          </div>
        )}
        {fenError && <div style={{ color: "#c62828", marginTop: 6 }}>{fenError}</div>}
      </div>
    </div>
  );
}
