import type { CardName, PlayerId } from "../types/game-state";
import { BaseModal } from "./Modal/BaseModal";
import { Card } from "./Card";

interface ReactionModalProps {
  reactions: CardName[];
  triggeringCard: CardName;
  triggeringPlayerId: PlayerId;
  onReveal: (card: CardName) => void;
  onDecline: () => void;
}

export function ReactionModal({
  reactions,
  triggeringCard,
  triggeringPlayerId,
  onReveal,
  onDecline,
}: ReactionModalProps) {
  return (
    <BaseModal isOpen={true} onClose={() => {}}>
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 600 }}>
          {triggeringPlayerId} played {triggeringCard}
        </h3>
        <p style={{ marginBottom: "20px", color: "#6B7280" }}>
          Reveal a reaction to block?
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          {reactions.map(card => (
            <div
              key={card}
              onClick={() => onReveal(card)}
              style={{
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <Card name={card} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onDecline}
            style={{
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: "#9CA3AF",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "#6B7280";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "#9CA3AF";
            }}
          >
            Don't Reveal
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
