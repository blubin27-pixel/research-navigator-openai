/**
 * Determine whether a user prompt asks for disallowed writing assistance.
 *
 * This simple classifier looks for keywords that typically indicate the user
 * is requesting an essay, paragraph, thesis, or other text that could be
 * submitted as part of an assignment.
 *
 * @param input The user's prompt
 * @returns True if the prompt is disallowed, otherwise false
 */
export function isDisallowed(input: string): boolean {
  const patterns = [
    /\bwrite (?:my )?(?:an?\s*)?(?:introduction|intro|conclusion|essay|paper|thesis|paragraph|outline|statement)\b/i,
    /\bdraft(?:ing)?\b/i,
    /\bcompose\b/i,
    /\bmake an? argument\b/i,
    /\bprovide an? overview\b/i,
  ];
  return patterns.some((re) => re.test(input));
}
