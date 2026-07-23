export interface CharactersSearchFilters {
  characterName: string;
  characterCode: string;
  heroOnly: boolean;
  oneTime: boolean;
  official: boolean;
  minAppearances: string;
  universes: string[];
  sort: string;
  page: number;
  rowsperpage: string;
}

export const buildCharactersSearchQuery = (searchFilters: CharactersSearchFilters) => {
  const where = ["1=1"];
  const params: any[] = [];

  if (searchFilters.characterName.trim()) {
    const likeVal = `%${searchFilters.characterName.trim()}%`;
    where.push(`(c.charactername LIKE ? OR EXISTS (
      SELECT 1 FROM inducks_characteralias ca 
      WHERE ca.charactercode = c.charactercode AND ca.charactername LIKE ?
    ) OR EXISTS (
      SELECT 1 FROM inducks_charactername cn 
      WHERE cn.charactercode = c.charactercode AND cn.charactername LIKE ?
    ))`);
    params.push(likeVal, likeVal, likeVal);
  }

  if (searchFilters.characterCode.trim()) {
    where.push("c.charactercode LIKE ?");
    params.push(`%${searchFilters.characterCode.trim()}%`);
  }

  if (searchFilters.heroOnly) {
    where.push("c.heroonly = 'Y'");
  }
  if (searchFilters.oneTime) {
    where.push("c.onetime = 'Y'");
  }
  if (searchFilters.official) {
    where.push("c.official = 'Y'");
  }

  if (searchFilters.minAppearances.trim()) {
    where.push(`(SELECT COUNT(*) FROM inducks_appearance WHERE charactercode = c.charactercode) >= ?`);
    params.push(parseInt(searchFilters.minAppearances.trim(), 10));
  }

  if (searchFilters.universes && searchFilters.universes.length > 0) {
    where.push(`EXISTS (SELECT 1 FROM inducks_ucrelation ucr WHERE ucr.charactercode = c.charactercode AND ucr.universecode IN (${searchFilters.universes.map(() => "?").join(",")}))`);
    params.push(...searchFilters.universes);
  }

  const whereClause = "WHERE " + where.join(" AND ");

  let orderBy = "appearances DESC, c.charactername ASC";
  if (searchFilters.sort === "appearances_asc") {
    orderBy = "appearances ASC, c.charactername ASC";
  } else if (searchFilters.sort === "name_asc") {
    orderBy = "c.charactername ASC";
  } else if (searchFilters.sort === "name_desc") {
    orderBy = "c.charactername DESC";
  }

  const limit = parseInt(searchFilters.rowsperpage, 10) || 24;
  const offset = ((searchFilters.page || 1) - 1) * limit;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM inducks_character c
    ${whereClause}
  `;

  const mainQuery = `
    SELECT c.charactercode, c.charactername, c.official, c.onetime, c.heroonly,
           (SELECT COUNT(*) FROM inducks_appearance WHERE charactercode = c.charactercode) as appearances,
           (SELECT cu.sitecode || '|' || cu.url 
            FROM inducks_characterurl cu 
            WHERE cu.charactercode = c.charactercode 
            ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as imageUrl
    FROM inducks_character c
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  return {
    query: mainQuery,
    countQuery,
    params: [...params, limit, offset],
    countParams: params,
  };
};
