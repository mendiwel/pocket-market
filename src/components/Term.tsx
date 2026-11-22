import { useId, type CSSProperties, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '../engine/glossary';
import { Speak } from './Speak';

/**
 * Inline glossary term: a native Popover anchored to the term with CSS
 * Anchor Positioning (falls back to a centered popover via @supports).
 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `term-${raw}`;
  const anchor = `--a-${raw}`;
  const entry = GLOSSARY[k];
  return (
    <>
      <button
        type="button"
        className="term"
        popoverTarget={id}
        style={{ anchorName: anchor } as CSSProperties}
      >
        {children ?? entry.termHe}
      </button>
      <div id={id} popover="auto" className="term-pop" style={{ positionAnchor: anchor } as CSSProperties}>
        <strong>{entry.termHe}</strong>
        <p>{entry.explanationHe}</p>
        <div className="term-pop__actions">
          <Speak text={`${entry.termHe}. ${entry.explanationHe}`} />
          <button type="button" className="btn btn--ghost btn--sm" popoverTarget={id} popoverTargetAction="hide">
            הבנתי
          </button>
        </div>
      </div>
    </>
  );
}
