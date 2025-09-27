/*
 * Copyright (c) 2025 PT Hobimu Jadi Cuan
 * All rights reserved.
 *
 * This file and its contents are the exclusive property of PT Hobimu Jadi Cuan.
 * Unauthorized copying, distribution, reproduction, or use of this file,
 * in whole or in part, in any form or by any means, is strictly prohibited without prior
 * written permission from PT Hobimu Jadi Cuan.
 *
 * Modification of this file is permitted only by:
 *  - The client who lawfully owns this file, and
 *  - PT Hobimu Jadi Cuan (Tako).
 *
 * No other party is authorized to modify, alter, or create derivative works of this file.
 *
 * This file is provided solely for its intended purpose by PT Hobimu Jadi Cuan and may not
 * be shared, sublicensed, resold, or otherwise made available to any third party without authorization.
 *
 * Any violation of this license will be considered an infringement of copyright and
 * intellectual property rights, and PT Hobimu Jadi Cuan reserves the right to pursue all
 * available legal remedies.
 *
 * For licensing inquiries or authorized use, please contact:
 * legal@tako.id
 */

// @ts-check
"use strict";
require(require("path").join(GetResourcePath(GetCurrentResourceName()), "server", "polyfills.js"));

/**
 * Hooks that will determine whether the user
 * can bind their Tako account or not.
 * @type {(import("./types").PreAccountBindHook)[]}
 */
const PRE_ACCOUNT_BIND_HOOKS = [
    /**
     * [Sample Hook]
     * Check player total playtime on the server, if less than 1 hour,
     * return a string message to block the binding.
     */
    async (playerSrc) => {
        // Change this to your server's CFX ID
        // Go to https://portal.cfx.re/servers/registration-keys to get your server ID
        const CFX_RE_SERVER_ID = "37dmmz";
        const PLAYER_FIVEM_LICENSE = GetPlayerIdentifierByType(playerSrc, "fivem");

        if (!PLAYER_FIVEM_LICENSE) {
            return "Failed to get your FiveM license identifier. Please try again.";
        }

        const res = await fetch(`https://lambda.fivem.net/api/ticket/playtimes/${CFX_RE_SERVER_ID}?identifiers[]=${PLAYER_FIVEM_LICENSE}`);

        if (!res.ok) {
            console.error("[TAKO] Failed to fetch player playtime:", await res.text());
            return "Failed to verify your playtime. Please try again later.";
        }

        const data = await res.json();

        if (typeof data !== "object" || !Array.isArray(data) || !data[0] || typeof data[0].seconds !== "number") {
            console.error("[TAKO] Invalid response format:", data);
            return "Failed to verify your playtime. Please try again later.";
        }

        /** @type {number} */
        const playtime = data[0].seconds;

        if (playtime < 60 * 60) {
            // 1 hour
            return "You need at least 1 hour of playtime on this server to bind your account.";
        }

        return true;
    },
];

/**
 * Hooks that will be executed before server determines
 * whether to include the player in the ping sequence.
 * @type {(import("./types").PrePlayerPingHook)[]}
 */
const PRE_PLAYER_PING_HOOKS = [
    /**
     * [Sample Hook]
     * Check whether the player is exists or not
     */
    async (playerSrc) => {
        if (!DoesPlayerExist(playerSrc)) {
            return false;
        }

        return true;
    },
];

/**
 * Hooks that will be executed before server determines
 * whether to continue ping to the Tako server or not.
 * @type {(import("./types").PrePingHook)[]}
 */
const PRE_PING_HOOKS = [
    /**
     * [Sample Hook]
     * Disable ping between 2 AM to 3 AM server time
     * to avoid maintenance window.
     */
    async () => {
        const currentHour = new Date().getHours();

        // Disable ping between 2 AM to 3 AM server time
        if (currentHour === 2) {
            console.log("[TAKO] Skipping ping due to maintenance window.");
            return false;
        }

        return true;
    },
];

module.exports = {
    PRE_ACCOUNT_BIND_HOOKS,
    PRE_PLAYER_PING_HOOKS,
    PRE_PING_HOOKS,
};
