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

const http = require("http");
const https = require("https");
const { URL } = require("url");

class Tako {
    convarName = "tako_server_id";
    resourceName = "tako"; // DO NOT CHANGE, ANY CHANGE WILL BREAK THE RESOURCE

    get serverId() {
        return GetConvar(this.convarName, "__default__");
    }

    get #baseUrl() {
        // For local development/testing purposes
        if (this.serverId === "tako") {
            return new URL("http://localhost:3000/api/fivem-server/tako");
        }

        return new URL(`https://tako.id/api/fivem-server/${this.serverId}`);
    }

    constructor() {
        if (this.serverId === "__default__") {
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

                const url = new URL("/connect", this.#baseUrl);

                for (const license of playerLicensesList) {
                    url.searchParams.append("license", license);
                }

                url.searchParams.append("token", token);

                const check = this.#getHook("preAccountBindHooks");

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

                const url = new URL("/connect", this.#baseUrl);

                for (const license of playerLicensesList) {
                    url.searchParams.append("license", license);
                }

                try {
                    const res = await fetch(url, {
                        method: "GET",
                    });

                    this.#sendChatMessage(playerSrc, await res.text());
                } catch (error) {
                    this.#logger.error("Error connecting to server:", error);
                    this.#sendChatMessage(playerSrc, "Failed to connect to Tako server. Please try again later.");
                }
            },
        },
    ];

    /**
     * Logger utility
     * @type {Record<"info" | "warn" | "error", (msg: string, ...args: any[]) => void>}
     */
    #logger = {
        info: (msg, ...args) => console.log(`[TAKO] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[TAKO] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[TAKO] ${msg}`, ...args),
    };

    /**
     * Ping interval every 30 minutes
     * @type {NodeJS.Timeout | undefined}
     */
    #pingInterval = setInterval(() => this.ping, 1000 * 60 * 30);

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
     * Get and execute a hook if exists
     * @template {keyof CitizenExports['tako']} T enum of hook names
     * @param {T} name Hook name
     * @returns {CitizenExports['tako'][T] | undefined} The hook function if it exists
     */
    #getHook(name) {
        try {
            /** @type {CitizenExports['tako'][T]} */
            // @ts-ignore
            const hook = global.exports.tako[name];

            if (hook && typeof hook === "function") {
                return hook;
            }
        } catch (error) {
            // Ignore
        }
    }

    /**
     * Send a chat message to a player
     * @param {string} playerSrc Player source to send message to
     * @param {string} message Message to send
     */
    #sendChatMessage(playerSrc, message) {
        emitNet("chat:addMessage", playerSrc, {
            args: ["[TAKO]", message],
        });
    }

    /**
     * Ping the Tako server to update playtime for every integrated player on this server.
     * @returns {Promise<void>} Response text from server, if any
     */
    async ping() {
        try {
            this.#logger.info("Pinging server...");

            const licensesList = [];

            for (const playerSrc of getPlayers()) {
                const check = this.#getHook("prePlayerPingHooks");
                if (check && !(await check(playerSrc))) continue;

                licensesList.push(...this.#getPlayerLicenses(playerSrc));
            }

            if (!licensesList.length) {
                this.#logger.info("No players to ping");
                return;
            }

            const check = this.#getHook("prePingHooks");

            if (check && !(await check())) {
                this.#logger.info("Ping aborted due to prePingHooks.");
                return;
            }

            const url = new URL("/ping", this.#baseUrl);

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(licensesList),
            });

            const result = await res.text();

            if (!res.ok) {
                console.error("Failed to ping server:", result);
                return;
            }

            this.#logger.info("Successfully pinged server");
        } catch (error) {
            this.#logger.error("Error pinging server:", error);
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
        // Remove convar-based command if exists
        emitNet("chat:removeSuggestion", globalThis.source, `/${this.convarName}`);

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

        if (this.#pingInterval) {
            clearInterval(this.#pingInterval);
        }
    }

    /**
     * Polyfill for fetch API using Node.js http/https modules
     * @type {typeof fetch}
     */
    static fetch = function (url, options = {}) {
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
}

new Tako();
global.fetch = Tako.fetch;
globalThis.exports("fetch", Tako.fetch);
