export default function MoveListMobile({ pairs, currentPly, baseFullmove, jumpToPly, activeMoveRef }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {pairs.length === 0 ? (
        <div style={{ color: "#999" }}>No moves yet.</div>
      ) : (
        pairs.map((pair, idx) => {
          const moveNo = baseFullmove + idx;
          const whitePly = idx * 2;
          const blackPly = whitePly + 1;
          const isWhiteActive = currentPly - 1 === whitePly;
          const isBlackActive = currentPly - 1 === blackPly;
          return (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#aaa", minWidth: 32, textAlign: "right" }}>{moveNo}.</span>
              <span
                ref={(el) => { if (isWhiteActive) activeMoveRef.current = el; }}
                onClick={() => pair[0] && jumpToPly(whitePly + 1)}
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
          );
        })
      )}
    </div>
  );
}
