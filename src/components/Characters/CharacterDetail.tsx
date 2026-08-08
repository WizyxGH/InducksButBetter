import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, Calendar, Star, Users, Cat, Globe, User } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { navigate } from "@/lib/navigation";
import { DetailNotFound } from "@/components/Layout/DetailPage";
import { routes } from "@/lib/routes";
import { hasInducksCookie } from "@/lib/utils";
import { useMetadata } from "@/hooks/useMetadata";

interface CharacterDetailData {
  charactercode: string;
  charactername: string;
  official?: string;
  onetime?: string;
  heroonly?: string;
  charactercomment?: string;
}

interface CharName {
  languagecode: string;
  charactername: string;
  preferred: string;
}

interface CreatorStat {
  personcode: string;
  fullname: string;
  total: number;
  yearrange: string;
}

interface CoCharacter {
  cocharactercode: string;
  cocharactername: string;
  total: number;
  yearrange: string;
}

interface CharacterDetailProps {
  charactercode: string;
  onSelectStory?: (code: string) => void;
}

export default function CharacterDetail({ charactercode, onSelectStory }: CharacterDetailProps) {
  const { t, i18n } = useTranslation();
  const { meta } = useMetadata();
  const hasCookie = hasInducksCookie();
  const [character, setCharacter] = useState<CharacterDetailData | null>(null);
  const [names, setNames] = useState<CharName[]>([]);
  const [urls, setUrls] = useState<any[]>([]);
  const [creators, setCreators] = useState<CreatorStat[]>([]);
  const [coCharacters, setCoCharacters] = useState<CoCharacter[]>([]);
  const [firstAppearance, setFirstAppearance] = useState<any | null>(null);
  const [universes, setUniverses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const currentLang = i18n.language || "fr";
      try {
        // 1. Fetch character general info first
        const charResult = await executeQuery({
          sql: `SELECT charactercode, charactername, official, onetime, heroonly, charactercomment 
                FROM inducks_character WHERE charactercode = ?`,
          args: [charactercode],
        });

        if (charResult.rows.length > 0) {
          setCharacter(charResult.rows[0] as CharacterDetailData);

          // Execute remaining queries in parallel to speed up load time significantly
          const [
            namesResult,
            urlsResult,
            creatorsResult,
            coCharResult,
            firstAppResult,
            univResult
          ] = await Promise.all([
            // 2. Fetch all translated names
            executeQuery({
              sql: `SELECT languagecode, charactername, preferred 
                    FROM inducks_charactername 
                    WHERE charactercode = ? AND charactername != ''
                    ORDER BY preferred DESC, languagecode ASC`,
              args: [charactercode],
            }),
            // 3. Fetch links
            executeQuery({
              sql: `SELECT sitecode, url FROM inducks_characterurl WHERE charactercode = ?`,
              args: [charactercode],
            }),
            // 4. Fetch main creators
            executeQuery({
              sql: `SELECT sc.personcode, sc.total, sc.yearrange, p.fullname
                    FROM inducks_statpersoncharacter sc
                    JOIN inducks_person p ON sc.personcode = p.personcode
                    WHERE sc.charactercode = ?
                    ORDER BY CAST(sc.total AS INTEGER) DESC
                    LIMIT 5`,
              args: [charactercode],
            }),
            // 5. Fetch co-appearing characters
            executeQuery({
              sql: `SELECT scc.cocharactercode, scc.total, scc.yearrange, COALESCE(cn.charactername, c.charactername) as cocharactername
                    FROM inducks_statcharactercharacter scc
                    JOIN inducks_character c ON scc.cocharactercode = c.charactercode
                    LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
                    WHERE scc.charactercode = ?
                    GROUP BY scc.cocharactercode
                    ORDER BY CAST(scc.total AS INTEGER) DESC
                    LIMIT 5`,
              args: [currentLang, charactercode],
            }),
            // 6. Fetch first appearance story
            executeQuery({
              sql: `SELECT s.storycode, s.title, s.firstpublicationdate
                    FROM inducks_appearance a
                    JOIN inducks_storyversion sv ON a.storyversioncode = sv.storyversioncode
                    JOIN inducks_story s ON sv.storycode = s.storycode
                    WHERE a.charactercode = ? AND s.firstpublicationdate != ''
                    ORDER BY s.firstpublicationdate ASC
                    LIMIT 1`,
              args: [charactercode],
            }),
            // 7. Fetch universes
            executeQuery({
              // inducks_universe has no `universename`: the localized names
              // live in inducks_universename, with universecomment as the
              // only fallback label.
              // Restricted to the UI language then English: without the
              // filter, a universe translated into neither would surface an
              // arbitrary language (a Danish name on the French site).
              sql: `SELECT u.universecode,
                      COALESCE(
                        (SELECT un.universename FROM inducks_universename un
                         WHERE un.universecode = u.universecode
                           AND un.languagecode IN (?, 'en')
                         ORDER BY CASE WHEN un.languagecode = ? THEN 0 ELSE 1 END
                         LIMIT 1),
                        NULLIF(u.universecomment, ''),
                        u.universecode
                      ) as universename
                    FROM inducks_ucrelation ucr
                    JOIN inducks_universe u ON ucr.universecode = u.universecode
                    WHERE ucr.charactercode = ?`,
              args: [i18n.language, i18n.language, charactercode],
            })
          ]);

          setNames(namesResult.rows as CharName[]);
          setUrls(urlsResult.rows);
          setCreators(creatorsResult.rows as CreatorStat[]);
          setCoCharacters(coCharResult.rows as CoCharacter[]);
          if (firstAppResult.rows.length > 0) {
            setFirstAppearance(firstAppResult.rows[0]);
          } else {
            setFirstAppearance(null);
          }
          setUniverses(univResult.rows as any[]);
        }
      } catch (error) {
        console.error("Error fetching character details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [charactercode, i18n.language]);

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 lg:p-8 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-[120px] h-[120px] rounded-2xl bg-surface-2 shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="h-7 bg-surface-2 rounded-lg w-1/3" />
            <div className="h-4 bg-surface-2 rounded-lg w-1/4" />
            <div className="h-4 bg-surface-2 rounded-lg w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-6 bg-surface-2 rounded-lg w-1/4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface-2 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-6 bg-surface-2 rounded-lg w-1/2" />
            <div className="h-32 bg-surface-2 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!character) {
    return <DetailNotFound message={t("characters.no_description")} />;
  }

  // Get current language name or English name
  const currentLangCode = i18n.language || "fr";
  const localizedNameObj = names.find((n) => n.languagecode === currentLangCode) || names.find((n) => n.languagecode === "en");
  const displayName = localizedNameObj ? localizedNameObj.charactername : character.charactername;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between bg-surface-2/30 border border-border-subtle p-6 rounded-3xl">
        <div className="flex gap-6 items-start min-w-0">
          <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 bg-surface border border-border-subtle rounded-full overflow-hidden shadow-sm flex items-center justify-center relative group">
            {hasCookie ? (
              <img
                src={`/api/proxy-image?url=${encodeURIComponent('https://inducks.org/characterthumb.php?c=' + character.charactercode)}`}
                alt={displayName}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Cat className="w-10 h-10 text-muted-foreground/30 hidden fallback-icon absolute" />
          </div>
          <div className="space-y-3 min-w-0">
            <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h2>
              <div className="flex gap-1">
                {character.heroonly === "Y" && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black text-[10px] rounded-lg">{t("characters.hero_only")}</Badge>
                )}
                {character.official === "Y" && (
                  <Badge variant="secondary" className="text-[10px] rounded-lg">{t("characters.official")}</Badge>
                )}
                {character.onetime === "Y" && (
                  <Badge variant="outline" className="text-[10px] rounded-lg">{t("characters.onetime")}</Badge>
                )}
              </div>
            </div>
            {character.charactername && character.charactername !== displayName && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{t("characters.original_name")}:</span> {character.charactername}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground font-mono">{character.charactercode}</p>
          </div>

          {character.charactercomment && (
            <p className="text-xs text-text-secondary italic max-w-2xl leading-relaxed">
              "{character.charactercomment}"
            </p>
          )}

          {universes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                {t("characters.universe")}:
              </span>
              {universes.map((univ, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  onClick={() => navigate(routes.universe(univ.universecode))}
                  className="text-[10px] rounded-lg cursor-pointer hover:border-primary/50 hover:text-primary transition-colors"
                  title={univ.universecode}
                >
                  {univ.universename}
                </Badge>
              ))}
            </div>
          )}

          {firstAppearance && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>
                {t("characters.first_appearance")}:{" "}
                <span
                  onClick={() => {
                    if (onSelectStory) {
                      onSelectStory(firstAppearance.storycode);
                    } else {
                      navigate(routes.story(firstAppearance.storycode));
                    }
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  {firstAppearance.title || t("story.no_title")} ({firstAppearance.firstpublicationdate})
                </span>
              </span>
            </div>
          )}
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: International names & Links */}
        <div className="lg:col-span-1 space-y-6">
          {/* International Names */}
          {names.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  {t("characters.international_names")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto text-xs">
                {names.map((n, idx) => (
                  <div key={idx} className="flex justify-between items-baseline gap-3 py-1 border-b border-border-subtle/30 last:border-b-0">
                    {/* Readable language name rather than the raw code: "fr"
                        tells a visitor much less than "Français". */}
                    <span className="font-bold text-muted-foreground capitalize shrink-0">
                      {meta.languages.find((l) => l.languagecode === n.languagecode)?.languagename ||
                        n.languagecode.toUpperCase()}
                    </span>
                    <span className="font-semibold text-foreground text-right" title={n.charactername}>
                      {n.charactername}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Links */}
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

        {/* Middle/Right columns: Main creators, Companions & Stories */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Creators */}
            {creators.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    {t("characters.creators")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {creators.map((c) => (
                    <div key={c.personcode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           {hasCookie ? (
                             <img
                               src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${c.personcode.replace(/ /g, "_")}.jpg`)}`}
                               alt={c.fullname}
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
                          <p className="font-semibold text-foreground truncate">{c.fullname}</p>
                          <p className="text-[10px] text-muted-foreground">{c.yearrange}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {c.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Frequent companions */}
            {coCharacters.length > 0 && (
              <Card className="border-border-subtle rounded-2xl">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {t("characters.co_characters")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coCharacters.map((cc) => (
                    <div key={cc.cocharactercode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           {hasCookie ? (
                             <img
                               src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${cc.cocharactercode}`)}`}
                               alt={cc.cocharactername}
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
                          <p className="font-semibold text-foreground truncate">{cc.cocharactername}</p>
                          <p className="text-[10px] text-muted-foreground">{cc.yearrange}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-bold text-[10px]">
                        {cc.total}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
