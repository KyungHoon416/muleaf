export type SocialProvider = "google" | "apple" | "naver" | "kakao";
export type SocialAuth = {
  user: { id: string; displayName: string; provider: string } | null;
  ready: boolean;
  busy: boolean;
  error: string;
  signIn: (provider: SocialProvider) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};
