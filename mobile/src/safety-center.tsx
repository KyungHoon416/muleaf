import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { config, policySections, communityRules, operatorConfigured } from "./policy-content";
import { LegalDocument, legalTitles } from "../../app/legal/document";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockedArtists: string[];
  onUnblock: (artist: string) => void;
  onClearData: () => void;
};

export function SafetyCenter({ open, onOpenChange, blockedArtists, onUnblock, onClearData }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  return <Dialog open={open} onOpenChange={next => { setConfirmDelete(false); setError(""); onOpenChange(next); }}>
    <DialogContent className="sori-dialog safety-center">
      <DialogHeader><DialogTitle>개인정보 및 안전</DialogTitle><DialogDescription>저장 데이터, 차단 목록, 고객지원 정보를 관리하세요.</DialogDescription></DialogHeader>
      <section aria-labelledby="privacy-title">
        <h2 id="privacy-title">개인정보 처리 안내</h2>
        <p className="safety-notice">{operatorConfigured ? "개인정보 보호책임자: 권혁준 대표이사. 공고일·시행일: 2026년 10월 17일. 실제 서버 설정을 반영했으며 계약·국외이전·문의 보유기간 등 확인이 필요한 항목은 초안에 표시했습니다." : "개발 버전 안내입니다. 운영자·연락처·보관 기간이 확정되기 전에는 정식 개인정보 처리방침으로 사용할 수 없습니다."}</p>
        {policySections.map(section => <details key={section.title}><summary>{section.title}</summary><p>{section.text}</p></details>)}
        <details><summary>개인정보처리방침 전문 (초안)</summary><LegalDocument index={1}/></details>
        {config.privacyUrl && <a href={config.privacyUrl} target="_blank" rel="noopener noreferrer">전체 개인정보 처리방침</a>}
      </section>
      <section><h2>이용약관 및 선택 동의 안내</h2>
        {[0, 2, 3].map(index => <details key={index}><summary>{legalTitles[index]} (초안)</summary><LegalDocument index={index}/></details>)}
      </section>
      <section><h2>커뮤니티 이용 규칙</h2><ul>{communityRules.map(rule => <li key={rule}>{rule}</li>)}</ul></section>
      <section><h2>차단한 아티스트</h2><p>차단은 이 기기에 적용됩니다. 차단한 아티스트의 음악은 재생되지 않습니다.</p>
        {blockedArtists.length ? <ul className="blocked-artists">{blockedArtists.map(artist => <li key={artist}><span>{artist}</span><button className="btn outline" onClick={() => onUnblock(artist)} aria-label={`${artist} 차단 해제`}>차단 해제</button></li>)}</ul> : <p>차단한 아티스트가 없습니다.</p>}
      </section>
      <section><h2>저장 데이터 삭제</h2><p>이 기기의 찜·플레이리스트·차단 목록을 삭제합니다. 서버 계정이나 서버에 접수된 신고를 삭제하는 기능이 아닙니다.</p>
        {!confirmDelete ? <button className="btn outline" onClick={() => setConfirmDelete(true)}>이 기기의 저장 데이터 삭제</button> : <div className="delete-confirmation"><p>저장한 목록을 모두 삭제할까요? 되돌릴 수 없습니다.</p><button className="btn outline" onClick={() => setConfirmDelete(false)}>취소</button><button className="btn danger" onClick={() => { try { onClearData(); setConfirmDelete(false); } catch { setError("데이터를 삭제하지 못했습니다. 다시 시도해 주세요."); } }}>삭제 확인</button></div>}
        {error && <p role="alert">{error}</p>}
      </section>
      <section><h2>고객지원</h2><p>앱: {config.appName}</p>
        {config.operatorName && <p>운영자: {config.operatorName}</p>}
        <p>{config.representative} · 사업자등록번호 539-09-02396</p>
        <p>{config.operatorAddress}</p>
        <p>대표전화: <a href={`tel:${config.supportPhone.replace(/-/g, "")}`}>{config.supportPhone}</a></p>
        {config.supportEmail ? <a href={`mailto:${config.supportEmail}?subject=${encodeURIComponent("뮤리프 문의")}`}>{config.supportEmail}</a> : <p>고객지원 연락처 등록 전입니다. 출시 전에 연락처를 연결해야 합니다.</p>}
        {config.supportUrl && <p><a href={config.supportUrl} target="_blank" rel="noopener noreferrer">고객지원 페이지</a></p>}
      </section>
    </DialogContent>
  </Dialog>;
}
