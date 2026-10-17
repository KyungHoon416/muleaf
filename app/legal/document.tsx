import documents from "./documents.json";

export const legalTitles = documents.map(document => document.title.replace(/^뮤리프 /, ""));

export function LegalDocument({ index }: { index: number }) {
 const document = documents[index];
 if (!document) return null;
 return <article className="legal-document">
  <div className="legal-draft-notice" role="note">
   <strong>검토 중인 초안</strong>
   <p>개인정보 보호책임자는 권혁준 대표이사이며 공고일·시행일은 2026년 10월 17일입니다. 서버 보관·자동삭제·로그·백업 설정은 확인하여 반영했습니다. 계약 법인·국외이전 근거·문의 보유기간 등 별도 확인이 필요한 항목이 남아 있어 초안 표시를 유지합니다.</p>
   <p>현재 배포본은 로그인 후에도 미리듣기를 제공하며, 음원 등록 기능은 준비 중입니다. 선택 마케팅 동의 수집과 이메일 발송은 운영하지 않습니다. 이 문서를 열람하는 것만으로 동의가 기록되지 않습니다.</p>
  </div>
  {document.blocks.map((block, i) => block.kind === "table" ?
   <div className="legal-table-scroll" key={i} tabIndex={0} role="region" aria-label={`${document.title} 표 ${i + 1}`}>
    <table><thead><tr>{block.rows?.[0]?.map((cell, j) => <th scope="col" key={j}>{cell}</th>)}</tr></thead>
     <tbody>{block.rows?.slice(1).map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k}>{cell}</td>)}</tr>)}</tbody>
    </table>
   </div> : block.kind === "heading" ? <h3 key={i}>{block.text}</h3> : <p key={i}>{block.text}</p>)}
 </article>;
}
