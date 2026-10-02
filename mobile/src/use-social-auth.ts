import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { SocialAuth, SocialProvider } from "../../app/social-auth";

const enabled = import.meta.env.VITE_AUTH_ENABLED === "true";
const origin = (import.meta.env.VITE_AUTH_SERVER_ORIGIN || "").replace(/\/$/, "");
const labels = { google: "Google", apple: "Apple", naver: "네이버", kakao: "카카오" };
const messages: Record<string,string> = {
  provider_unavailable: "이 로그인 제공업체의 서비스 연결이 아직 완료되지 않았습니다.",
  invalid_state: "로그인 요청이 만료되었거나 확인되지 않았습니다. 다시 시도해 주세요.",
  cancelled: "로그인을 취소했어요. 다시 시도할 수 있습니다.",
  recent_login_required: "회원탈퇴를 위해 로그아웃 후 다시 로그인해 주세요.",
  login_failed: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
};
export function useSocialAuth(): SocialAuth {
  const [user, setUser] = useState<SocialAuth["user"]>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const csrf = useRef(""); const lock = useRef(false);
  useEffect(() => {
    let disposed = false;
    const url = new URL(location.href), code = url.searchParams.get("auth_error");
    if(code){setError(messages[code]||messages.login_failed);url.searchParams.delete("auth_error");history.replaceState(null,"",url.pathname+url.search+url.hash);}
    if(!enabled||Capacitor.isNativePlatform()){setReady(true);return;}
    fetch(`${origin}/api/auth/session`, {credentials:"include",headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)})
      .then(async response => {if(!response.ok||!response.headers.get("content-type")?.includes("application/json"))throw Error();return response.json();})
      .then(data => {if(disposed)return;if(!Array.isArray(data.providers))throw Error();setProviders(data.providers);csrf.current=data.csrfToken||"";setUser(data.user||null);})
      .catch(()=>{if(!disposed)setError("로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");})
      .finally(()=>{if(!disposed)setReady(true);});
    return()=>{disposed=true;};
  }, []);
  function signIn(provider: SocialProvider) {
    if(!ready||lock.current)return;
    if(Capacitor.isNativePlatform()){setError("앱 전용 로그인 연결은 준비 중입니다. 웹사이트에서 이용해 주세요.");return;}
    if(!enabled||!providers.includes(provider)){setError(`${labels[provider]} 로그인은 인증 서버와 서비스 등록 정보 연결 후 사용할 수 있습니다.`);return;}
    lock.current=true;setBusy(true);setError("");location.assign(`${origin}/api/auth/start/${provider}`);
  }
  async function mutate(path:string, method:string) {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try {
      const response=await fetch(`${origin}/api/auth/${path}`,{method,credentials:"include",headers:{"X-CSRF-Token":csrf.current,Accept:"application/json"},signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok||result.ok!==true){setError(messages[result.error]||"요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");return;}
      setUser(null);csrf.current="";
      if(path==="account"){localStorage.removeItem("muleaf-library-v1");localStorage.removeItem("muleaf-blocked-artists-v1");location.replace(location.pathname);}
    } catch {setError("서버에 연결하지 못했어요. 처리 상태를 확인한 뒤 다시 시도해 주세요.");}
    finally {lock.current=false;setBusy(false);}
  }
  return {user,ready,busy,error,signIn,signOut:()=>mutate("logout","POST"),deleteAccount:()=>mutate("account","DELETE")};
}
