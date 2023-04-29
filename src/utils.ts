/**
 * Accepts an array of file system paths and returns a new array with all common directory prefixes removed.
 * e.g. Passing ["a/", "a/b", "b/c", "b/"] would return ["a/b", "b/c"]
 */
export function filterCommonPrefixes(strs: string[]) {
  return strs.filter(
    (a, i, arr) => a.at(-1) !== "/" || !arr.some((b, j) => i !== j && b.startsWith(a) && b.length > a.length)
  );
}
