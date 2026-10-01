type AdPlacement = "discover-side" | "track-detail" | "certificate-detail" | `${"discover" | "charts" | "library" | "dashboard" | "upload"}-footer`;
/** Reserved inventory only. Supply approved publisher/slot IDs before enabling live ads. */
export function AdSlot({placement,format="banner"}:{placement:AdPlacement;format?:"banner"|"rectangle"}) {
 return <aside className={`ad-slot ad-${format}`} aria-label="광고" data-ad-placement={placement}><span className="ad-label">광고</span></aside>;
}
