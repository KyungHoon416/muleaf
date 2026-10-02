import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { ThemeProvider } from "next-themes";
import { useSocialAuth } from "./use-social-auth";
import SoriApp from "../../app/sori-app";
import { SafetyCenter } from "./safety-center";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import "./native.css";

const website = import.meta.env.VITE_PUBLIC_SITE_URL || "https://muleaf-ed246.web.app";
const reportsEndpoint = import.meta.env.VITE_REPORTS_API_URL || "";

async function shareTrack(title: string, id: number) {
  const url = `${website.replace(/\/$/, "")}/#track-${id}`;
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text: `${title} · 뮤리프에서 들어보세요`, url, dialogTitle: "음원 공유" });
  } else if (navigator.share) {
    await navigator.share({ title, url });
  } else {
    await navigator.clipboard.writeText(url);
  }
}

function MobileApp() {
  const auth = useSocialAuth();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pendingBlock, setPendingBlock] = useState<string | null>(null);
  const [safetyError, setSafetyError] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const [blockedArtists, setBlockedArtists] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("muleaf-blocked-artists-v1") || "[]");
      return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 100))] : [];
    } catch { return []; }
  });
  function updateBlocked(next: string[]) {
    try {
      localStorage.setItem("muleaf-blocked-artists-v1", JSON.stringify(next));
      setBlockedArtists(next);
      setPendingBlock(null);
      setSafetyError("");
    } catch { setSafetyError("차단 목록을 저장하지 못했습니다. 저장 공간을 확인해 주세요."); }
  }
  useEffect(() => {
    let disposed = false;
    const subscription = Network.addListener("networkStatusChange", status => {
      if (!disposed) setOffline(!status.connected);
    });
    Network.getStatus().then(status => { if (!disposed) setOffline(!status.connected); });
    const back = Capacitor.isNativePlatform() ? App.addListener("backButton", () => {
      // Close the topmost Radix overlay before leaving the current screen.
      const overlays = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]');
      const overlay = overlays[overlays.length - 1];
      if (overlay) {
        overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      } else if (location.hash && location.hash !== "#discover") {
        location.hash = "discover";
      } else {
        void App.minimizeApp();
      }
    }) : undefined;
    // HTML audio is foreground-only in this initial build; no background claim.
    const lifecycle = Capacitor.isNativePlatform() ? App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) document.querySelectorAll("audio").forEach(audio => audio.pause());
    }) : undefined;
    return () => {
      disposed = true;
      void subscription.then(handle => handle.remove());
      void back?.then(handle => handle.remove());
      void lifecycle?.then(handle => handle.remove());
    };
  }, []);
  return <ThemeProvider attribute="class" forcedTheme="dark">
    {offline && <div className="connection-banner" role="status">{Capacitor.isNativePlatform() ? "오프라인 · 앱에 포함된 미리듣기는 계속 이용할 수 있어요" : "오프라인 · 인터넷 연결을 확인해 주세요"}</div>}
    {safetyError && <div className="connection-banner" role="alert">{safetyError}</div>}
    <SoriApp key={resetVersion} auth={auth} mobile={{ shareTrack, reportsEndpoint, localLibrary: true, blockedArtists,
      onBlockArtist: artist => { setSafetyError(""); setPendingBlock(artist); }, openSafety: () => setSafetyOpen(true) }} />
    <SafetyCenter open={safetyOpen} onOpenChange={setSafetyOpen} blockedArtists={blockedArtists}
      onUnblock={artist => updateBlocked(blockedArtists.filter(value => value !== artist))}
      onClearData={() => {
        localStorage.removeItem("muleaf-library-v1");
        localStorage.removeItem("muleaf-blocked-artists-v1");
        document.querySelectorAll("audio").forEach(audio => audio.pause());
        setBlockedArtists([]);
        setResetVersion(value => value + 1);
        setSafetyError("");
      }} />
    <Dialog open={pendingBlock !== null} onOpenChange={open => { if (!open) setPendingBlock(null); }}>
      <DialogContent className="sori-dialog"><DialogHeader><DialogTitle>아티스트 차단</DialogTitle><DialogDescription>{pendingBlock}의 음악을 이 기기의 목록과 재생에서 숨길까요? 개인정보 및 안전 메뉴에서 해제할 수 있습니다.</DialogDescription></DialogHeader>
        <button className="btn outline" onClick={() => setPendingBlock(null)}>취소</button>
        <button className="btn lime" onClick={() => { if (pendingBlock) updateBlocked([...new Set([...blockedArtists, pendingBlock])]); }}>차단 확인</button>
      </DialogContent>
    </Dialog>
  </ThemeProvider>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><MobileApp /></React.StrictMode>);
