// @ts-check
"use strict";

/**
 * Polyfill for fetch API using Node.js http/https modules
 * @type {typeof fetch}
 */
global.fetch = function (url, options = {}) {
    const http = require("http");
    const https = require("https");
    const { URL } = require("url");

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
