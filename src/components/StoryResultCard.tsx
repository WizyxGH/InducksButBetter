import * as React from "react"
import { hasInducksCookie, formatInducksDate } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { ResultCardThumb } from "@/components/ResultCard/ResultCardThumb"
import { thumbUrls } from "@/components/ResultCard/thumbUrl"
import { HoverTooltip } from '@/components/HoverTooltip';
import { EntityBadge } from "@/components/EntityBadge"
import { FlagBadge } from "@/components/FlagBadge"
import { KindBadge } from "@/components/KindBadge"
import { routes } from "@/lib/routes"
import { Link } from "@/components/ui/link"
import { getBasePath, isModifiedClick } from "@/lib/navigation"
import { parseCredits } from "@/lib/credits"

interface StoryResultCardProps {
  row: any
  onSelect?: (storycode: string) => void
  onSelectCharacter?: (code: string, name: string) => void
}

export function StoryResultCard({ row, onSelect, onSelectCharacter }: StoryResultCardProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  const cleanText = (val: string) => {
    if (!val) return "";
    let clean = val.trim();
    // If it's something like "[Comment]", remove brackets but keep text
    if (clean.startsWith('[') && clean.endsWith(']')) {
      return clean.substring(1, clean.length - 1).trim();
    }
    // Otherwise remove bracketed parts like "[Original Title]" from names
    return clean.replace(/\[.*?\]/g, '').trim();
  };

  const formatDate = (dateStr: string) => {
    return formatInducksDate(dateStr, i18n.language);
  };

  const charactersRaw = row.character_list ? row.character_list.split(';').map((c: string) => {
    const [code, name, appComment, charComment, url] = c.split('|');
    return {
      code,
      name: cleanText(name),
      appComment: cleanText(appComment),
      charComment: cleanText(charComment),
      url: url
    };
  }) : [];

  // Deduplicate by name to avoid "Picsou" appearing twice if multiple codes map to same name
  const characters = charactersRaw.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.name === v.name) === i);

  // The SQL side cannot deduplicate and keep a ';' separator at the same time
  // (GROUP_CONCAT DISTINCT forces ','), so duplicates are dropped here.
  const publications = (row.publication_list ? row.publication_list.split(';') : [])
    .map((p: string) => {
      const parts = p.split('|');
      return { country: parts[0], name: cleanText(parts[1]), issueNumber: parts[2] ? cleanText(parts[2]) : '' };
    })
    .filter(
      (v: any, i: number, a: any[]) =>
        a.findIndex((t: any) => t.country === v.country && t.name === v.name && t.issueNumber === v.issueNumber) === i
    );

  const { writers, artists } = React.useMemo(() => parseCredits(row.creators), [row.creators]);

  const text = React.useMemo(() => {
    return (row.full_description || "").trim();
  }, [row.full_description]);

  React.useLayoutEffect(() => {
    if (textRef.current && text) {
      const hasOverflow = textRef.current.scrollHeight > textRef.current.clientHeight;
      setIsTruncated(hasOverflow);
    }
  }, [text]);

  const storyUrl = `https://inducks.org/story.php?c=${row.storycode}`;

  const thumbData = React.useMemo(() => thumbUrls(row.story_thumb), [row.story_thumb]);

  const targetHref = routes.story(row.storycode);

  const handleClick = (e: React.MouseEvent) => {
    // Let EntityBadge or other nested links handle their own clicks.
    if ((e.target as HTMLElement).closest('a')) {
      return;
    }

    // The card is not an anchor (it embeds anchors, which cannot be nested),
    // so ctrl/cmd/shift/middle click is opened explicitly. Doing it inline in
    // the click handler keeps it a user gesture, so popup blockers allow it.
    if (isModifiedClick(e)) {
      window.open(`${getBasePath()}${targetHref}`, "_blank", "noopener");
      return;
    }

    onSelect?.(row.storycode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(row.storycode);
    }
  };

  const hasCookie = React.useMemo(() => hasInducksCookie(), []);

  return (
    <div
      role="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="group block overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 hover:bg-zinc-50/10 dark:hover:bg-zinc-800/10 transition-all duration-300 rounded-lg bg-white dark:bg-zinc-900 cursor-pointer active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-left"
    >
      <div className="p-0 flex flex-col sm:flex-row">
        {/* Left: Thumbnail */}
        {hasCookie && (
          <ResultCardThumb
            thumb={thumbData}
            resetKey={row.storycode}
            emptyLabel="No Image"
            className="w-full h-48 sm:w-[200px] sm:h-auto shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-700 relative flex items-center justify-center p-1 group/thumb overflow-hidden bg-zinc-50 dark:bg-zinc-800"
            imgClassName="max-w-full max-h-full object-contain opacity-90 group-hover/thumb:opacity-100 transition-all duration-500 group-hover/thumb:scale-110"
          />
        )}

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-5 flex-1 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                {row.hero_name && (
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5 block">
                    {cleanText(row.hero_name)}
                  </span>
                )}
                {/* Subseries membership: series_title is the subseries name
                    whenever subseries_code is present. The card's own click
                    handler ignores nested anchors, so this link wins. */}
                {row.subseries_code && row.series_title && (
                  <Link
                    to={routes.subseries(row.subseries_code)}
                    className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-blue-500 hover:underline mb-1 block truncate w-fit max-w-full"
                    title={cleanText(row.series_title)}
                  >
                    {cleanText(row.series_title)}
                  </Link>
                )}
                {(() => {
                  const translated = cleanText(row.translated_title);
                  const original = cleanText(row.original_title) || cleanText(row.story_title);
                  
                  let mainTitle = original;
                  let subTitle = null;

                  if (translated && translated !== 'Untitled' && translated.toLowerCase() !== 'sans titre') {
                    mainTitle = translated;
                    if (original && original !== 'Untitled' && original !== translated) {
                      subTitle = original;
                    }
                  } else if (!original || original === 'Untitled') {
                    mainTitle = t('story.no_title');
                  }

                  return (
                    <>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-1 truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" title={mainTitle}>
                        {mainTitle}
                      </h3>
                      {subTitle && (
                        <p className="text-xs text-muted-foreground font-medium mb-1.5 truncate" title={subTitle}>
                          {subTitle}
                        </p>
                      )}
                    </>
                  );
                })()}
                <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold tracking-wider">
                  {row.storycode}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.pagination')} :</span> {
                  row.entirepages > 0
                    ? row.entirepages
                    : (row.brokenpagenumerator && row.brokenpagedenominator)
                      ? `${row.brokenpagenumerator}/${row.brokenpagedenominator}`
                      : "?"
                } {t('story.pages')} · <KindBadge kind={row.kind} />
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.release_date')} :</span> {formatDate(row.firstpublicationdate)}
                {row.rowsperpage > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded text-[9px] font-bold uppercase tracking-tight">
                    {/* Number(): i18next skips plural resolution when `count`
                        is a string, so the raw key leaked into the UI. */}
                    {t('story.strips_per_page', { count: Number(row.rowsperpage) })}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.publications')} :</span>
                {publications.length > 0 ? (
                  <div className="inline-flex flex-wrap gap-2 ml-1">
                    {publications.slice(0, 3).map((p: any, i: number) => (
                      <FlagBadge key={i} country={p.country} name={`${p.name} ${p.issueNumber}`.trim()} />
                    ))}
                    {publications.length > 3 && (
                      <HoverTooltip
                        content={
                          <div className="flex flex-col gap-2">
                            <p className="font-bold text-xs text-zinc-700 dark:text-zinc-300 border-b pb-1 mb-1">
                              {t('story.other_publications')}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {publications.slice(3).map((p: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <FlagBadge country={p.country} name={`${p.name} ${p.issueNumber}`.trim()} />
                                </div>
                              ))}
                            </div>
                          </div>
                        }
                      >
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-help self-center ml-1">
                          +{publications.length - 3}
                        </span>
                      </HoverTooltip>
                    )}
                  </div>
                ) : (
                  <span className="ml-1 text-zinc-400 italic">{t('story.none')}</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 tracking-tighter mr-0.5">{t('story.script')} :</span>
                {writers.length > 0 ? writers.map((w: any, i: number) => (
                  <EntityBadge key={i} type="creator" code={w.code} name={w.name} />
                )) : <span className="text-zinc-400">?</span>}
              </div>
              <div className="text-[11px] flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 tracking-tighter mr-0.5">{t('story.art')} :</span>
                {/* Same badge size as the script line above and as the
                    characters below: one credit, one type size. */}
                {artists.length > 0 ? artists.map((a: any, i: number) => (
                  <EntityBadge key={i} type="creator" code={a.code} name={a.name} />
                )) : <span className="text-zinc-400">?</span>}
              </div>
            </div>

            {/* Characters section */}
            <div className="flex flex-row flex-wrap gap-2">
              {characters.slice(0, 15).map((c: any, i: number) => {
                const charImageUrl = c.url
                  ? `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/hr.php?normalsize=1&image=https://outducks.org/webusers/${c.url.startsWith('/') ? c.url.substring(1) : c.url}`)}`
                  : `/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${c.code}`)}`;

                return (
                  <EntityBadge
                    key={i}
                    type="character"
                    code={c.code}
                    name={c.name}
                    url={c.url}
                    appComment={c.appComment}
                    charComment={c.charComment}
                    onSelect={onSelectCharacter}
                  />
                );
              })}
              {characters.length > 15 && (
                <span className="text-[10px] text-zinc-400 font-medium pl-1 self-start">
                  +{characters.length - 15}
                </span>
              )}
            </div>
          </div>

          {/* Description Box */}
          {text && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-700 p-4 pt-3 flex flex-col gap-1">
              <div
                ref={textRef}
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  WebkitLineClamp: isExpanded ? 'unset' : 2,
                  maxHeight: isExpanded ? '500px' : '3em',
                  transition: 'max-height 0.35s cubic-bezier(0.22,1,0.36,1)',
                }}
                className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 italic"
              >
                {text}
              </div>
              {(isTruncated || isExpanded) && (
                <span
                  className="text-blue-500 font-bold text-[10px] cursor-pointer hover:underline self-end transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? t('story.read_less') : t('story.read_more')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
