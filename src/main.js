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
"use strict";
require(require("path").join(GetResourcePath(GetCurrentResourceName()), "src", "polyfills.js"));

class Tako {
    convarName = "tako_server_id";
    serverId = GetConvar(this.convarName, "");
    resourceName = "tako"; // DO NOT CHANGE, ANY CHANGE WILL BREAK THE RESOURCE

    get #baseUrl() {
        // For local development/testing purposes
        if (this.serverId === "tako") {
            return new URL("http://localhost:3000/api/fivem-server/tako/");
        }

        return new URL(`https://tako.id/api/fivem-server/${this.serverId}/`);
    }

    get #logger() {
        const date = `\x1b[2m[${new Date().toLocaleString("id-ID")}]\x1b[0m`;

        // [NOTE]
        // Prevent using console.info, console.warn, console.error directly
        // This will also prevent default log prefix by the server (Error:, Warning:, etc)
        return {
            /** @type {typeof console.log} */
            info: (...args) => console.log(date, "\x1b[32mINFO\x1b[0m", ...args),
            /** @type {typeof console.warn} */
            warn: (...args) => console.log(date, "\x1b[33mWARN\x1b[0m", ...args),
            /** @type {typeof console.error} */
            error: (...args) => console.log(date, "\x1b[31mERROR\x1b[0m", ...args),
        };
    }

    constructor() {
        if (!this.serverId) {
            this.#logger.error(`'${this.convarName}' convar is not set. Please set it in your server configuration (server.cfg).`);
            StopResource(GetCurrentResourceName());
            return;
        }

        if (GetCurrentResourceName() !== this.resourceName) {
            this.#logger.error(`Resource must be named '${this.resourceName}' to function properly. Please rename the resource folder.`);
            StopResource(GetCurrentResourceName());
            return;
        }

        this.#logger.info(`Resource started, configured server ID: "${this.serverId}", initiating ping sequence...`);

        this.ping();
        RegisterCommand(this.resourceName, this.handleCommand.bind(this), false);
        on("playerJoining", this.registerCommandDescription.bind(this));
        on("onResourceStop", this.#onResourceStop.bind(this));
    }

    /**
     * List of commands
     * @type {{ name: string, description: string, args: { name: string, help: string }[], handler: (playerSrc: string, ...args: any) => Promise<void> }[]}
     */
    #commands = [
        {
            name: "connect",
            description: "Connect your account using the integration token",
            args: [{ name: "token", help: "Integration token from Tako" }],
            handler: async (/** @type {string} */ playerSrc, /** @type {string} */ token) => {
                const playerLicensesList = this.#getPlayerLicenses(playerSrc);

                if (!playerLicensesList.length) {
                    this.#sendChatMessage(playerSrc, "No valid game license found for your account.");
                    return;
                }

                const url = new URL("connect", this.#baseUrl);

                for (const license of playerLicensesList) {
                    url.searchParams.append("license", license);
                }

                url.searchParams.append("token", token);

                const check = this.#hooks.preAccountBindHooks;

                if (check) {
                    const result = await check(playerSrc);

                    if (result !== true) {
                        this.#sendChatMessage(playerSrc, result);
                        return;
                    }
                }

                try {
                    const res = await fetch(url, {
                        method: "POST",
                    });

                    if (res.status === 401) {
                        this.#sendChatMessage(playerSrc, "This server is not registered with Tako. Please contact the server administrator.");
                        return;
                    }

                    this.#sendChatMessage(playerSrc, await res.text());
                } catch (error) {
                    this.#logger.error("Error connecting to server:", error);
                    this.#sendChatMessage(playerSrc, "Failed to connect to Tako server. Please try again later.");
                }
            },
        },
        {
            name: "info",
            description: "Check your Tako integration status",
            args: [],
            handler: async (playerSrc) => {
                const playerLicensesList = this.#getPlayerLicenses(playerSrc);

                if (!playerLicensesList.length) {
                    this.#sendChatMessage(playerSrc, "No valid game license found for your account.");
                    return;
                }

                const url = new URL("connect", this.#baseUrl);

                for (const license of playerLicensesList) {
                    url.searchParams.append("license", license);
                }

                try {
                    const res = await fetch(url, {
                        method: "GET",
                    });

                    if (res.status === 401) {
                        this.#sendChatMessage(playerSrc, "This server is not registered with Tako. Please contact the server administrator.");
                        return;
                    }

                    this.#sendChatMessage(playerSrc, await res.text());
                } catch (error) {
                    this.#logger.error("Error connecting to server:", error);
                    this.#sendChatMessage(playerSrc, "Failed to connect to Tako server. Please try again later.");
                }
            },
        },
    ];

    /**
     * Get registered hook (if any)
     */
    get #hooks() {
        try {
            const hooks = require(require("path").join(GetResourcePath(GetCurrentResourceName()), "src", "hooks.js"));

            return {
                /** @type {import("./types").PreAccountBindHook} */
                preAccountBindHooks: async (playerSrc) => {
                    if (!hooks.PRE_ACCOUNT_BIND_HOOKS || !Array.isArray(hooks.PRE_ACCOUNT_BIND_HOOKS)) {
                        this.#logger.warn("PRE_ACCOUNT_BIND_HOOKS is not an array. Skipping the hook.");
                        return true;
                    }

                    for (const hook of hooks.PRE_ACCOUNT_BIND_HOOKS) {
                        if (typeof hook !== "function") {
                            this.#logger.warn("A hook in PRE_ACCOUNT_BIND_HOOKS is not a function. Skipping the hook.");
                            continue;
                        }

                        const result = await hook(playerSrc);
                        if (result !== true) return result;
                    }

                    return true;
                },

                /** @type {import("./types").PrePlayerPingHook} */
                prePlayerPingHooks: async (/** @type {string} */ playerSrc) => {
                    if (!hooks.PRE_PLAYER_PING_HOOKS || !Array.isArray(hooks.PRE_PLAYER_PING_HOOKS)) {
                        this.#logger.warn("PRE_PLAYER_PING_HOOKS is not an array. Skipping the hook.");
                        return true;
                    }

                    for (const hook of hooks.PRE_PLAYER_PING_HOOKS) {
                        if (typeof hook !== "function") {
                            this.#logger.warn("A hook in PRE_PLAYER_PING_HOOKS is not a function. Skipping the hook.");
                            continue;
                        }

                        const result = await hook(playerSrc);
                        if (result === false) return false;
                    }

                    return true;
                },

                /** @type {import("./types").PrePingHook} */
                prePingHooks: async () => {
                    if (!hooks.PRE_PING_HOOKS || !Array.isArray(hooks.PRE_PING_HOOKS)) {
                        this.#logger.warn("PRE_PING_HOOKS is not an array. Skipping the hook.");
                        return true;
                    }

                    for (const hook of hooks.PRE_PING_HOOKS) {
                        if (typeof hook !== "function") {
                            this.#logger.warn("A hook in PRE_PING_HOOKS is not a function. Skipping the hook.");
                            continue;
                        }

                        const result = await hook();
                        if (result === false) return false;
                    }

                    return true;
                },
            };
        } catch (error) {
            return {
                preAccountBindHooks: null,
                prePlayerPingHooks: null,
                prePingHooks: null,
            };
        }
    }

    /**
     * Get valid player licenses
     * @param {string} playerSrc Player source
     * @returns {string[]} List of valid player licenses
     */
    #getPlayerLicenses(playerSrc) {
        const licenses = [];

        for (const licenseType of ["license2", "license"]) {
            const license = GetPlayerIdentifierByType(playerSrc, licenseType);

            if (license) {
                licenses.push(license);
            }
        }

        return licenses;
    }

    /**
     * Send a chat message to a player
     * @param {string} playerSrc Player source to send message to
     * @param {string} message Message to send
     */
    #sendChatMessage(playerSrc, message) {
        emitNet("chat:addMessage", playerSrc, {
            args: ["TAKO", message],
        });
    }

    /**
     * Count of consecutive ping errors
     */
    #pingErrorCount = 0;

    /**
     * Ping timeout every 30 minutes or every defined ratelimit returned by the server
     * @type {NodeJS.Timeout | undefined}
     */
    #nextPingTimeout;

    /**
     * Ping the Tako server to update playtime for every integrated player on this server.
     * @returns {Promise<void>} Response text from server, if any
     */
    async ping() {
        try {
            // Clear previous timeout if any to avoid multiple pings
            if (this.#nextPingTimeout) {
                clearTimeout(this.#nextPingTimeout);
            }

            const licensesList = [];

            for (const playerSrc of getPlayers()) {
                if (this.#hooks.prePlayerPingHooks && !(await this.#hooks.prePlayerPingHooks(playerSrc))) continue;
                licensesList.push(...this.#getPlayerLicenses(playerSrc));
            }

            if (!licensesList.length) {
                this.#logger.info("No players to ping, retrying in 5 minutes...");
                this.#nextPingTimeout = setTimeout(this.ping.bind(this), 5 * 60 * 1000); // Retry ping after 5 minutes
                return;
            }

            if (this.#hooks.prePingHooks && !(await this.#hooks.prePingHooks())) {
                this.#logger.info("Ping aborted due to pre-ping hook, retrying in 5 minutes...");
                this.#nextPingTimeout = setTimeout(this.ping.bind(this), 5 * 60 * 1000); // Retry ping after 5 minutes
                return;
            }

            const url = new URL("ping", this.#baseUrl);

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(licensesList),
            });

            const result = await res.text();

            if (!res.ok) {
                if (res.status === 429) {
                    let retryAfter = 30 * 60; // Default to 30 minutes

                    if (res.headers.get("Retry-After")) {
                        const header = (res.headers.get("Retry-After")?.split(",")[0] || "").trim();
                        const parsed = Number(header);

                        if (!isNaN(parsed) && parsed > 0) {
                            retryAfter = parsed;
                        }
                    } else {
                        const parsed = Number(result.replace(/\D/g, "").trim());

                        if (!isNaN(parsed) && parsed > 0) {
                            retryAfter = parsed * 60;
                        }
                    }

                    this.#logger.warn(`Next ping will be attempted in ${retryAfter} seconds (${(retryAfter / 60).toFixed(2)} minutes).`);
                    this.#nextPingTimeout = setTimeout(this.ping.bind(this), retryAfter * 1000);
                } else {
                    this.#logger.error("Failed to ping server, retrying in 5 minutes:", result);
                    this.#nextPingTimeout = setTimeout(this.ping.bind(this), 5 * 60 * 1000); // Retry ping after 5 minutes
                }

                return;
            }

            this.#logger.info("Successfully pinged server");
            this.#pingErrorCount = 0;
            this.#nextPingTimeout = setTimeout(this.ping.bind(this), 5 * 1000); // Ping again after 5 seconds
            return;
        } catch (error) {
            this.#pingErrorCount++;

            if (this.#pingErrorCount >= 3) {
                this.#logger.error(
                    "Too many consecutive ping errors. Retrying again in 30 minutes. Please check your server configuration and network connection, or contact Tako if the issue persists."
                );
                this.#nextPingTimeout = setTimeout(this.ping.bind(this), 30 * 60 * 1000); // Retry ping after 30 minutes
            } else {
                this.#logger.error("Error pinging server, retrying in 5 minutes:", error);
                this.#nextPingTimeout = setTimeout(this.ping.bind(this), 5 * 60 * 1000); // Retry ping after 5 minutes
            }

            return;
        }
    }

    /**
     * Register the command
     * @param {number} playerSrc The player who runs the command
     * @param {any[]} args Command arguments
     */
    async handleCommand(playerSrc, args) {
        if (playerSrc === 0) {
            this.#logger.error("This command can only be run by a player.");
            return;
        }

        if (args.length < 1) {
            this.#sendChatMessage(playerSrc.toString(), `Arguments required. Usage: /${this.resourceName} <${this.#commands.map((cmd) => cmd.name).join("|")}> [...args]`);
            return;
        }

        const command = this.#commands.find((cmd) => cmd.name === args[0]);

        if (!command) {
            this.#sendChatMessage(playerSrc.toString(), "Unknown command.");
            return;
        }

        const commandArgs = args.slice(1);

        if (command.args.length !== commandArgs.length) {
            this.#sendChatMessage(playerSrc.toString(), `Invalid arguments. Usage: /${this.resourceName} ${command.name} ${command.args.map((arg) => `<${arg.name}>`).join(" ")}`);
            return;
        }

        await command.handler(playerSrc.toString(), ...commandArgs);
    }

    /**
     * Register command description for chat suggestions
     */
    async registerCommandDescription() {
        // Register description for the main command
        emitNet("chat:addSuggestion", globalThis.source, `/${this.resourceName}`, "Integrate your account with Tako! Register now at https://tako.id", [
            {
                name: this.#commands.map((cmd) => cmd.name).join("|"),
                help: "Sub-command to execute",
            },
            {
                name: "args",
                help: "Arguments for the sub-command (Empty to show available arguments)",
            },
        ]);
    }

    /**
     * Handle resource stop event
     * @param {string} resourceName Resource name that is stopping
     */
    async #onResourceStop(resourceName) {
        if (resourceName !== GetCurrentResourceName()) return;

        if (this.#nextPingTimeout) {
            clearTimeout(this.#nextPingTimeout);
        }
    }
}

new Tako();
