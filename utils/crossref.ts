export interface CrossrefWork {
  doi: string;
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  url?: string;
  cited_by_count?: number;
}

/**
 * Search the Crossref API for works matching the given query.  This function
 * performs a simple bibliographic query and returns a list of works with
 * normalized metadata.  See https://api.crossref.org/ for details on parameters.
 *
 * @param query Search phrase
 * @param maxResults Number of results to return
 */
export async function searchCrossref(
  query: string,
  maxResults: number = 10,
): Promise<CrossrefWork[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(
    query,
  )}&rows=${maxResults}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch Crossref results');
  }
  const data = await res.json();
  const items = data?.message?.items ?? [];
  return items.map((item: any) => {
    const title = Array.isArray(item.title) ? item.title[0] : item.title ?? '';
    const authors = (item.author ?? []).map((a: any) => {
      const given = a.given ?? '';
      const family = a.family ?? '';
      return `${given}${given && family ? ' ' : ''}${family}`.trim();
    });
    // Determine year from created/issued fields
    let year = 0;
    if (item.created?.['date-parts']?.[0]?.[0]) {
      year = item.created['date-parts'][0][0];
    } else if (item.issued?.['date-parts']?.[0]?.[0]) {
      year = item.issued['date-parts'][0][0];
    }
    const venue = Array.isArray(item['container-title'])
      ? item['container-title'][0]
      : item['container-title'];
    return {
      doi: item.DOI,
      title,
      authors,
      year,
      venue,
      url: item.URL,
      cited_by_count: item['is-referenced-by-count'],
    } as CrossrefWork;
  });
}
