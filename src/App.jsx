import { useEffect, useState } from "react";
import * as ChessJS from "chess.js";
import { Chessboard } from "react-chessboard";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const Chess = ChessJS.Chess || ChessJS.default;

// Helper to compute a nice board width from the viewport
function computeBoardWidth() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  // clamp between 280 and 420 px, using ~90% of viewport width
  return Math.max(280, Math.min(420, Math.floor(vw * 0.9)));
}

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardWidth, setBoardWidth] = useState(computeBoardWidth());

  // Responsive: recalc on resize/orientation change
  useEffect(() => {
    const onResize = () => setBoardWidth(computeBoardWidth());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    onResize(); // ensure first paint is correct
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Handle drag-drop; return true to keep, false to snap back
  function onPieceDrop(from, to) {
    try {
      const next = new Chess(game.fen());
      const move = next.move({ from, to, promotion: "q" });
      if (!move) return false;  // illegal → snap back
      setGame(next);            // legal → update position
      return true;
    } catch (err) {
      // If chess.js throws, just snap back and keep going
      console.debug("illegal move (caught):", err);
      return false;
    }
  }

  function reset() {
    setGame(new Chess());
  }

  function undo() {
    const next = new Chess(game.fen());
    next.undo();
    setGame(next);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>Chessburn</h1>
      <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
        Burn chess patterns into your brain.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={undo}>Undo</button>
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
    </div>
  );
}
