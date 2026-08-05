import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Calendar, MapPin, Award, BookOpen, Users, User, Cat, Globe, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { getFlagUrl, hasInducksCookie, formatInducksDate } from "@/lib/utils";
import { parseCredits } from "@/lib/credits";
import { isModifiedClick } from "@/lib/navigation";
import { Link } from "@/components/ui/link";
import { routes } from "@/lib/routes";

interface AuthorDetailData {
  personcode: string;
  fullname: string;
  nationalitycountrycode?: string;
  numberofindexedissues?: number;
  birthname?: string;
  borndate?: string;
  bornplace?: string;
  deceaseddate?: string;
  deceasedplace?: string;
  education?: string;
  comicstext?: string;
  othertext?: string;
}

interface CoAuthor {
  copersoncode: string;
  fullname: string;
  total: number;
  yearrange: string;
}

interface FavCharacter {
  charactercode: string;
  charactername: string;
  total: number;
  yearrange: string;
}

interface AuthorDetailProps {
  personcode: string;
  onSelectStory?: (code: string) => void;
}

/** How many credited stories are shown per "load more" step. */
const STORIES_PER_PAGE = 20;

/**
 * One page of the stories an author is credited on.
 * Bound arguments: language, personcode, limit, offset.
 */
const STORIES_PAGE_SQL = `
  SELECT s.storycode,
         s.firstpublicationdate,
         COALESCE(NULLIF(s.title, ''), sh.title) as original_title,
         (SELECT e.title
          FROM inducks_entry e
          JOIN inducks_issue i ON e.issuecode = i.issuecode
          JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode
          WHERE e.storyversioncode = sv.storyversioncode
            AND pub.languagecode = ?
            AND e.title IS NOT NULL AND e.title != ''
          LIMIT 1) as translated_title,
         -- Credits of the same version the row is built from. A ';' separator
         -- only survives without DISTINCT: SQLite ignores the separator
         -- argument of GROUP_CONCAT(DISTINCT ...) and always uses ','.
         (SELECT GROUP_CONCAT(sj_c.plotwritartink || ':' || p_c.personcode || '|' || p_c.fullname, ';')
          FROM inducks_storyjob sj_c
          JOIN inducks_person p_c ON sj_c.personcode = p_c.personcode
          WHERE sj_c.storyversioncode = sv.storyversioncode) as creators
  FROM inducks_storyjob sj
  JOIN inducks_storyversion sv ON sj.storyversioncode = sv.storyversioncode
  JOIN inducks_story s ON sv.storycode = s.storycode
  LEFT JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
  -- Only work this person actually did. Inducks flags with indirect = 'Y' the
  -- items merely derived from someone's art (a cover assembled from a Barks
  -- panel), and role 'r' is a reference credit rather than authorship.
  -- Counting those inflated Carl Barks from 2012 stories to 4521.
  WHERE sj.personcode = ?
    AND sj.indirect = 'N'
    AND sj.plotwritartink IN ('p', 'w', 'a', 'i')
  GROUP BY s.storycode
  ORDER BY s.firstpublicationdate DESC, s.storycode ASC
  LIMIT ? OFFSET ?
`;

/** Script / art credits of one story in the author's bibliography. */
function StoryCredits({ creators }: { creators?: string | null }) {
  const { t } = useTranslation();
  const { writers, artists } = React.useMemo(() => parseCredits(creators), [creators]);

  if (writers.length === 0 && artists.length === 0) return null;

  const line = (label: string, people: { code: string; name: string }[]) =>
    people.length > 0 && (
      <p className="truncate">
        <span className="font-semibold text-text-secondary">{label} :</span>{" "}
        <span className="text-muted-foreground">{people.map((p) => p.name).join(", ")}</span>
      </p>
    );

  return (
    <div className="text-[10px] leading-snug space-y-0.5 pt-0.5">
      {line(t("story.script"), writers)}
      {line(t("story.art"), artists)}
    </div>
  );
}

export default function AuthorDetail({ personcode, onSelectStory }: AuthorDetailProps) {
  const { t, i18n } = useTranslation();
  const hasCookie = hasInducksCookie();
  const [author, setAuthor] = useState<AuthorDetailData | null>(null);
  const [aliases, setAliases] = useState<any[]>([]);
  const [urls, setUrls] = useState<any[]>([]);
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [favCharacters, setFavCharacters] = useState<FavCharacter[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [totalStoriesCount, setTotalStoriesCount] = useState(0);
  const [storiesPage, setStoriesPage] = useState(1);
  const [loadingMoreStories, setLoadingMoreStories] = useState(false);
  const [isStoriesExpanded, setIsStoriesExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const currentLang = i18n.language || "fr";
      try {
        const authorResult = await executeQuery({
          sql: `SELECT p.personcode, p.fullname, p.nationalitycountrycode,
                       p.birthname, p.borndate, p.bornplace, p.deceaseddate, p.deceasedplace,
                       p.education, p.comicstext, p.othertext
                FROM inducks_person p
                WHERE p.personcode = ?`,
          args: [personcode],
        });

        if (cancelled) return;
        if (authorResult.rows.length === 0) {
          setAuthor(null);
          return;
        }
        setAuthor(authorResult.rows[0] as AuthorDetailData);

        // The remaining sections are independent of each other: running them
        // concurrently turns six sequential round-trips into one wait.
        const [aliasesResult, urlsResult, coAuthorsResult, favCharResult, countResult, storiesResult] =
          await Promise.all([
            executeQuery({
              sql: `SELECT surname, givenname, official FROM inducks_personalias WHERE personcode = ?`,
              args: [personcode],
            }),
            executeQuery({
              sql: `SELECT sitecode, url FROM inducks_personurl WHERE personcode = ?`,
              args: [personcode],
            }),
            executeQuery({
              sql: `SELECT sp.copersoncode, sp.total, sp.yearrange, p.fullname
                    FROM inducks_statpersonperson sp
                    JOIN inducks_person p ON sp.copersoncode = p.personcode
                    WHERE sp.personcode = ?
                    ORDER BY CAST(sp.total AS INTEGER) DESC
                    LIMIT 5`,
              args: [personcode],
            }),
            executeQuery({
              sql: `SELECT sc.charactercode, sc.total, sc.yearrange, COALESCE(cn.charactername, c.charactername) as charactername
                    FROM inducks_statpersoncharacter sc
                    JOIN inducks_character c ON sc.charactercode = c.charactercode
                    LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
                    WHERE sc.personcode = ?
                    GROUP BY sc.charactercode
                    ORDER BY CAST(sc.total AS INTEGER) DESC
                    LIMIT 5`,
              args: [currentLang, personcode],
            }),
            // Counted from the actual credits rather than
            // `inducks_person.numberofindexedissues`, which is unset for many
            // creators and reported 0 for authors with hundreds of stories.
            executeQuery({
              sql: `SELECT COUNT(DISTINCT sv.storycode) as total
                    FROM inducks_storyjob sj
                    JOIN inducks_storyversion sv ON sj.storyversioncode = sv.storyversioncode
                    WHERE sj.personcode = ?
                      AND sj.indirect = 'N'
                      AND sj.plotwritartink IN ('p', 'w', 'a', 'i')`,
              args: [personcode],
            }),
            executeQuery({ sql: STORIES_PAGE_SQL, args: [currentLang, personcode, STORIES_PER_PAGE, 0] }),
          ]);

        if (cancelled) return;

        setAliases(aliasesResult.rows);
        setUrls(urlsResult.rows);
        setCoAuthors(coAuthorsResult.rows as CoAuthor[]);
        setFavCharacters(favCharResult.rows as FavCharacter[]);
        setTotalStoriesCount(Number(countResult.rows[0]?.total || 0));
        setStories(storiesResult.rows as any[]);
        setStoriesPage(1);
      } catch (error) {
        console.error("Error fetching author details:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [personcode, i18n.language]);

  const loadMoreStories = async () => {
    if (loadingMoreStories) return;
    setLoadingMoreStories(true);
    const nextPage = storiesPage + 1;
    try {
      const result = await executeQuery({
        sql: STORIES_PAGE_SQL,
        args: [i18n.language || "fr", personcode, STORIES_PER_PAGE, (nextPage - 1) * STORIES_PER_PAGE],
      });
      setStories((prev) => [...prev, ...result.rows]);
      setStoriesPage(nextPage);
    } catch (e) {
      console.error("Error loading more stories:", e);
    } finally {
      setLoadingMoreStories(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!author) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("authors.no_description")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between bg-surface-2/30 border border-border-subtle p-6 rounded-3xl">
        <div className="flex gap-6 items-start min-w-0">
          <div className="w-24 h-32 shrink-0 bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex items-center justify-center relative group">
            {hasCookie ? (
              <img
                src={`/api/proxy-image?url=${encodeURIComponent('https://inducks.org/b/creator/' + author.personcode + '.jpg')}`}
                alt={author.fullname}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                }}
              />
            ) : null}
            <User className="w-10 h-10 text-muted-foreground/30 hidden fallback-icon absolute" />
          </div>
          
          <div className="space-y-3 min-w-0">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{author.fullname}</h2>
              {author.birthname && author.birthname !== author.fullname && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">{t("authors.birth_name")}:</span> {author.birthname}
                </p>
              )}
              <div className="flex items-center gap-2">
                {author.nationalitycountrycode && (
                  <img
                    src={getFlagUrl(author.nationalitycountrycode as string)}
                    className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                    alt=""
                  />
                )}
                <p className="text-[10px] text-muted-foreground font-mono">{author.personcode}</p>
              </div>
            </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            {author.borndate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {t("authors.born")} {author.borndate}
                  {author.bornplace && ` ${t("authors.place_in")} ${author.bornplace}`}
                </span>
              </div>
            )}
            {author.deceaseddate && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  {t("authors.deceased")} {author.deceaseddate}
                  {author.deceasedplace && ` ${t("authors.place_in")} ${author.deceasedplace}`}
                </span>
              </div>
            )}
          </div>

          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                {t("authors.aliases")}:
              </span>
              {aliases
                .map((alias) => ({
                  ...alias,
                  displayName: `${alias.givenname || ""} ${alias.surname || ""}`.trim()
                }))
                .filter((alias) => alias.displayName.length > 0)
                .map((alias, idx) => (
                  <Badge key={idx} variant={alias.official === "Y" ? "default" : "outline"} className="text-[10px] rounded-lg">
                    {alias.displayName}
                  </Badge>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start md:items-end shrink-0 text-left md:text-right space-y-1 bg-surface/85 p-4 rounded-2xl border border-border-subtle shadow-sm w-full md:w-auto">
          <p className="text-xs font-semibold text-muted-foreground">{t("authors.number_of_stories")}</p>
          <p className="text-[30px] font-extrabold text-primary">{totalStoriesCount}</p>
          {author.nationalitycountrycode && (
            <Badge variant="secondary" className="mt-2 text-xs font-medium rounded-lg">
              {author.nationalitycountrycode.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Bio & URLs */}
        <div className="lg:col-span-1 space-y-6">
          {/* Biography Text if present */}
          {(author.comicstext || author.othertext || author.education) && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  {t("authors.biography")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-relaxed text-text-secondary">
                {author.education && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">{t("authors.education")}:</span>
                    <p>{author.education}</p>
                  </div>
                )}
                {author.comicstext && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">{t("authors.comics")}:</span>
                    <p>{author.comicstext}</p>
                  </div>
                )}
                {author.othertext && (
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">{t("authors.other")}:</span>
                    <p>{author.othertext}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Links / URLs */}
          {urls.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("authors.links")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {urls.map((u, idx) => (
                  <a
                    key={idx}
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border-subtle bg-surface-2/30 hover:bg-surface-2 text-xs font-medium text-text-secondary hover:text-foreground transition-all group"
                  >
                    <span className="truncate max-w-[150px]">{u.sitecode}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle/Right columns: Co-authors, favorite characters & stories */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Co-Authors */}
            {coAuthors.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {t("authors.coauthors")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coAuthors.map((coa) => (
                    <div key={coa.copersoncode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           {hasCookie ? (
                             <img
                               src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${coa.copersoncode.replace(/ /g, "_")}.jpg`)}`}
                               alt={coa.fullname}
                               className="w-full h-full object-cover"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                                 e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                               }}
                             />
                           ) : null}
                           <User className="w-4 h-4 text-muted-foreground/30 hidden fallback-icon absolute" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{coa.fullname}</p>
                          <p className="text-[10px] text-muted-foreground">{coa.yearrange}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {coa.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Favorite Characters */}
            {favCharacters.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Cat className="w-4 h-4 text-primary" />
                    {t("authors.favorite_characters")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {favCharacters.map((char) => (
                    <div key={char.charactercode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           {hasCookie ? (
                             <img
                               src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${char.charactercode}`)}`}
                               alt={char.charactername}
                               className="w-full h-full object-cover"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                                 e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                               }}
                             />
                           ) : null}
                           <Cat className="w-4 h-4 text-muted-foreground/30 hidden fallback-icon absolute" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{char.charactername}</p>
                          <p className="text-[10px] text-muted-foreground">{char.yearrange}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {char.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stories List */}
          {stories.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <button
                onClick={() => setIsStoriesExpanded(!isStoriesExpanded)}
                className="w-full flex items-center justify-between py-4 px-6 text-left border-none focus-visible:outline-none"
              >
                <div className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("authors.stories")}
                  <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1 bg-primary/10 text-primary border-none">
                    {totalStoriesCount}
                  </Badge>
                </div>
                {isStoriesExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                )}
              </button>
              
              {isStoriesExpanded && (
                <CardContent className="space-y-2.5 px-6 pb-6 pt-0 animate-fadeIn">
                  {stories.map((story) => (
                    <Link
                      key={story.storycode}
                      to={routes.story(story.storycode)}
                      onClick={(e) => {
                        // Keep ctrl/cmd/middle-click native so the story opens
                        // in a new tab; otherwise handle it in-app and stop
                        // <Link> from pushing a second history entry.
                        if (isModifiedClick(e)) return;
                        if (onSelectStory) {
                          e.preventDefault();
                          onSelectStory(story.storycode);
                        }
                      }}
                      className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle hover:bg-surface-2 hover:border-primary/20 cursor-pointer transition-all flex justify-between items-center gap-4 group"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                          {(() => {
                            const translated = story.translated_title;
                            const original = story.original_title || story.story_title;
                            let mainTitle = original;
                            let subTitle = null;

                            if (translated && translated !== 'Untitled' && translated.toLowerCase() !== 'sans titre') {
                              mainTitle = translated;
                              if (original && original !== 'Untitled' && original !== translated) {
                                subTitle = original;
                              }
                            } else if (!original || original === 'Untitled') {
                              mainTitle = t("story.no_title");
                            }

                            return (
                              <div className="truncate flex flex-col min-w-0">
                                <span className="truncate" title={mainTitle}>{mainTitle}</span>
                                {subTitle && (
                                  <span className="text-[10px] text-muted-foreground font-medium truncate font-normal" title={subTitle}>
                                    {subTitle}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <StoryCredits creators={story.creators} />

                        <p className="text-[10px] text-muted-foreground font-mono">
                          {story.storycode}
                          {story.firstpublicationdate && (
                            <span className="ml-2 font-sans not-italic">
                              {formatInducksDate(story.firstpublicationdate, i18n.language)}
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {stories.length < totalStoriesCount && (
                    <div className="pt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreStories}
                        disabled={loadingMoreStories}
                        className="rounded-xl px-6"
                      >
                        {loadingMoreStories ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t("common.loading")}
                          </>
                        ) : (
                          t("authors.load_more")
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
