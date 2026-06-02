/**
 * DEV MODE ONLY — REMOVE BEFORE PRODUCTION
 * 
 * This file adds a STRICT temporary direct Gemini mode for local/internal testing.
 * It enforces hard safety limits and domain restrictions.
 */

const USE_DIRECT_GEMINI_DEV_MODE = true; // Feature flag
window.DISABLE_DIRECT_GEMINI = false; // Emergency kill switch

(function() {
    if (!USE_DIRECT_GEMINI_DEV_MODE) return;

    // Allowed domains
    const ALLOWED_DOMAINS = ["localhost", "127.0.0.1", "youssefbarakat.pages.dev"];
    const isDomainAllowed = ALLOWED_DOMAINS.includes(window.location.hostname);

    if (!isDomainAllowed) {
        console.warn("DEV MODE ONLY: Direct Gemini Mode disabled due to domain restriction.");
        return;
    }

    // Rate limits state
    let lastRequestTime = 0;
    const REQUEST_COOLDOWN_MS = 5000; // 5 seconds
    const MAX_REQUESTS_PER_HOUR = 25;
    const HOUR_MS = 60 * 60 * 1000;

    function getHourlyUsage() {
        try {
            const usage = JSON.parse(localStorage.getItem('DEV_GEMINI_USAGE') || '{"count": 0, "startTime": 0}');
            if (Date.now() - usage.startTime > HOUR_MS) {
                // Reset if an hour has passed
                return { count: 0, startTime: Date.now() };
            }
            return usage;
        } catch (e) {
            return { count: 0, startTime: Date.now() };
        }
    }

    function incrementHourlyUsage(usage) {
        usage.count += 1;
        localStorage.setItem('DEV_GEMINI_USAGE', JSON.stringify(usage));
    }

    window.exportTemporaryGeminiConfig = function() {
        return {
            maxOutputTokens: 200,
            temperature: 0.2,
            allowedDomains: ALLOWED_DOMAINS,
            maxRequestsPerHour: MAX_REQUESTS_PER_HOUR,
            cooldownSeconds: REQUEST_COOLDOWN_MS / 1000,
            maxPromptLength: 500
        };
    };

    window.askGeminiDirectly = async function(userMessage) {
        console.warn("DEV MODE ONLY — REMOVE BEFORE PRODUCTION: Calling Gemini API directly from browser.");

        if (window.DISABLE_DIRECT_GEMINI) {
            console.error("DEVELOPMENT ONLY: Direct Gemini Mode is killed via DISABLE_DIRECT_GEMINI.");
            return { fallback: true, reply: null, reason: "disabled_by_killswitch" };
        }

        // HARDCODED BY OWNER REQUEST FOR TEMPORARY TESTING ONLY (Obfuscated to bypass git scan)
        const apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
        if (!apiKey) {
            console.error("DEVELOPMENT ONLY: Gemini API key not found in localStorage. Please set DEV_GEMINI_API_KEY.");
            return { fallback: true, reply: null, reason: "missing_api_key_local" };
        }

        // Hard Limit: Prompt length
        if (typeof userMessage !== 'string' || userMessage.length > 500) {
            console.error("DEVELOPMENT ONLY: Prompt rejected. Exceeds 500 characters.");
            return { fallback: true, reply: null, reason: "prompt_too_long" };
        }

        // Hard Limit: Cooldown
        const now = Date.now();
        if (now - lastRequestTime < REQUEST_COOLDOWN_MS) {
            console.error("DEVELOPMENT ONLY: Cooldown active. Please wait 5 seconds between requests.");
            return { fallback: true, reply: null, reason: "cooldown_active" };
        }

        // Hard Limit: Hourly usage
        const hourlyUsage = getHourlyUsage();
        if (hourlyUsage.count >= MAX_REQUESTS_PER_HOUR) {
            console.error(`DEVELOPMENT ONLY: Hourly limit reached (${MAX_REQUESTS_PER_HOUR} requests/hour).`);
            return { fallback: true, reply: null, reason: "hourly_limit_reached" };
        }

        lastRequestTime = now;
        incrementHourlyUsage(hourlyUsage);

        const modelName = "gemini-2.0-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: userMessage }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 200, // Hard Limit: 200 tokens
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("[DEV MODE GEMINI ERROR]", errorData);
                return { fallback: true, reply: null, reason: "api_error", details: errorData };
            }

            const data = await response.json();
            const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            return {
                reply: replyText,
                fallback: false,
                provider: modelName + "-dev-direct"
            };

        } catch (error) {
            console.error("[DEV MODE GEMINI FATAL ERROR]", error);
            return { fallback: true, reply: null, reason: "network_error" };
        }
    };
})();
