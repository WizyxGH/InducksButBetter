import React, { useMemo } from "react";
import { Link } from "@/components/ui/link";
import { cn, cleanComment } from "@/lib/utils";
import {
  inducksEntityRoute,
  parseInducksText,
  type InducksTextSegment,
} from "@/lib/inducksText";

interface InducksTextProps {
  /** Raw Inducks comment, cross-reference tags included. */
  text?: string | null;
  /**
   * Strip the surrounding brackets and quotes the dumps wrap comments in.
   * Defaults to true — every current caller used to go through `cleanComment`.
   */
  clean?: boolean;
  /** Extra classes for the cross-reference links. */
  linkClassName?: string;
}

/**
 * Renders an Inducks comment, turning its `<publication fr/MP>…</publication>`
 * style cross references into in-app links.
 *
 * Inline by design: it emits a fragment, so callers keep control of the
 * wrapping element and its typography.
 */
export function InducksText({ text, clean = true, linkClassName }: InducksTextProps) {
  const segments = useMemo<InducksTextSegment[]>(
    () => parseInducksText(clean ? cleanComment(text ?? undefined) : text),
    [text, clean]
  );

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ) : (
          <Link
            key={index}
            to={inducksEntityRoute(segment.entity, segment.code)}
            title={segment.code}
            // These comments often sit inside a clickable card; without this the
            // card's own handler would swallow the link and navigate elsewhere.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "text-primary hover:underline underline-offset-2 font-medium",
              linkClassName
            )}
          >
            {segment.label}
          </Link>
        )
      )}
    </>
  );
}
