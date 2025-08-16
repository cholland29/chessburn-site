import React from "react";
export default function MoveListDesktop({ pairs, currentPly, baseFullmove, jumpToPly, activeMoveRef }) {
  return (
    <div
      role="list"
      aria-label="Moves"
      style={{
        display: "grid",
        gridTemplateColumns: "4ch 1fr 1fr", // number | white | black
        columnGap: 12,
        rowGap: 4,
        alignItems: "center",
      }}
    >
      {pairs.map((pair, idx) => {
        const moveNo = baseFullmove + idx;
        const whitePly = idx * 2;
        const blackPly = whitePly + 1;
        const isWhiteActive = currentPly - 1 === whitePly;
        const isBlackActive = currentPly - 1 === blackPly;
        return (
          <React.Fragment key={idx}>
            <div style={{ textAlign: "right", color: "#aaa", paddingRight: 6 }}>{moveNo}.</div>
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
          </React.Fragment>
        );
      })}
    </div>
  );
}
