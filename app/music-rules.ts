export function mergeHashtags(existing: string[], input: string): { tags: string[]; error: string; duplicates: boolean } {
  const tokens = input.normalize("NFKC").split(/[\s,#＃]+/u).map(t => t.trim()).filter(Boolean);
  const tags: string[] = [];
  const seen = new Set<string>();
  let duplicates = false;
  for (const tag of [...existing, ...tokens]) {
    const key = tag.normalize("NFKC").toLocaleLowerCase("ko-KR");
    if (seen.has(key)) { duplicates = true; continue; }
    seen.add(key); tags.push(tag);
  }
  if (tags.length > 5) return { tags: existing, error: "해시태그는 최대 5개까지 등록할 수 있어요.", duplicates };
  return { tags, error: "", duplicates };
}
