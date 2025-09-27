export type PreAccountBindHook = (playerSrc: string) => Promise<true | string>;
export type PrePlayerPingHook = (playerSrc: string) => Promise<boolean>;
export type PrePingHook = () => Promise<boolean>;
