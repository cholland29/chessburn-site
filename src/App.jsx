import { useEffect, useRef, useState } from "react";
import * as ChessJS from "chess.js";
import { Chessboard } from "react-chessboard";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const Chess = ChessJS.Chess || ChessJS.default;

// Layout constants
const SIDE_W = 260;     // fixed width for right panel
const GAP = 16;         // gap between board and panel
const BOARD_MIN = 280;
const BOARD_MAX = 520;

// Test FENs
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

export default function App() {
  // Base position (updates on reset/load)
  const [baseFen, setBaseFen] = useState(() => new Chess().fen());

  const [game, setGame] = useState(() => new Chess()); // current displayed position
  const [fenText, setFenText] = useState(() => game.fen());
  const [fenError, setFenError] = useState("");
  const [lastLoadedName, setLastLoadedName] = useState("");

  const [moves, setMoves] = useState([]);           // SAN array since baseFen
  const [currentPly, setCurrentPly] = useState(0);  // index into moves (0..moves.length)
  const [lastMove, setLastMove] = useState(null);   // {from,to}

  const [boardOrientation, setBoardOrientation] = useState("white");

  const rowRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(360);
  const [stack, setStack] = useState(false);        // stack on small screens

  // Move-list scrolling
  const scrollRef = useRef(null);
  const activeMoveRef = useRef(null);

  // FEN from URL (?fen=...)
  useEffect(() => {
    try {
      const qfen = new URLSearchParams(window.location.search).get("fen");
      if (qfen) {
        const next = new Chess(qfen);
        const fen = next.fen();
        setBaseFen(fen);
        setGame(next);
        setFenText(fen);
        setMoves([]);
        setCurrentPly(0);
        setLastMove(null);
        setFenError("");
        setLastLoadedName("From URL");
      }
    } catch {}
  }, []);

  // Board width with fixed side panel reservation
  useEffect(() => {
    function recompute() {
      const cw = rowRef.current?.clientWidth ?? window.innerWidth;
      const available = cw - SIDE_W - GAP;
      const fitsSide = available >= BOARD_MIN;
      setStack(!fitsSide);

      const w = fitsSide
        ? Math.min(BOARD_MAX, available)
        : Math.max(BOARD_MIN, Math.min(420, Math.floor(window.innerWidth * 0.9)));
      setBoardWidth(w);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (rowRef.current) ro.observe(rowRef.current);
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
    };
  }, []);

  // Auto-scroll the move list to keep the active move in view
  useEffect(() => {
    const el = activeMoveRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [currentPly, moves.length, stack, boardWidth]);

  // Helpers
  function validateFen(fen) {
    if (Chess.validate_fen) return Chess.validate_fen(fen);
    try { new Chess(fen); return { valid: true }; }
    catch (e) { return { valid: false, error: e?.message || "Invalid FEN" }; }
  }

  function positionAtPly(ply) {
    const ch = new Chess(baseFen);
    for (let i = 0; i < Math.min(ply, moves.length); i++) ch.move(moves[i]);
    const hist = ch.history({ verbose: true });
    const lm = hist.length ? { from: hist[hist.length - 1].from, to: hist[hist.length - 1].to } : null;
    return { ch, lm };
  }

  function jumpToPly(ply) {
    const { ch, lm } = positionAtPly(ply);
    setGame(ch);
    setFenText(ch.fen());
    setCurrentPly(ply);
    setLastMove(lm);
  }

  function onPieceDrop(from, to) {
    try {
      // start from the *current* displayed position
      const next = new Chess(game.fen());
      const moved = next.move({ from, to, promotion: "q" });
      if (!moved) return false;

      // trim future moves if we had jumped back, then append
      const newMoves = moves.slice(0, currentPly);
      newMoves.push(moved.san);

      setMoves(newMoves);
      setCurrentPly(newMoves.length);
      setGame(next);
      setFenText(next.fen());
      setFenError("");
      setLastMove({ from, to });
      return true;
    } catch {
      return false;
    }
  }

  function reset() {
    const start = new Chess();
    const fen = start.fen();
    setBaseFen(fen);
    setGame(start);
    setFenText(fen);
    setFenError("");
    setMoves([]);
    setCurrentPly(0);
    setLastMove(null);
    setLastLoadedName("");
  }

  function undo() {
    if (moves.length === 0) return;
    const newMoves = moves.slice(0, -1);
    setMoves(newMoves);
    setCurrentPly(newMoves.length);
    const { ch, lm } = positionAtPly(newMoves.length);
    setGame(ch);
    setFenText(ch.fen());
    setLastMove(lm);
  }

  function loadFen() {
    const raw = fenText.trim().replace(/\s+/g, " ");
    const chk = validateFen(raw);
    if (!chk.valid) { setFenError(chk.error || "Invalid FEN."); return; }
    const next = new Chess(raw);
    const fen = next.fen();
    setBaseFen(fen);
    setGame(next);
    setFenText(fen);
    setFenError("");
    setMoves([]);
    setCurrentPly(0);
    setLastMove(null);
    setLastLoadedName("Custom FEN");
  }

  function loadRandomFen() {
    const pick = TEST_FENS[Math.floor(Math.random() * TEST_FENS.length)];
    try {
      const next = new Chess(pick.fen);
      const fen = next.fen();
      setBaseFen(fen);
      setGame(next);
      setFenText(fen);
      setFenError("");
      setMoves([]);
      setCurrentPly(0);
      setLastMove(null);
      setLastLoadedName(pick.name);
    } catch (e) {
      setFenError(e?.message || "Invalid FEN.");
    }
  }

  async function copyCurrentFen() {
    try { await navigator.clipboard.writeText(game.fen()); } catch {}
  }
  async function copyShareLink() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("fen", game.fen());
      await navigator.clipboard.writeText(url.toString());
    } catch {}
  }

  // Last-move highlight
  const customSquareStyles = lastMove
    ? {
        [lastMove.from]: { background: "radial-gradient(circle, rgba(255,215,0,.45) 36%, transparent 40%)" },
        [lastMove.to]:   { background: "radial-gradient(circle, rgba(50,205,50,.45) 36%, transparent 40%)" },
      }
    : {};

  // Build SAN pairs for the move list
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]].filter(Boolean));
  }

  // Move number offset (from base FEN’s 6th field)
  const baseFullmove = (() => {
    try { return parseInt(baseFen.split(" ")[5] || "1", 10) || 1; } catch { return 1; }
  })();

  // Step controls
  const canBack = currentPly > 0;
  const canForward = currentPly < moves.length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: 8 }}>Chessburn</h1>
      <p style={{ textAlign: "center", color: "#bbb", marginTop: 0 }}>
        Burn chess patterns into your brain.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={undo}>Undo</button>
        <button onClick={() => setBoardOrientation(o => (o === "white" ? "black" : "white"))}>
          Flip board
        </button>
        <button onClick={copyCurrentFen}>Copy FEN</button>
        <button onClick={copyShareLink}>Copy share link</button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div
          ref={rowRef}
          style={{
            display: "flex",
            flexDirection: stack ? "column" : "row",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: GAP,
          }}
        >
          {/* Board */}
          <div style={{ flex: "0 0 auto" }}>
            <Chessboard
              position={game.fen()}
              onPieceDrop={onPieceDrop}
              boardWidth={boardWidth}
              boardOrientation={boardOrientation}
              customSquareStyles={customSquareStyles}
            />
          </div>

          {/* Right-side panel: single column with vertical scroll + controls + clickable moves */}
          <aside
            style={{
              width: stack ? "100%" : SIDE_W,
              height: stack ? 200 : boardWidth,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                border: "1px solid #2a2a2a",
                borderRadius: 8,
                padding: 8,
                height: "100%",
                background: "#111",
                color: "#eee",
                overflowY: "auto",
                overflowX: "hidden",
                width: "100%",
              }}
              ref={scrollRef}
            >
              {/* Step controls */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button
                  onClick={() => canBack && jumpToPly(currentPly - 1)}
                  disabled={!canBack}
                  style={{ opacity: canBack ? 1 : 0.5 }}
                  title="Step back (◀)"
                >
                  ◀
                </button>
                <button
                  onClick={() => canForward && jumpToPly(currentPly + 1)}
                  disabled={!canForward}
                  style={{ opacity: canForward ? 1 : 0.5 }}
                  title="Step forward (▶)"
                >
                  ▶
                </button>
                <button
                  onClick={() => canForward && jumpToPly(moves.length)}
                  disabled={!canForward}
                  style={{ opacity: canForward ? 1 : 0.5 }}
                  title="Go to latest (⏭)"
                >
                  ⏭
                </button>
              </div>

              <div style={{ fontWeight: 600, margin: "0 0 8px 0" }}>Moves</div>
              {pairs.length === 0 ? (
                <div style={{ color: "#999" }}>No moves yet.</div>
              ) : (
                <ol start={baseFullmove} style={{ margin: 0, paddingLeft: 20 }}>
                  {pairs.map((pair, idx) => {
                    const whitePly = idx * 2;
                    const blackPly = whitePly + 1;
                    const isWhiteActive = currentPly - 1 === whitePly;
                    const isBlackActive = currentPly - 1 === blackPly;

                    return (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            columnGap: 14,
                            alignItems: "center",
                          }}
                        >
                          <span
                            ref={(el) => { if (isWhiteActive) activeMoveRef.current = el; }}
                            onClick={() => pair[0] && jumpToPly(whitePly + 1)}
                            title={pair[0] ? `Jump to ${pair[0]}` : ""}
                            style={{
                              cursor: pair[0] ? "pointer" : "default",
                              background: isWhiteActive ? "#333" : "transparent",
                              borderRadius: 6,
                              padding: isWhiteActive ? "0 4px" : 0,
                            }}
                          >
                            {pair[0] || ""}
                          </span>
                          <span
                            ref={(el) => { if (isBlackActive) activeMoveRef.current = el; }}
                            onClick={() => pair[1] && jumpToPly(blackPly + 1)}
                            title={pair[1] ? `Jump to ${pair[1]}` : ""}
                            style={{
                              cursor: pair[1] ? "pointer" : "default",
                              background: isBlackActive ? "#333" : "transparent",
                              borderRadius: 6,
                              padding: isBlackActive ? "0 4px" : 0,
                            }}
                          >
                            {pair[1] || ""}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>
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
            border: fenError ? "2px solid #7f1d1d" : "1px solid #333",
            background: "#111",
            color: "#eee",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={loadFen}>Load FEN</button>
          <button
            onClick={() => {
              const start = new Chess();
              const fen = start.fen();
              setBaseFen(fen);
              setGame(start);
              setFenText(fen);
              setFenError("");
              setMoves([]);
              setCurrentPly(0);
              setLastMove(null);
              setLastLoadedName("Start");
            }}
          >
            Start FEN
          </button>
          <button onClick={loadRandomFen}>Random test FEN</button>
        </div>
        {lastLoadedName && (
          <div style={{ marginTop: 6, color: "#bbb" }}>
            Loaded: <strong>{lastLoadedName}</strong>
          </div>
        )}
        {fenError && <div style={{ color: "#fca5a5", marginTop: 6 }}>{fenError}</div>}
      </div>
    </div>
  );
}
