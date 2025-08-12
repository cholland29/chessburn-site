import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

const MAX_BOARD_PX = 360; // tweak this to your taste (e.g., 320–420)

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardWidth, setBoardWidth] = useState(MAX_BOARD_PX);
  const containerRef = useRef(null);

  // Make board width follow the container width (up to MAX_BOARD_PX)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth || window.innerWidth;
      setBoardWidth(Math.min(MAX_BOARD_PX, Math.floor(w)));
    };

    update(); // run once on mount

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update); // mobile safety

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // Handle drag-drop with chess.js; return true if legal, false to snap back
  function onPieceDrop(sourceSquare, targetSquare) {
    const next = new Chess(game.fen()); // copy current state
    const move = next.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (move == null) return false;     // illegal → snap back
    setGame(next);                       // legal → update position
    return true;
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
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>Chessburn</h1>
      <p style={{ textAlign: "center", color: "#555", marginTop: 0 }}>
        Burn chess patterns into your brain.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={undo}>Undo</button>
      </div>

      <div ref={containerRef}>
        <Chessboard
          position={game.fen()}
          onPieceDrop={onPieceDrop}
          arePiecesDraggable={true}
          boardWidth={boardWidth}
        />
      </div>
    </div>
  );
}
