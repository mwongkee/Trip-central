import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoteControl } from './VoteControl.js';
import type { Item, Vote, Voter } from '@tripboard/shared';

const item = (over: Partial<Item> = {}): Item => ({
  entity: 'item',
  itemId: 'i1',
  tripId: 't1',
  type: 'PLACE',
  title: 'Peggys Cove',
  isAnchor: false,
  status: 'suggested',
  currency: 'CAD',
  tags: [],
  voteScore: 0,
  voteCount: 0,
  commentCount: 0,
  createdByUserId: 'user-lewis',
  createdAt: 'x',
  updatedAt: 'x',
  ...over,
});

const family: Voter[] = [
  { voterId: 'user-lewis', name: 'Lewis', type: 'adult', familyId: 'fam-lewis', familyName: 'Lewis & Kristin' },
  { voterId: 'child-emmett', name: 'Emmett', type: 'child', familyId: 'fam-lewis', familyName: 'Lewis & Kristin' },
  { voterId: 'child-nico', name: 'Nico', type: 'child', familyId: 'fam-lewis', familyName: 'Lewis & Kristin' },
];

describe('VoteControl', () => {
  it('shows the live score and voter list', () => {
    const votes: Vote[] = [
      { entity: 'vote', itemId: 'i1', voterId: 'user-lewis', voterType: 'adult', voterName: 'Lewis', value: 1, castByUserId: 'user-lewis', createdAt: 'x' },
    ];
    render(<VoteControl item={item({ voteScore: 1, voteCount: 1 })} votes={votes} family={family} onVote={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText(/Score 1 from 1 votes/)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Who voted')).getByText('Lewis')).toBeInTheDocument();
  });

  it('lets a parent vote for a child (mark your family)', async () => {
    const onVote = vi.fn();
    render(<VoteControl item={item()} votes={[]} family={family} onVote={onVote} onRemove={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Vote as Emmett/i }));
    expect(onVote).toHaveBeenCalledWith('child-emmett', 1);
  });

  it('"mark whole family" votes for everyone not yet voted', async () => {
    const onVote = vi.fn();
    const votes: Vote[] = [
      { entity: 'vote', itemId: 'i1', voterId: 'user-lewis', voterType: 'adult', voterName: 'Lewis', value: 1, castByUserId: 'user-lewis', createdAt: 'x' },
    ];
    render(<VoteControl item={item({ voteScore: 1, voteCount: 1 })} votes={votes} family={family} onVote={onVote} onRemove={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Mark whole family \(2\)/ }));
    expect(onVote).toHaveBeenCalledTimes(2);
    expect(onVote).toHaveBeenCalledWith('child-emmett', 1);
    expect(onVote).toHaveBeenCalledWith('child-nico', 1);
  });

  it('toggling an existing vote removes it', async () => {
    const onRemove = vi.fn();
    const votes: Vote[] = [
      { entity: 'vote', itemId: 'i1', voterId: 'user-lewis', voterType: 'adult', voterName: 'Lewis', value: 1, castByUserId: 'user-lewis', createdAt: 'x' },
    ];
    render(<VoteControl item={item({ voteScore: 1, voteCount: 1 })} votes={votes} family={family} onVote={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove Lewis's vote/i }));
    expect(onRemove).toHaveBeenCalledWith('user-lewis');
  });
});
