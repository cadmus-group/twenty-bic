import { atom } from 'jotai';

// Set when a Business row is created from the index; cleared after NIPT is saved or skipped.
export const recordCreationPendingNiptRecordIdState = atom<string | null>(null);
