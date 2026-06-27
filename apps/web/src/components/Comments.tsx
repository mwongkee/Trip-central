import { useState } from 'react';
import type { Comment } from '@tripboard/shared';

interface CommentsProps {
  comments: Comment[];
  onAdd: (text: string) => void;
  busy?: boolean;
}

/** One-level threaded comments per item. */
export function Comments({ comments, onAdd, busy }: CommentsProps) {
  const [text, setText] = useState('');
  const roots = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentCommentId === id);

  return (
    <div className="comments">
      <h4>Comments ({comments.length})</h4>
      <ul className="comments__list">
        {roots.map((c) => (
          <li key={c.commentId} className="comments__item">
            <CommentBody c={c} />
            {repliesOf(c.commentId).length > 0 && (
              <ul className="comments__replies">
                {repliesOf(c.commentId).map((r) => (
                  <li key={r.commentId}>
                    <CommentBody c={r} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {roots.length === 0 && <li className="comments__empty">No comments yet.</li>}
      </ul>

      <form
        className="comments__form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) {
            onAdd(t);
            setText('');
          }
        }}
      >
        <label htmlFor="comment-text" className="sr-only">
          Add a comment
        </label>
        <input
          id="comment-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          disabled={busy}
        />
        <button type="submit" className="btn" disabled={busy || !text.trim()}>
          Post
        </button>
      </form>
    </div>
  );
}

function CommentBody({ c }: { c: Comment }) {
  return (
    <div className="comments__body">
      <span className="comments__author">{c.authorName}</span>
      <time className="comments__time" dateTime={c.createdAt}>
        {new Date(c.createdAt).toLocaleString()}
      </time>
      <p>{c.text}</p>
    </div>
  );
}
