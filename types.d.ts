interface CitizenExports {
    (exportName: "preAccountBindHooks", callback: (playerSrc: string) => Promise<true | string>): any;
    (exportName: "prePlayerPingHooks", callback: (playerSrc: string) => Promise<boolean>): any;
    (exportName: "prePingHooks", callback: () => Promise<boolean>): any;
    (exportName: "fetch", callback: typeof fetch): any;
    tako: {
        preAccountBindHooks?: (playerSrc: string) => Promise<true | string>;
        prePlayerPingHooks?: (playerSrc: string) => Promise<boolean>;
        prePingHooks?: () => Promise<boolean>;
        fetch: typeof fetch;
    };
}
