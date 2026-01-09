export interface OpenAlexWork {
  id: string;
  title: string;
  doi?: string;
  authors: string[];
  publication_year: number;
  host_venue?: string;
  cited_by_count: number;
}

/**
 * Search OpenAlex for works related to the given query.
 * This function calls the OpenAlex API and returns a subset of fields.
 *
 * @param query A topic or search phrase
 * @param maxResults The maximum number of results to return
 */
export async function searchOpenAlex(
  query: string,
  maxResults: number = 10,
): Promise<OpenAlexWork[]> {
  // If running in a Node environment, fetch is available. The user must run the app with network access.
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(
    query,
  )}&per_page=${maxResults}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to retrieve data from OpenAlex');
  }
  const data = await res.json();
  return (data?.results ?? []).map((work: any) => ({
    id: work.id,
    title: work.title,
    doi: work.doi ?? undefined,
    authors: (work.authorships ?? []).map((a: any) =>
      a.author?.display_name ? a.author.display_name : 'Unknown Author',
    ),
    publication_year: work.publication_year ?? 0,
    host_venue: work.host_venue?.display_name ?? undefined,
    cited_by_count: work.cited_by_count ?? 0,
  }));
}
