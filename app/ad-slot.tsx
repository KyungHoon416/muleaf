type AdPlacement = "discover-side" | "track-detail" | "certificate-detail" | `${"discover" | "charts" | "library" | "dashboard" | "upload"}-footer`;

// Layout preview only. Keep the existing AdSense unit (3400909051) in the
// account, but do not request Google ads while publisher content is under review.
export function AdSlot({placement,format="banner"}:{placement:AdPlacement;format?:"banner"|"rectangle"}) {
 if (placement !== "discover-side") return null;
 return <aside className={`ad-slot ad-${format} ad-demo`} aria-label="테스트 광고 미리보기" data-ad-placement={placement}>
  <span className="ad-label">테스트 광고 · 실제 광고 아님</span>
  <div className="ad-demo-content">
   <span className="ad-demo-brand" aria-hidden="true">muleaf</span>
   <div><strong>당신의 다음 소리를 만나세요.</strong><p>마음에 드는 음악을 듣고 나만의 보관함에 담아보세요.</p><small>화면 배치를 확인하는 자체 샘플입니다. 광고 노출·클릭은 집계되지 않습니다.</small></div>
  </div>
 </aside>;
}
