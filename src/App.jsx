import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function App() {
  const [game, setGame] = useState(() => new Chess());

  function safeGameMutate(modifier) {
    const next = new Chess(game.fen());
    modifier(next);
    setGame(next);
  }

  function onDrop(from, to) {
    let moveMade = null;
    safeGameMutate(g => {
      moveMade = g.move({ from, to, promotion: "q" });
    });
    return moveMade !== null; // snap back if illegal
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Chessburn</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Burn chess patterns into your brain.</p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={480} />
      </div>
    </div>
  );
}
