import { PipFace } from './Tile'

function RuleHeading({ pips, children }: { pips?: number; children: React.ReactNode }) {
  return (
    <h2>
      {pips != null && (
        <span className="rule-pips">
          <PipFace value={pips} color="currentColor" r={11} />
        </span>
      )}
      {children}
    </h2>
  )
}

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
        <h1 className="sub-title">RULES</h1>
      </header>

      <div className="rules-body">
        <section>
          <h2>THE SET</h2>
          <p>
            A double-six set: 28 unique tiles, 0-0 through 6-6, shuffled every round. Seven tiles
            each. A tile may be played only when one of its halves matches an open end of the chain
            — it rotates automatically. The opener is whoever holds the highest double, otherwise
            the heaviest tile.
          </p>
        </section>

        <section>
          <RuleHeading pips={1}>BLOCK</RuleHeading>
          <p>
            The 14 leftover tiles sit out. No drawing — if you can't play, you pass. First player
            out of tiles wins. If both players are stuck, the round is blocked: fewest remaining
            pips wins.
          </p>
          <p className="rules-note">
            OPTIONS — "DRAW, DON'T PASS" puts the boneyard in play: no move means you grab tiles
            until you can act. "PLAY TO 100" chains rounds together: the round winner banks the
            opponent's remaining pips (a blocked round pays the difference to the lighter hand),
            and the first to 100 takes the match. Both options are set on the match screen and
            remembered.
          </p>
        </section>

        <section>
          <RuleHeading pips={2}>DRAW</RuleHeading>
          <p>
            The 14 leftover tiles form the boneyard. If you have no legal move you must draw until
            you find one; only when the boneyard is empty may you pass. First out wins, blocked
            rounds go to the fewest pips. The "PLAY TO 100" option works here too.
          </p>
        </section>

        <section>
          <RuleHeading pips={3}>ALL FIVES</RuleHeading>
          <p>
            After every placement, the open ends are totalled. If the total divides by five, you
            score that many points — live, from the real board state. Going out banks your
            opponent's remaining pips (rounded to the nearest five). A blocked round pays the
            pip difference to the lighter hand. First to 100 wins the match.
          </p>
          <p className="rules-note">
            HOUSE RULE SET — a double sitting on an open end counts both halves. Doubles do not
            spin into side branches in this edition: the chain keeps two open ends, left and
            right. Drawing works as in DRAW mode.
          </p>
        </section>

        <section>
          <h2>READING THE BOARD</h2>
          <p>
            White tiles are yours — your color marks the pivot. Black tiles are the AI's. Drag to
            pan, scroll to zoom, RECENTER to snap back. Select a tile, then tap a target frame to
            place it; when both ends accept it, you choose.
          </p>
        </section>
      </div>
    </div>
  )
}
