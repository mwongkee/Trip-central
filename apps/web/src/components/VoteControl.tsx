import type { Item, Vote, Voter } from '@tripboard/shared';
import { Avatar } from './Avatar.js';

interface VoteControlProps {
  item: Item;
  votes: Vote[];
  /** The joined user's household — self, spouse, and kids. */
  family: Voter[];
  onVote: (voterId: string, value: number) => void;
  onRemove: (voterId: string) => void;
  busy?: boolean;
}

/**
 * "Mark your family" vote control. A parent toggles a vote for themselves and any
 * of their kids; the live score and the full voter list are always visible.
 * Presentational only — the container wires the mutations.
 */
export function VoteControl({ item, votes, family, onVote, onRemove, busy }: VoteControlProps) {
  const votedUp = new Set(votes.filter((v) => v.value > 0).map((v) => v.voterId));
  const familyUnvoted = family.filter((f) => !votedUp.has(f.voterId));

  return (
    <div className="vote">
      <div className="vote__score" aria-label={`Score ${item.voteScore} from ${item.voteCount} votes`}>
        <span className="vote__scoreIcon" aria-hidden="true">
          ★
        </span>
        <strong>{item.voteScore}</strong>
        <span className="vote__scoreCount">
          {item.voteCount} vote{item.voteCount === 1 ? '' : 's'}
        </span>
        {busy && <span className="vote__saving" aria-live="polite">⏳ Saving…</span>}
      </div>

      {family.length > 0 && (
        <fieldset className="vote__family" disabled={busy}>
          <legend>Vote for your family</legend>
          <div className="vote__chips">
            {family.map((f) => {
              const isUp = votedUp.has(f.voterId);
              return (
                <button
                  key={f.voterId}
                  type="button"
                  className={`chip ${isUp ? 'chip--on' : ''}`}
                  aria-pressed={isUp}
                  aria-label={isUp ? `Remove ${f.name}'s vote` : `Vote as ${f.name}`}
                  onClick={() => (isUp ? onRemove(f.voterId) : onVote(f.voterId, 1))}
                  title={isUp ? `Remove ${f.name}'s vote` : `Vote as ${f.name}`}
                >
                  <Avatar name={f.name} size={18} />
                  <span aria-hidden="true">{isUp ? '✓ ' : '+ '}</span>
                  {f.name}
                  {f.type === 'child' && <span className="chip__tag"> (kid)</span>}
                </button>
              );
            })}
          </div>
          {familyUnvoted.length > 0 && (
            <button
              type="button"
              className="vote__all"
              disabled={busy}
              onClick={() => familyUnvoted.forEach((f) => onVote(f.voterId, 1))}
            >
              {busy ? '⏳ Saving…' : `👍 Mark whole family (${familyUnvoted.length})`}
            </button>
          )}
        </fieldset>
      )}

      <VoterList votes={votes} />
    </div>
  );
}

function VoterList({ votes }: { votes: Vote[] }) {
  if (votes.length === 0) return <p className="vote__none">No votes yet — be the first.</p>;
  return (
    <ul className="vote__voters" aria-label="Who voted">
      {votes
        .slice()
        .sort((a, b) => a.voterName.localeCompare(b.voterName))
        .map((v) => (
          <li key={v.voterId} className="vote__voter">
            <Avatar name={v.voterName} size={18} />
            <span className="vote__voterName">{v.voterName}</span>
            {v.voterType === 'child' && <span className="chip__tag"> (kid)</span>}
            <span aria-hidden="true" className="vote__dir">{v.value > 0 ? '👍' : '👎'}</span>
          </li>
        ))}
    </ul>
  );
}
