import { useEffect, useRef, useState, Fragment } from "react";
import MoveListDesktop from "./components/MoveList/MoveListDesktop.jsx";
import MoveListMobile from "./components/MoveList/MoveListMobile.jsx";
import * as ChessJS from "chess.js";
import { Chessboard } from "react-chessboard";

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
  // Responsive layout: stack board and move list vertically on mobile
  const [isMobileLayout, setIsMobileLayout] = useState(window.innerWidth < 600);
  useEffect(() => {
    function handleResize() {
      setIsMobileLayout(window.innerWidth < 600);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [eventInfo, setEventInfo] = useState({ event: "", site: "", date: "" });
  // Base position (updates on reset/FEN/PGN load)
  const [baseFen, setBaseFen] = useState(() => new Chess().fen());

  // Current displayed position
  const [game, setGame] = useState(() => new Chess());
  const [lastMove, setLastMove] = useState(null);   // {from,to}

  // Move history since baseFen
  const [moves, setMoves] = useState([]);           // SAN array
  const [currentPly, setCurrentPly] = useState(0);  // 0..moves.length

  // UI state
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [fenText, setFenText] = useState(() => game.fen());
  const [fenError, setFenError] = useState("");
  const [lastLoadedName, setLastLoadedName] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [pgnError, setPgnError] = useState("");
  const [whiteName, setWhiteName] = useState("");
  const [blackName, setBlackName] = useState("");
  const [whiteElo, setWhiteElo] = useState("");
  const [blackElo, setBlackElo] = useState("");
  const [whiteTitle, setWhiteTitle] = useState("");
  const [blackTitle, setBlackTitle] = useState("");

  // Layout refs
  const rowRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(360);
  const [stack, setStack] = useState(false);        // stack on small screens

  // Move-list scrolling
  const scrollRef = useRef(null);
  const activeMoveRef = useRef(null);

  // ==== Utilities ====
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

  // ---- PGN helpers: sanitize & tokenize (robust importer) ----
  function stripParenBlocks(s) {
    // remove nested (...) variations by repeated passes
    let prev;
    do { prev = s; s = s.replace(/\([^()]*\)/g, " "); } while (s !== prev);
    return s;
  }
  function sanitizeAndTokenizePgn(pgn) {
    let s = String(pgn || "").replace(/\r\n?/g, "\n");
    // detect starting FEN from headers only if [SetUp "1"] exists
    const fenTag = s.match(/\[FEN\s+"([^"]+)"\]/i);
    const setupTag = s.match(/\[SetUp\s+"1"\]/i);
    const startFen = fenTag && setupTag ? fenTag[1] : null;

    // remove headers, comments, variations, NAGs, move numbers, results
    s = s.replace(/^\s*\[.*?\]\s*$/gm, " ");
    s = s.replace(/\{[^}]*\}/g, " ");
    s = s.replace(/;[^\n]*/g, " ");
    s = stripParenBlocks(s);
    s = s.replace(/\$\d+/g, " ");
    s = s.replace(/\d+\.(\.\.)?/g, " ");
    s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
    s = s.replace(/[^\S\r\n]+/g, " ").trim();

    const raw = s.split(/\s+/).filter(Boolean);
    // strip !! ?! ?? etc (keep + and #)
    const tokens = raw.map((t) => t.replace(/[!?]+$/g, ""));
    return { tokens, startFen };
  }

  // ==== Lifecycle / sizing ====
  // Load FEN from URL (?fen=...)
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

  // ==== Keyboard shortcuts ====
  // ← : back    → : forward    Home : start    End : latest    F : flip board
  useEffect(() => {
    const stepBack    = () => { if (currentPly > 0)               jumpToPly(currentPly - 1); };
    const stepForward = () => { if (currentPly < moves.length)    jumpToPly(currentPly + 1); };
    const goLatest    = () => { if (currentPly < moves.length)    jumpToPly(moves.length); };
    const goStart     = () => { if (currentPly !== 0)             jumpToPly(0); };

    function onKey(e) {
      const t = document.activeElement;
      const tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      const typing = (t && (t.isContentEditable || tag === "input" || tag === "textarea"));
      if (typing) return;

      if (e.key === "ArrowLeft")      { e.preventDefault(); stepBack(); }
      else if (e.key === "ArrowRight"){ e.preventDefault(); stepForward(); }
      else if (e.key === "Home")      { e.preventDefault(); goStart(); }
      else if (e.key === "End")       { e.preventDefault(); goLatest(); }
      else if (e.key === "f" || e.key === "F") {
        setBoardOrientation(o => (o === "white" ? "black" : "white"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPly, moves.length]);

  // ==== Board interactions ====
  function onPieceDrop(from, to, piece) {
    try {
      if (!from || !to) return false;
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
      setPgnError("");
      setLastMove({ from, to });
      return true; // IMPORTANT for react-chessboard to accept the drop
    } catch (e) {
      return false;
    }
  }

  // ==== Commands ====
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
  setPgnError("");
  setWhiteName("");
  setBlackName("");
  setWhiteElo("");
  setBlackElo("");
  setWhiteTitle("");
  setBlackTitle("");
  setEventInfo({ event: "", site: "", date: "" });
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
    setPgnError("");
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
      setPgnError("");
    } catch (e) {
      setFenError(e?.message || "Invalid FEN.");
    }
  }

  // ==== PGN Import (robust) ====
  function importPgn(text) {
    // Extract metadata
    const eventMatch = text.match(/\[Event\s+"([^"]+)"\]/i);
    const siteMatch = text.match(/\[Site\s+"([^"]+)"\]/i);
    const dateMatch = text.match(/\[Date\s+"([^"]+)"\]/i);
    setEventInfo({
      event: eventMatch ? eventMatch[1] : "",
      site: siteMatch ? siteMatch[1] : "",
      date: dateMatch ? dateMatch[1] : ""
    });
    setPgnError("");
  // Extract player info from PGN headers
  const whiteMatch = text.match(/\[White\s+"([^"]+)"\]/i);
  const blackMatch = text.match(/\[Black\s+"([^"]+)"\]/i);
  const whiteEloMatch = text.match(/\[WhiteElo\s+"([^"]+)"\]/i);
  const blackEloMatch = text.match(/\[BlackElo\s+"([^"]+)"\]/i);
  const whiteTitleMatch = text.match(/\[WhiteTitle\s+"([^"]+)"\]/i);
  const blackTitleMatch = text.match(/\[BlackTitle\s+"([^"]+)"\]/i);
  setWhiteName(whiteMatch ? whiteMatch[1] : "White");
  setBlackName(blackMatch ? blackMatch[1] : "Black");
  setWhiteElo(whiteEloMatch && whiteEloMatch[1] !== "?" ? whiteEloMatch[1] : "");
  setBlackElo(blackEloMatch && blackEloMatch[1] !== "?" ? blackEloMatch[1] : "");
  setWhiteTitle(whiteTitleMatch ? whiteTitleMatch[1] : "");
  setBlackTitle(blackTitleMatch ? blackTitleMatch[1] : "");

    const { tokens, startFen } = sanitizeAndTokenizePgn(text);

    // base position: FEN from headers if present, else the standard start
    const base = startFen || new Chess().fen();
    const ch = new Chess(base);
    const applied = [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const mv = ch.move(tok); // SAN move
      if (!mv) {
        setPgnError(`Couldn't parse at token ${i + 1}: "${tok}"`);
        return;
      }
      applied.push(mv.san);
    }

    const endFen = ch.fen();
    const verbose = ch.history({ verbose: true });
    setBaseFen(base);
    setMoves(applied);
    setCurrentPly(0);
    const { ch: startGame, lm: startMove } = positionAtPly(0);
    setGame(startGame);
    setFenText(startGame.fen());
    setLastMove(startMove);
    setLastLoadedName("PGN import");
  }

  function importPgnFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importPgn(String(reader.result || ""));
    reader.onerror = () => setPgnError("Failed to read file.");
    reader.readAsText(file);
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

  // --- Chessboard v5 migration ---
  const chessRef = useRef(new Chess(baseFen));
  const [chessPosition, setChessPosition] = useState(baseFen);
  const [moveFrom, setMoveFrom] = useState("");
  const [squareStyles, setSquareStyles] = useState({});

  // Sync chessRef and position on FEN/PGN load/reset
  useEffect(() => {
    chessRef.current = new Chess(baseFen);
    setChessPosition(baseFen);
    setMoveFrom("");
    setSquareStyles({});
  }, [baseFen]);

  // Last-move highlight (yellow/green)
  useEffect(() => {
    if (lastMove) {
      setSquareStyles(styles => ({
        ...styles,
        [lastMove.from]: { background: "radial-gradient(circle, rgba(255,215,0,.45) 36%, transparent 40%)" },
        [lastMove.to]:   { background: "radial-gradient(circle, rgba(50,205,50,.45) 36%, transparent 40%)" },
      }));
    }
  }, [lastMove]);

  // Get move options for a square (show valid moves)
  function getMoveOptions(square) {
    const moves = chessRef.current.moves({ square, verbose: true });
    if (moves.length === 0) {
      setSquareStyles({});
      return false;
    }
    const newSquares = {};
    for (const move of moves) {
      newSquares[move.to] = {
        background: chessRef.current.get(move.to) && chessRef.current.get(move.to)?.color !== chessRef.current.get(square)?.color
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    }
    newSquares[square] = { background: 'rgba(255, 255, 0, 0.4)' };
    setSquareStyles(newSquares);
    return true;
  }

  // Click-to-move handler
  function onSquareClick(square, piece) {
    if (!moveFrom && piece) {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }
    const moves = chessRef.current.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find(m => m.from === moveFrom && m.to === square);
    if (!foundMove) {
      const hasMoveOptions = getMoveOptions(square);
      setMoveFrom(hasMoveOptions ? square : "");
      return;
    }
    try {
      chessRef.current.move({ from: moveFrom, to: square, promotion: 'q' });
      setChessPosition(chessRef.current.fen());
      setMoveFrom("");
      setSquareStyles({});
      setLastMove({ from: moveFrom, to: square });
    } catch {
      const hasMoveOptions = getMoveOptions(square);
      if (hasMoveOptions) setMoveFrom(square);
      return;
    }
  }

  // Drag-and-drop handler
  function onPieceDrop(sourceSquare, targetSquare, piece) {
    if (!targetSquare) return false;
    try {
      chessRef.current.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      setChessPosition(chessRef.current.fen());
      setMoveFrom("");
      setSquareStyles({});
      setLastMove({ from: sourceSquare, to: targetSquare });
      return true;
    } catch {
      return false;
    }
  }

  // Build SAN pairs for the move list
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]].filter(Boolean));
  }

  // Move number offset (from base FEN’s 6th field)
  const baseFullmove = (() => {
    try { return parseInt(baseFen.split(" ")[5] || "1", 10) || 1; } catch { return 1; }
  })();

  // Step controls availability
  const canBack = currentPly > 0;
  const canForward = currentPly < moves.length;
  const stepBack = () => canBack && jumpToPly(currentPly - 1);
  const stepForward = () => canForward && jumpToPly(currentPly + 1);
  const goLatest = () => canForward && jumpToPly(moves.length);
  const goStart = () => currentPly !== 0 && jumpToPly(0);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1rem" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h1 style={{ textAlign: "center", marginBottom: 8, width: "100%" }}>Chessburn</h1>
        <p style={{ textAlign: "center", color: "#bbb", marginTop: 0, width: "100%" }}>
          Burn chess patterns into your brain.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12, width: "100%" }}>
          <button onClick={reset}>Reset</button>
          <button onClick={() => setBoardOrientation(o => (o === "white" ? "black" : "white"))}>Flip board</button>
          <button onClick={copyShareLink}>Copy share link</button>
        </div>
      </div>

      <div
        ref={rowRef}
        style={{
          display: "flex",
          flexDirection: isMobileLayout ? "column" : "row",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: GAP,
        }}
      >
            {/* Board */}
            <div style={{ flex: "0 0 auto", width: isMobileLayout ? "100%" : boardWidth }}>
              {/* Concise PGN metadata above board */}
              {(eventInfo.event || eventInfo.site || eventInfo.date) && (
                <div style={{ textAlign: "center", fontSize: 13, color: "#aaa", marginBottom: 2 }}>
                  {[eventInfo.event, eventInfo.site, eventInfo.date].filter(Boolean).join(" • ")}
                </div>
              )}
              {/* Player names above/below board depending on orientation */}
              <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 8, fontSize: 18 }}>
                {boardOrientation === "white"
                  ? `${blackName}${blackTitle ? ` [${blackTitle}]` : ""}${blackElo ? ` (${blackElo})` : ""}`
                  : `${whiteName}${whiteTitle ? ` [${whiteTitle}]` : ""}${whiteElo ? ` (${whiteElo})` : ""}`}
              </div>
              <Chessboard
                id="main-board"
                position={chessPosition}
                boardOrientation={boardOrientation}
                animationDurationInMs={140}
                squareStyles={squareStyles}
                onPieceDrop={({ sourceSquare, targetSquare, piece }) =>
                  onPieceDrop(sourceSquare, targetSquare, piece)
                }
                onSquareClick={({ square, piece }) =>
                  onSquareClick(square, piece)
                }
                boardWidth={isMobileLayout ? Math.min(window.innerWidth - 32, 420) : boardWidth}
              />
              <div style={{ textAlign: "center", fontWeight: "bold", marginTop: 8, fontSize: 18 }}>
                {boardOrientation === "white"
                  ? `${whiteName}${whiteTitle ? ` [${whiteTitle}]` : ""}${whiteElo ? ` (${whiteElo})` : ""}`
                  : `${blackName}${blackTitle ? ` [${blackTitle}]` : ""}${blackElo ? ` (${blackElo})` : ""}`}
              </div>
            </div>

            {/* Move list: below board on mobile, right on desktop */}
            <aside
              style={{
                width: isMobileLayout ? "100%" : SIDE_W,
                height: isMobileLayout ? "auto" : boardWidth,
                flex: "0 0 auto",
                display: "flex",
                alignItems: "stretch",
                marginTop: isMobileLayout ? 16 : 0,
              }}
            >
              <div
                style={{
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  background: "#111",
                  color: "#eee",
                  height: "100%",
                  width: "100%",
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",   // header fixed, list scrolls
                }}
              >
                {/* Step controls (never scroll) */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <button onClick={stepBack}    disabled={!canBack}    style={{ opacity: canBack ? 1 : 0.5 }} title="Step back (←)">◀</button>
                  <button onClick={stepForward} disabled={!canForward} style={{ opacity: canForward ? 1 : 0.5 }} title="Step forward (→)">▶</button>
                  <button onClick={goStart}     disabled={!canBack}    style={{ opacity: canBack ? 1 : 0.5 }} title="Go to start (Home)">⏮</button>
                  <button onClick={goLatest}    disabled={!canForward} style={{ opacity: canForward ? 1 : 0.5 }} title="Go to latest (End)">⏭</button>
                </div>

                <div style={{ fontWeight: 600, margin: "0 0 8px 0" }}>Moves</div>

                {/* Scrollable move list only (custom number column to avoid clipping) */}
                <div
                  ref={scrollRef}
                  style={{
                    flex: "1 1 auto",
                    overflowY: "auto",
                    overflowX: "hidden",
                    minHeight: 0,
                  }}
                >
                  {isMobileLayout ? (
                    <MoveListMobile
                      pairs={pairs}
                      currentPly={currentPly}
                      baseFullmove={baseFullmove}
                      jumpToPly={jumpToPly}
                      activeMoveRef={activeMoveRef}
                    />
                  ) : (
                    <MoveListDesktop
                      pairs={pairs}
                      currentPly={currentPly}
                      baseFullmove={baseFullmove}
                      jumpToPly={jumpToPly}
                      activeMoveRef={activeMoveRef}
                    />
                  )}
                </div>
              </div>
            </aside>
      </div>

      {/* FEN + PGN Loaders */}
      <div style={{ marginTop: 16 }}>
        {/* FEN */}
        <label htmlFor="fen" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>FEN Loader</label>
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
            width: "100%", padding: "10px", fontFamily: "monospace", borderRadius: 6,
            border: fenError ? "2px solid #7f1d1d" : "1px solid #333", background: "#111", color: "#eee",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={loadFen}>Load FEN</button>
          <button onClick={copyCurrentFen}>Copy FEN</button>
          <button onClick={loadRandomFen}>Random test FEN</button>
        </div>
        {lastLoadedName && <div style={{ marginTop: 6, color: "#bbb" }}>Loaded: <strong>{lastLoadedName}</strong></div>}
        {fenError && <div style={{ color: "#fca5a5", marginTop: 6 }}>{fenError}</div>}

        {/* PGN */}
        <hr style={{ borderColor: "#333", margin: "16px 0" }} />
        <label htmlFor="pgn" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>PGN Import</label>
        <textarea
          id="pgn"
          value={pgnText}
          onChange={(e) => setPgnText(e.target.value)}
          placeholder='Paste a PGN here. Example: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'
          rows={6}
          style={{
            width: "100%", padding: "10px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            borderRadius: 6, border: pgnError ? "2px solid #7f1d1d" : "1px solid #333",
            background: "#111", color: "#eee", whiteSpace: "pre-wrap",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => importPgn(pgnText)}>Load PGN</button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="file"
              accept=".pgn,text/plain"
              style={{ display: "none" }}
              onChange={(e) => importPgnFromFile(e.target.files?.[0] || null)}
            />
            <span style={{ border: "1px solid #333", padding: "6px 10px", borderRadius: 6 }}>Choose .pgn file…</span>
          </label>
        </div>
        {pgnError && <div style={{ color: "#fca5a5", marginTop: 6 }}>{pgnError}</div>}
      </div>
    </div>
  );
}
