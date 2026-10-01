export const reportReasons = ["저작권 침해", "부적절한 콘텐츠", "개인정보 노출", "스팸·홍보", "기타"] as const;
export function validateReport(reason: string, detail: string) {
 if (!reportReasons.includes(reason as typeof reportReasons[number])) return "신고 사유를 선택해 주세요.";
 if (detail.length > 1000) return "상세 내용은 1,000자 이내로 입력해 주세요.";
 if (reason === "기타" && detail.trim().length < 10) return "기타 사유는 상세 내용을 10자 이상 입력해 주세요.";
 return "";
}
