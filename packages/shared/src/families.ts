/**
 * The trip's families. Adults become Members (a votable adult identity that can
 * "join" on a device); kids become ChildProfiles (votable, no sign-in).
 *
 * Source: the household roster provided for this trip. If a name's role or
 * spelling is off, edit here — this is the single source used by both the seed
 * script and the web join screen. See DECISIONS.md for parsing notes.
 */

export interface FamilySeed {
  familyId: string;
  familyName: string;
  adults: { userId: string; name: string }[];
  kids: { childId: string; name: string }[];
}

export const FAMILIES: FamilySeed[] = [
  {
    familyId: 'fam-lewis',
    familyName: 'Matt & Kristin',
    adults: [
      { userId: 'user-matt', name: 'Matt' },
      { userId: 'user-kristin', name: 'Kristin' },
    ],
    kids: [
      { childId: 'child-lewis', name: 'Lewis' },
      { childId: 'child-emmett', name: 'Emmett' },
      { childId: 'child-nico', name: 'Nico' },
    ],
  },
  {
    familyId: 'fam-steve',
    familyName: 'Steve & Sarah',
    adults: [
      { userId: 'user-steve', name: 'Steve' },
      { userId: 'user-sarah', name: 'Sarah' },
    ],
    kids: [
      { childId: 'child-isaac', name: 'Isaac' },
      { childId: 'child-alex', name: 'Alex' },
      { childId: 'child-jamie', name: 'Jamie' },
    ],
  },
  {
    familyId: 'fam-sergey',
    familyName: 'Sergey & Alyssa',
    adults: [
      { userId: 'user-sergey', name: 'Sergey' },
      { userId: 'user-alyssa', name: 'Alyssa' },
    ],
    kids: [
      { childId: 'child-phillip', name: 'Phillip' },
      { childId: 'child-sophia', name: 'Sophia' },
    ],
  },
];

export const DEMO_TRIP_ID = 'trip-novascotia-2026';
