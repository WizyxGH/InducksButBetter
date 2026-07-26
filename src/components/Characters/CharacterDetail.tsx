import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, Calendar, Star, BookOpen, Users, Cat, Globe, User } from "lucide-react";
import { executeQuery } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [character, setCharacter] = useState<CharacterDetailData | null>(null);
  const [names, setNames] = useState<CharName[]>([]);
  const [urls, setUrls] = useState<any[]>([]);
  const [creators, setCreators] = useState<CreatorStat[]>([]);
  const [coCharacters, setCoCharacters] = useState<CoCharacter[]>([]);
  const [firstAppearance, setFirstAppearance] = useState<any | null>(null);
  const [stories, setStories] = useState<any[]>([]);
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
            storiesResult,
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
            // 7. Fetch recent stories
            executeQuery({
              sql: `SELECT DISTINCT s.storycode, 
                            COALESCE(
                              NULLIF(NULLIF(s.title, 'Untitled'), ''),
                              (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode WHERE e.storyversioncode = (SELECT MIN(sv2.storyversioncode) FROM inducks_storyversion sv2 WHERE sv2.storycode = s.storycode) AND e.title IS NOT NULL AND e.title != '' AND e.title != 'Untitled' ORDER BY i.oldestdate ASC, e.entrycode ASC LIMIT 1)
                            ) as original_title, s.firstpublicationdate,
                            (SELECT COUNT(*) FROM inducks_appearance WHERE charactercode = ? AND storyversioncode = sv.storyversioncode) as appearances,
                            (SELECT e.title FROM inducks_entry e JOIN inducks_issue i ON e.issuecode = i.issuecode JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode WHERE e.storyversioncode = (SELECT MIN(sv2.storyversioncode) FROM inducks_storyversion sv2 WHERE sv2.storycode = s.storycode) AND e.title IS NOT NULL AND e.title != '' AND pub.languagecode = ? ORDER BY e.entrycode ASC LIMIT 1) as translated_title
                    FROM inducks_appearance a
                    JOIN inducks_storyversion sv ON a.storyversioncode = sv.storyversioncode
                    JOIN inducks_story s ON sv.storycode = s.storycode
                    WHERE a.charactercode = ?
                    ORDER BY s.firstpublicationdate DESC
                    LIMIT 30`,
              args: [charactercode, currentLang, charactercode],
            }),
            // 8. Fetch universes
            executeQuery({
              sql: `SELECT u.universecode, u.universename 
                    FROM inducks_ucrelation ucr
                    JOIN inducks_universe u ON ucr.universecode = u.universecode
                    WHERE ucr.charactercode = ?`,
              args: [charactercode],
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
          setStories(storiesResult.rows as any[]);
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
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>{t("characters.no_description") || "Aucun détail disponible pour ce personnage."}</p>
      </div>
    );
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
            <img
              src={`/api/proxy-image?url=${encodeURIComponent('https://inducks.org/characterthumb.php?c=' + character.charactercode)}`}
              alt={displayName}
              className="w-full h-full object-cover transition-opacity duration-300"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
              }}
            />
            <Cat className="w-10 h-10 text-muted-foreground/30 hidden fallback-icon absolute" />
          </div>
          <div className="space-y-3 min-w-0">
            <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h2>
              <div className="flex gap-1">
                {character.heroonly === "Y" && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black text-[10px] rounded-lg">{t("characters.hero_only") || "Héros principal"}</Badge>
                )}
                {character.official === "Y" && (
                  <Badge variant="secondary" className="text-[10px] rounded-lg">{t("characters.official") || "Officiel"}</Badge>
                )}
                {character.onetime === "Y" && (
                  <Badge variant="outline" className="text-[10px] rounded-lg">{t("characters.onetime") || "Unique"}</Badge>
                )}
              </div>
            </div>
            {character.charactername && character.charactername !== displayName && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{t("characters.original_name", { defaultValue: "Original" })}:</span> {character.charactername}
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
                {t("characters.universe") || "Univers"}:
              </span>
              {universes.map((univ, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] rounded-lg">
                  {univ.universename}
                </Badge>
              ))}
            </div>
          )}

          {firstAppearance && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>
                {t("characters.first_appearance") || "Première apparition"}:{" "}
                <span
                  onClick={() => {
                    if (onSelectStory) {
                      onSelectStory(firstAppearance.storycode);
                    } else {
                      window.location.hash = `#/entries/story/${encodeURIComponent(firstAppearance.storycode)}`;
                    }
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  {firstAppearance.title || t("story.no_title", { defaultValue: "Sans titre" })} ({firstAppearance.firstpublicationdate})
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
                  {t("characters.international_names", { defaultValue: "Noms internationaux" })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto text-xs">
                {names.map((n, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-border-subtle/30 last:border-b-0">
                    <span className="font-bold text-muted-foreground uppercase">{n.languagecode}</span>
                    <span className="font-semibold text-foreground">{n.charactername}</span>
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
                  {t("authors.links") || "Liens externes"}
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
                    {t("characters.creators") || "Créateurs principaux"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {creators.map((c) => (
                    <div key={c.personcode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           <img
                             src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${c.personcode.replace(/ /g, "_")}.jpg`)}`}
                             alt={c.fullname}
                             className="w-full h-full object-cover"
                             onError={(e) => {
                               e.currentTarget.style.display = 'none';
                               e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                             }}
                           />
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
                    {t("characters.co_characters") || "Compagnons fréquents"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {coCharacters.map((cc) => (
                    <div key={cc.cocharactercode} className="flex justify-between items-center p-2.5 rounded-xl bg-surface-2/20 border border-border-subtle text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-surface border border-border-subtle flex items-center justify-center relative group-avatar">
                           <img
                             src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/characterthumb.php?c=${cc.cocharactercode}`)}`}
                             alt={cc.cocharactername}
                             className="w-full h-full object-cover"
                             onError={(e) => {
                               e.currentTarget.style.display = 'none';
                               e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                             }}
                           />
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

          {/* Stories List */}
          {stories.length > 0 && (
            <Card className="border-border-subtle rounded-2xl">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  {t("characters.stories_featuring", { name: displayName }) || `Histoires avec ${displayName}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {stories.map((story) => (
                  <div
                    key={story.storycode}
                    onClick={() => {
                      if (onSelectStory) {
                        onSelectStory(story.storycode);
                      } else {
                        window.location.hash = `#/entries/story/${encodeURIComponent(story.storycode)}`;
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
                            mainTitle = t("story.no_title") || "Sans titre";
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
                      <p className="text-[10px] text-muted-foreground font-mono">{story.storycode}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{story.firstpublicationdate}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
