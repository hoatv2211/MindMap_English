import type { TranscriptToken } from "../../shared/contracts";

export function TranscriptDiff({ tokens }: { tokens: TranscriptToken[] }) {
  return <div className="transcript-diff" aria-label="So sánh transcript">
    {tokens.map((item, index) => <span className={item.status} key={`${item.token}-${index}`}>
      {item.status === "missing" ? `Thiếu: ${item.token}` : item.status === "extra" ? `Thừa: ${item.token}` : item.token}
    </span>)}
  </div>;
}
