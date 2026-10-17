import documents from "./documents.json";

export const legalTitles = documents.map(document => document.title.replace(/^뮤리프 /, ""));

export function LegalDocument({ index }: { index: number }) {
 const document = documents[index];
 if (!document) return null;
 return <article className="legal-document">
  <div className="legal-draft-notice" role="note">
   <strong>검토 중인 초안</strong>
   <p>대괄호로 표시된 개인정보 보호책임자·공고일·시행일·처리 운영정보는 아직 확정되지 않았습니다. 문서에 설명된 일부 기능은 현재 제공 범위와 다를 수 있습니다.</p>
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
