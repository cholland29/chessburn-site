import { useEffect, useState } from "react";
import * as ChessJS from "chess.js";
import { Chessboard } from "react-chessboard";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const Chess = ChessJS.Chess || ChessJS.default;

function computeBoardWidth() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  return Math.max(280, Math.min(420, Math.floor(vw * 0.9)));
}

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardWidth, setBoardWidth] = useState(computeBoardWidth());
  const [fenText, setFenText] = useState(() => game.fen());
  const [fenError, setFenError] = useState("");

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

  function onPieceDrop(from, to) {
    try {
      const next = new Chess(game.fen());
      const move = next.move({ from, to, promotion: "q" });
      if (!move) return false;
      setGame(next);
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
  }

  function undo() {
    const next = new Chess(game.fen());
    next.undo();
    setGame(next);
    setFenText(next.fen());
  }

  // ---- Robust FEN loader ----
  function validateFen(fen) {
    if (Chess.validate_fen) return Chess.validate_fen(fen); // {valid, error}
    // fallback: try constructing
    try {
      // will throw on bad FEN in some versions
      new Chess(fen);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e?.message || "Invalid FEN" };
    }
  }

  function loadFen() {
    const raw = fenText.trim().replace(/\s+/g, " "); // normalize spaces
    const check = validateFen(raw);
    if (!check.valid) {
      setFenError(check.error || "Invalid FEN.");
      return;
    }
    try {
      const next = new Chess(raw); // construct from FEN (most reliable path)
      setGame(next);
      setFenText(next.fen()); // normalized FEN back into the box
      setFenError("");
    } catch (e) {
      setFenError(e?.message || "Invalid FEN.");
    }
  }

  async function copyCurrentFen() {
    try {
      await navigator.clipboard.writeText(game.fen());
    } catch {}
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>Chessburn</h1>
      <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
        Burn chess patterns into your brain.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
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

      {/* FEN Loader */}
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
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={loadFen}>Load FEN</button>
          <button
            onClick={() => {
              const start = new Chess();
              setFenText(start.fen());
              setFenError("");
            }}
          >
            Start FEN
          </button>
        </div>
        {fenError && <div style={{ color: "#c62828", marginTop: 6 }}>{fenError}</div>}
      </div>
    </div>
  );
}
