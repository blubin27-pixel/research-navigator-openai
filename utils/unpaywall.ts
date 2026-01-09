export interface UnpaywallWork {
  doi: string;
  title: string;
  authors: string[];
  year: number;
  venue?: string;
  url?: string;
}

/**
 * Query the Unpaywall API for open-access works matching a given topic.
 *
 * This function uses the Unpaywall search endpoint to find open access
 * articles related to the query.  The caller must provide an email address
 * via the `email` parameter as required by the Unpaywall API.  Only a
 * subset of fields are returned and normalized to match our source schema.
 *
 * @param query Search phrase
 * @param email Contact email required by Unpaywall
 * @param maxResults Number of results to return
 */
export async function searchUnpaywall(
  query: string,
  email: string,
  maxResults: number = 10,
): Promise<UnpaywallWork[]> {
  // Build search URL.  Unpaywall returns up to 50 results per page; we'll
  // request the first page and then slice the array to the requested count.
  const url = `https://api.unpaywall.org/v2/search?query=${encodeURIComponent(
    query,
  )}&is_oa=true&email=${encodeURIComponent(email)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch Unpaywall results');
  }
  const data = await res.json();
  const results = data?.results ?? [];
  return results.slice(0, maxResults).map((item: any) => {
    const resp = item.response ?? item;
    const doi = resp.doi ?? resp.DOI ?? '';
    const title = resp.title ?? '';
    const authors = (resp.authors ?? []).map((a: any) => a.name ?? '');
    let year: number = 0;
    if (resp.year) {
      year = parseInt(resp.year.toString(), 10);
    } else if (resp.published_date) {
      const match = resp.published_date.match(/^(\d{4})/);
      if (match) {
        year = parseInt(match[1], 10);
      }
    }
    const venue = resp.journal_name ?? resp.publisher;
    const urlItem = resp.best_oa_location?.url_for_pdf ?? resp.best_oa_location?.url;
    return {
      doi,
      title,
      authors,
      year,
      venue,
      url: urlItem,
    } as UnpaywallWork;
  });
}
