import { reportDb } from "../../../db/reports";
import { validateReport } from "../../report-rules";
export async function POST(request: Request) {
 const origin=request.headers.get("origin");
 if (origin && origin!==new URL(request.url).origin) return Response.json({error:"허용되지 않은 요청입니다."},{status:403});
 if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({error:"잘못된 요청입니다."},{status:415});
 let payload: {id?:unknown;trackId?:unknown;reason?:unknown;detail?:unknown};
 try { const body=await request.text(); if(body.length>8000)return Response.json({error:"입력 내용이 너무 깁니다."},{status:413}); payload=JSON.parse(body); } catch { return Response.json({error:"입력 내용을 확인해 주세요."},{status:400}); }
 if (!payload || typeof payload.id!=="string" || !/^[0-9a-f-]{36}$/i.test(payload.id) || !Number.isInteger(payload.trackId) || Number(payload.trackId)<1 || Number(payload.trackId)>8 || typeof payload.reason!=="string" || typeof payload.detail!=="string") return Response.json({error:"음원과 신고 내용을 확인해 주세요."},{status:400});
 const reason=payload.reason,detail=payload.detail.trim(); const error=validateReport(reason,detail);
 if(error)return Response.json({error},{status:400});
 try {
  const db=reportDb();
  await db.prepare("INSERT INTO music_reports (id, track_id, reason, detail, status, created_at) VALUES (?, ?, ?, ?, 'received', ?) ON CONFLICT(id) DO NOTHING").bind(payload.id,payload.trackId,reason,detail,Date.now()).run();
  return Response.json({id:payload.id,status:"received"},{status:201,headers:{"Cache-Control":"no-store"}});
 } catch(error) { console.error("Report storage failed",error);return Response.json({error:"신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요."},{status:503}); }
}
