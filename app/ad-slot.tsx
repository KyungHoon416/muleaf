import { useEffect, useRef } from "react";

type AdPlacement = "discover-side" | "track-detail" | "certificate-detail" | `${"discover" | "charts" | "library" | "dashboard" | "upload"}-footer`;
declare global {
 interface Window { adsbygoogle?: { push: (ad: Record<string, unknown>) => unknown }; }
}
/** Web-only AdSense unit. Test requests stay enabled until a separate live launch. */
export function AdSlot({placement,format="banner"}:{placement:AdPlacement;format?:"banner"|"rectangle"}) {
 const eligible = placement === "discover-side" || ["discover-footer", "charts-footer", "library-footer"].includes(placement);
 const ad = useRef<HTMLModElement>(null);
 const requested = useRef(false);
 useEffect(() => {
  const element = ad.current;
  if (!element || !document.querySelector('script[src*="adsbygoogle.js?client=ca-pub-4004046235562178"]')) return;
  const request = () => {
   if (requested.current || element.hasAttribute("data-adsbygoogle-status") || element.getBoundingClientRect().width <= 0) return;
   requested.current = true;
   try { (window.adsbygoogle ||= [] as Record<string, unknown>[]).push({}); } catch { /* Keep the surrounding music UI usable if ads are blocked. */ }
  };
  const observer = new ResizeObserver(request);
  observer.observe(element);
  request();
  return () => observer.disconnect();
 }, [eligible]);
 // Keep ad requests out of dialogs and unfinished account/upload screens.
 if (!eligible) return null;
 return <aside className={`ad-slot ad-${format}`} aria-label="광고" data-ad-placement={placement} style={{display:"block",padding:"36px 12px 12px"}}>
  <span className="ad-label">광고</span>
  <ins ref={ad} className="adsbygoogle" style={{display:"block",width:"100%"}}
   data-ad-client="ca-pub-4004046235562178" data-ad-slot="3400909051"
   data-ad-format="auto" data-full-width-responsive="true" data-adtest="on" />
 </aside>;
}
