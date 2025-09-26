/*
 * Copyright (c) 2025 PT Hobimu Jadi Cuan
 * All rights reserved.
 *
 * This file and its contents are the exclusive property of PT Hobimu Jadi Cuan.
 * Unauthorized copying, distribution, reproduction, modification, or use of this file,
 * in whole or in part, in any form or by any means, is strictly prohibited without prior
 * written permission from PT Hobimu Jadi Cuan.
 *
 * This file is provided solely for its intended purpose by PT Hobimu Jadi Cuan and may not
 * be shared, sublicensed, resold, or otherwise made available to any third party.
 *
 * Any violation of this license will be considered an infringement of copyright and
 * intellectual property rights, and PT Hobimu Jadi Cuan reserves the right to pursue all
 * available legal remedies.
 *
 * For licensing inquiries or authorized use, please contact:
 * legal@tako.id
 */

// @ts-check
const PING_INTERVAL = 1000 * 60 * 30 + 1000; // 30 minutes + 1 second buffer
const SERVER_ID = GetConvar("tako:server_id", "__default__");
const BASE_URL = `https://tako.id/api/fivem-server/${SERVER_ID}`;
const VALID_PLAYER_LICENSES = ["license", "license2"]; // DO NOT CHANGE UNLESS PERMISSIBLE

/**
 * Ping the Tako server to update playtime for every integrated player on this server.
 * @returns {Promise<void>} Response text from server, if any
 */
async function ping() {
    try {
        console.log("[TAKO] Pinging server...");

        const licensesList = [];

        for (const playerId of getPlayers()) {
            for (const licenseType of VALID_PLAYER_LICENSES) {
                const license = GetPlayerIdentifierByType(playerId, licenseType);

                if (license) {
                    licensesList.push(license);
                }
            }
        }

        if (!licensesList.length) {
            console.log("[TAKO] No players to ping");
            return;
        }

        const res = await fetch(`${BASE_URL}/ping`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(licensesList),
        });

        const result = await res.text();

        if (!res.ok) {
            console.error("[TAKO] Failed to ping server:", result);
            return;
        }

        console.log("[TAKO] Successfully pinged server");
    } catch (error) {
        console.error("[TAKO] Error pinging server:", error);
        return;
    }
}

/**
 * Register a player with Tako FiveM integration.
 * @param {string} integrationToken Tako integration token
 * @param {string[]} licenses List of player game licenses to register
 * @returns {Promise<string>}
 */
async function connect(integrationToken, licenses) {
    try {
        const url = new URL(`${BASE_URL}/connect`);

        url.searchParams.append("token", integrationToken);

        for (const license of licenses) {
            url.searchParams.append("license", license);
        }

        const res = await fetch(url.toString(), {
            method: "POST",
        });

        return await res.text();
    } catch (error) {
        console.error("[TAKO] Error connecting to server:", error);
        throw error;
    }
}

/**
 * Ping interval
 * @type {NodeJS.Timeout | undefined}
 */
let pingInterval;

/**
 * Handle resource start event
 */
AddEventHandler("onResourceStart", async (/** @type {string} */ resourceName) => {
    if (resourceName !== GetCurrentResourceName()) return;

    if (SERVER_ID === "__default__") {
        console.error("[TAKO] Error: 'tako:server_id' convar is not set. Please set it in your server configuration.");
        StopResource(GetCurrentResourceName());
        return;
    }

    if (GetCurrentResourceName() !== "tako") {
        console.warn("[TAKO] Warning: Resource must be named 'tako' to function properly. Please rename the resource folder.");
    }

    console.log(`[TAKO] Resource started, configured server ID: "${SERVER_ID}", initiating ping sequence...`);
    pingInterval = setInterval(ping, PING_INTERVAL);
    await ping();
});

/**
 * Handle resource stop event
 */
AddEventHandler("onResourceStop", (/** @type {string} */ resourceName) => {
    if (resourceName !== GetCurrentResourceName()) return;

    console.log("[TAKO] Resource stopped, terminating ping sequence...");
    if (pingInterval) clearInterval(pingInterval);
});

/**
 * Register the /connect-tako <token> command
 */
RegisterCommand(
    "connect-tako",
    async (/** @type {number} */ source, /** @type {string[]} */ args) => {
        if (source === 0) {
            console.log("[TAKO] This command can only be run by a player.");
            return;
        }

        if (args.length < 1) {
            emitNet("chat:addMessage", source, {
                args: ["[TAKO]", "Usage: /connect-tako <integration_token>"],
            });

            return;
        }

        const integrationToken = args[0];
        const playerLicensesList = [];

        for (const licenseType of VALID_PLAYER_LICENSES) {
            const license = GetPlayerIdentifierByType(source.toString(), licenseType);

            if (license) {
                playerLicensesList.push(license);
            }
        }

        if (!playerLicensesList.length) {
            emitNet("chat:addMessage", source, {
                args: ["[TAKO]", "No valid game license found for your account."],
            });

            return;
        }

        try {
            const result = await connect(integrationToken, playerLicensesList);

            emitNet("chat:addMessage", source, {
                args: ["[TAKO]", result],
            });
        } catch (error) {
            emitNet("chat:addMessage", source, {
                args: ["[TAKO]", "Failed to connect to Tako server. Please try again later."],
            });
        }
    },
    false
);

/**
 * Polyfill for fetch API using Node.js http/https modules
 * FiveM does not have a built-in fetch API in server-side JS
 * PerformHttpRequest is only available on Lua
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");

global.fetch = function (url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === "https:" ? https : http;

        const opts = {
            method: options.method || "GET",
            headers: Object.fromEntries(Object.entries(options.headers || {})),
        };

        const req = lib.request(parsedUrl, opts, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                resolve({
                    ok: res?.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
                    status: res.statusCode || 0,
                    statusText: res.statusMessage || "",
                    // @ts-ignore
                    headers: {
                        get: (key) => {
                            const value = res.headers[key.toLowerCase()];
                            return Array.isArray(value) ? value.join(", ") : value || null;
                        },
                    },
                    text: async () => data,
                    json: async () => {
                        try {
                            return JSON.parse(data);
                        } catch {
                            return null;
                        }
                    },
                });
            });
        });

        req.on("error", reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
};
