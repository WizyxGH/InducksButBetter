import * as React from "react"
import { hasInducksCookie, formatInducksDate } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { ResultCardThumb } from "@/components/ResultCard/ResultCardThumb"
import { thumbUrls } from "@/components/ResultCard/thumbUrl"
import { FlagBadge } from "@/components/FlagBadge"
import { navigate, isModifiedClick } from "@/lib/navigation";
import { Link } from "@/components/ui/link";
import { routes } from "@/lib/routes";

interface IssueResultCardProps {
  row: any
  onSelect?: (issuecode: string) => void
}

export function IssueResultCard({ row, onSelect }: IssueResultCardProps) {
  const { t, i18n } = useTranslation();

  const cleanText = (val: string) => {
    if (!val) return "";
    let clean = val.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) {
      return clean.substring(1, clean.length - 1).trim();
    }
    return clean.replace(/\[.*?\]/g, '').trim();
  };

  const formatDate = (dateStr: string) => {
    return formatInducksDate(dateStr, i18n.language);
  };

  const issueUrl = `https://inducks.org/issue.php?c=${row.issuecode}`;

  const thumbData = React.useMemo(() => thumbUrls(row.issue_thumb), [row.issue_thumb]);

  const targetHref = routes.issue(row.issuecode, row.publicationcode);

  const handleClick = (e: React.MouseEvent) => {
    // Modified clicks stay native so the anchor opens a new tab.
    if (isModifiedClick(e)) return;
    if (onSelect) {
      // Without this, <Link> would *also* push a history entry, so a single
      // click would create two — which is what made the back button skip.
      e.preventDefault();
      onSelect(row.issuecode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onSelect) {
        onSelect(row.issuecode);
      } else {
        navigate(targetHref);
      }
    }
  };

  const hasCookie = React.useMemo(() => hasInducksCookie(), []);

  return (
    <Link to={targetHref}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="group block overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 hover:bg-zinc-50/10 dark:hover:bg-zinc-800/10 transition-all duration-300 rounded-lg bg-white dark:bg-zinc-900 cursor-pointer active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="p-0 flex flex-row">
        {/* Left: Cover Thumbnail */}
        {hasCookie && (
          <ResultCardThumb
            thumb={thumbData}
            resetKey={row.issuecode}
            emptyLabel="No Cover"
            className="w-[140px] sm:w-[180px] shrink-0 border-r border-zinc-100 dark:border-zinc-700 relative flex items-center justify-center p-1 group/thumb overflow-hidden bg-zinc-50 dark:bg-zinc-800"
            imgClassName="max-w-full max-h-full object-contain opacity-90 group-hover/thumb:opacity-100 transition-all duration-500 group-hover/thumb:scale-105"
          />
        )}

        {/* Right: Content */}
        <div className="flex-1 flex flex-col min-w-0 p-5 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FlagBadge country={row.countrycode} name={row.countrycode.toUpperCase()} />
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold tracking-wider">
                {row.issuecode}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              {cleanText(row.series_title)} #{row.issuenumber}
            </h3>
            {row.issue_title && (
              <p className="text-xs text-muted-foreground italic truncate">
                {cleanText(row.issue_title)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 border-t border-zinc-50 dark:border-zinc-800 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {row.publishername && (
              <div className="col-span-1 sm:col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.publisher')} :</span> {row.publishername}
              </div>
            )}
            <div>
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.release_date')} :</span> {formatDate(row.oldestdate)}
            </div>
            {row.pages !== null && row.pages > 0 && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('story.pagination')} :</span> {row.pages} {t('story.pages')}
              </div>
            )}
            {row.price && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.price')} :</span> {row.price}
              </div>
            )}
            {row.size && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.dimensions')} :</span> {row.size}
              </div>
            )}
            {row.attached && (
              <div className="col-span-1 sm:col-span-2">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">{t('search.attached')} :</span> {row.attached}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
