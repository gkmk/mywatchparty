"use strict";

/**
 * Turn whatever the user pasted into a stream descriptor.
 *
 * @param {string} input
 * @returns {{ok: true, stream: {provider: string, kind: string, id: string}} | {ok: false, error: string}}
 */
function parseStreamUrl(input) {
    let text = (input || "").trim();
    if (!text) {
        return { ok: false, error: "Paste a link to a stream." };
    }
    if (!/^https?:\/\//i.test(text)) {
        text = "https://" + text;
    }

    let url;
    try {
        url = new URL(text);
    } catch (e) {
        return { ok: false, error: "That doesn't look like a link." };
    }

    const host = url.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" || /^(music\.)?youtube(-nocookie)?\.com$/.test(host)) {
        return parseYoutube(host, parts, url);
    }
    if (host === "twitch.tv") {
        return parseTwitch(parts);
    }
    if (host === "kick.com") {
        return parseKick(parts);
    }
    if (host === "facebook.com" || host === "fb.watch") {
        url.hostname = host === "fb.watch" ? "fb.watch" : "www.facebook.com";
        url.hash = "";
        return { ok: true, stream: { provider: "facebook", kind: "video", id: url.toString() } };
    }

    return { ok: false, error: "Only Twitch, YouTube, Kick and Facebook links are supported." };
}

function parseYoutube(host, parts, url) {
    const isVideoId = (id) => /^[\w-]{11}$/.test(id || "");
    let id = null;

    if (host === "youtu.be") {
        id = parts[0];
    } else if (parts[0] === "watch") {
        id = url.searchParams.get("v");
    } else if (["live", "shorts", "embed", "v"].includes(parts[0])) {
        id = parts[1];
    } else if (parts[0] === "channel" && /^UC[\w-]{22}$/.test(parts[1] || "")) {
        // The channel's current live stream
        return { ok: true, stream: { provider: "youtube", kind: "channel", id: parts[1] } };
    } else if (parts[0] && parts[0].startsWith("@")) {
        return {
            ok: false,
            error: "YouTube channel handles can't be embedded. Open the live stream and copy the link from the address bar (it contains watch?v=) or from Share.",
        };
    }

    if (!isVideoId(id)) {
        return { ok: false, error: "Couldn't find a video in that YouTube link." };
    }
    return { ok: true, stream: { provider: "youtube", kind: "video", id } };
}

function parseTwitch(parts) {
    if (parts[0] === "videos" && /^\d+$/.test(parts[1] || "")) {
        return { ok: true, stream: { provider: "twitch", kind: "video", id: parts[1] } };
    }
    const reserved = ["directory", "search", "settings", "subscriptions", "inventory", "wallet", "drops", "downloads", "p", "videos", "turbo", "prime"];
    const channel = (parts[0] || "").toLowerCase();
    if (parts[1] === "clip" || !/^\w{3,25}$/.test(channel) || reserved.includes(channel)) {
        return { ok: false, error: "Use a Twitch channel link (twitch.tv/name) or a past broadcast (twitch.tv/videos/123). Clips aren't supported." };
    }
    return { ok: true, stream: { provider: "twitch", kind: "channel", id: channel } };
}

function parseKick(parts) {
    const channel = (parts[0] || "").toLowerCase();
    if (parts.length !== 1 || !/^[\w-]{2,25}$/.test(channel)) {
        return { ok: false, error: "Use a Kick channel link (kick.com/name)." };
    }
    return { ok: true, stream: { provider: "kick", kind: "channel", id: channel } };
}

/** Short codes used in shareable links (?s=tw:name,yt:id,...) */
const SHARE_CODES = {
    "youtube:video": "yt",
    "youtube:channel": "ytc",
    "twitch:channel": "tw",
    "twitch:video": "twv",
    "kick:channel": "kick",
    "facebook:video": "fb",
};

function encodeStreams(streams) {
    return streams
        .map((s) => SHARE_CODES[s.provider + ":" + s.kind] + ":" + encodeURIComponent(s.id))
        .join(",");
}

function decodeStreams(value) {
    const byCode = Object.fromEntries(Object.entries(SHARE_CODES).map(([k, v]) => [v, k]));
    return (value || "")
        .split(",")
        .map((item) => {
            const sep = item.indexOf(":");
            const key = byCode[item.slice(0, sep)];
            if (sep < 0 || !key) return null;
            let id;
            try {
                id = decodeURIComponent(item.slice(sep + 1));
            } catch (e) {
                return null;
            }
            const [provider, kind] = key.split(":");
            return id ? { provider, kind, id } : null;
        })
        .filter(Boolean);
}

function streamLabel(stream) {
    switch (stream.provider + ":" + stream.kind) {
        case "twitch:channel": return "Twitch: " + stream.id;
        case "twitch:video": return "Twitch video " + stream.id;
        case "kick:channel": return "Kick: " + stream.id;
        case "youtube:channel": return "YouTube live channel";
        case "youtube:video": return "YouTube video";
        default: return "Facebook video";
    }
}

/** Load an external script once and resolve when it has run */
const loadedScripts = {};
function loadScript(src) {
    if (!loadedScripts[src]) {
        loadedScripts[src] = new Promise((resolve, reject) => {
            const tag = document.createElement("script");
            tag.src = src;
            tag.async = true;
            tag.onload = resolve;
            tag.onerror = () => {
                delete loadedScripts[src];
                reject(new Error("Failed to load " + src));
            };
            document.head.append(tag);
        });
    }
    return loadedScripts[src];
}

let youtubeApi;
function loadYoutubeApi() {
    if (!youtubeApi) {
        youtubeApi = new Promise((resolve, reject) => {
            window.onYouTubeIframeAPIReady = resolve;
            loadScript("https://www.youtube.com/iframe_api").catch(reject);
        });
    }
    return youtubeApi;
}

let facebookApi;
const facebookPlayers = {};
function loadFacebookApi() {
    if (!facebookApi) {
        facebookApi = new Promise((resolve, reject) => {
            window.fbAsyncInit = () => {
                FB.init({ xfbml: false, version: "v23.0" });
                FB.Event.subscribe("xfbml.ready", (msg) => {
                    if (msg.type === "video" && facebookPlayers[msg.id]) {
                        facebookPlayers[msg.id](msg.instance);
                    }
                });
                resolve();
            };
            loadScript("https://connect.facebook.net/en_US/sdk.js").catch(reject);
        });
    }
    return facebookApi;
}

/**
 * Each provider knows how to embed a stream into `screen.mount`, and how to
 * apply `screen.muted` / `screen.isMain` once its player is ready.
 */
const PROVIDERS = {
    youtube: {
        async embed(screen) {
            await loadYoutubeApi();
            // YT.Player replaces the element it is given, so give it a child
            const target = document.createElement("div");
            screen.mount.append(target);
            const s = screen.stream;
            await new Promise((resolve) => {
                screen.player = new YT.Player(target, {
                    width: "100%",
                    height: "100%",
                    videoId: s.kind === "channel" ? "live_stream" : s.id,
                    playerVars: { playsinline: 1, autoplay: 1, ...(s.kind === "channel" ? { channel: s.id } : {}) },
                    events: { onReady: resolve },
                });
            });
            const data = screen.player.getVideoData ? screen.player.getVideoData() : null;
            if (data && data.title) {
                screen.setLabel("YouTube: " + data.title);
            }
            screen.player.playVideo();
        },
        apply(screen) {
            screen.muted ? screen.player.mute() : screen.player.unMute();
        },
        iframe(screen) {
            return screen.player.getIframe();
        },
        destroy(screen) {
            screen.player && screen.player.destroy && screen.player.destroy();
        },
    },

    twitch: {
        async embed(screen) {
            await loadScript("https://player.twitch.tv/js/embed/v1.js");
            const s = screen.stream;
            screen.player = new Twitch.Player(screen.mount.id, {
                width: "100%",
                height: "100%",
                parent: [location.hostname],
                muted: screen.muted,
                [s.kind === "video" ? "video" : "channel"]: s.kind === "video" ? "v" + s.id : s.id,
            });
            await new Promise((resolve) => screen.player.addEventListener(Twitch.Player.READY, resolve));
        },
        apply(screen) {
            const player = screen.player;
            player.setMuted(screen.muted);

            // Save bandwidth: drop minimized screens to the lowest quality
            try {
                if (!screen.isMain) {
                    const qualities = player.getQualities().map((q) => q.group).filter((g) => /^\d+p/.test(g));
                    const lowest = qualities.sort((a, b) => parseInt(a) - parseInt(b))[0];
                    if (lowest) {
                        screen.savedQuality = screen.savedQuality || player.getQuality();
                        player.setQuality(lowest);
                    }
                } else if (screen.savedQuality) {
                    player.setQuality(screen.savedQuality);
                    screen.savedQuality = null;
                }
            } catch (e) {
                // quality list isn't available until the stream starts
            }
        },
        iframe(screen) {
            return screen.mount.querySelector("iframe");
        },
        destroy() {},
    },

    kick: {
        // Kick has no player API: the iframe is reloaded with the new muted state
        async embed(screen) {
            const iframe = document.createElement("iframe");
            iframe.allow = "autoplay; fullscreen; picture-in-picture";
            iframe.allowFullscreen = true;
            screen.mount.append(iframe);
            screen.player = iframe;
        },
        apply(screen) {
            const src = "https://player.kick.com/" + encodeURIComponent(screen.stream.id) + "?autoplay=true&muted=" + screen.muted;
            if (screen.player.src !== src) {
                screen.player.src = src;
            }
        },
        iframe(screen) {
            return screen.player;
        },
        destroy() {},
    },

    facebook: {
        async embed(screen) {
            await loadFacebookApi();
            const el = document.createElement("div");
            el.className = "fb-video";
            el.id = screen.mount.id + "-fb";
            el.dataset.href = screen.stream.id;
            el.dataset.width = "auto";
            el.dataset.autoplay = "true";
            el.dataset.allowfullscreen = "true";
            screen.mount.append(el);
            screen.player = await new Promise((resolve) => {
                facebookPlayers[el.id] = resolve;
                FB.XFBML.parse(screen.mount);
            });
            delete facebookPlayers[el.id];
            screen.player.play();
        },
        apply(screen) {
            screen.muted ? screen.player.mute() : screen.player.unmute();
        },
        iframe(screen) {
            return screen.mount.querySelector("iframe");
        },
        destroy() {},
    },
};

class Screen {
    static nextId = 0;

    constructor(stream, muted) {
        this.stream = stream;
        this.id = "screen-" + Screen.nextId++;
        this.label = streamLabel(stream);
        this.muted = muted;
        this.isMain = false;
        this.ready = false;
        this.player = null;
        this.el = this.render();
        this.mount = this.el.querySelector(".screen-player");
    }

    render() {
        const el = document.createElement("article");
        el.className = "screen";
        el.id = this.id;
        el.innerHTML = `
            <div class="screen-player" id="${this.id}-player"></div>
            <button type="button" class="screen-select"></button>
            <div class="screen-bar">
                <span class="screen-label"></span>
                <button type="button" class="screen-action screen-mute"></button>
                <button type="button" class="screen-action screen-remove"><span aria-hidden="true">✕</span></button>
            </div>`;
        return el;
    }

    setLabel(label) {
        this.label = label;
        this.updateView();
    }

    updateView() {
        const el = this.el;
        el.classList.toggle("is-main", this.isMain);
        el.setAttribute("aria-label", this.label + (this.isMain ? " (main stream)" : ""));
        el.querySelector(".screen-label").textContent = (this.isMain ? (this.muted ? "🔇 " : "🔊 ") : "") + this.label;
        el.querySelector(".screen-select").setAttribute("aria-label", "Make " + this.label + " the main stream");
        el.querySelector(".screen-remove").setAttribute("aria-label", "Remove " + this.label);
        el.querySelector(".screen-select").tabIndex = this.isMain ? -1 : 0;
        const mute = el.querySelector(".screen-mute");
        mute.textContent = this.muted ? "🔇 Unmute" : "🔊 Mute";
        mute.setAttribute("aria-pressed", String(this.muted));
        if (this.isMain) {
            el.setAttribute("aria-current", "true");
        } else {
            el.removeAttribute("aria-current");
        }
        const iframe = this.ready && PROVIDERS[this.stream.provider].iframe(this);
        if (iframe) {
            iframe.title = this.label;
        }
    }

    async start() {
        const provider = PROVIDERS[this.stream.provider];
        await provider.embed(this);
        if (this.removed) return;
        this.ready = true;
        this.apply();
    }

    /** Sync the player with the current muted / main state */
    apply() {
        this.updateView();
        if (this.ready) {
            PROVIDERS[this.stream.provider].apply(this);
        }
    }

    destroy() {
        this.removed = true;
        try {
            PROVIDERS[this.stream.provider].destroy(this);
        } catch (e) {
            // the player may not have finished loading
        }
        this.el.remove();
    }
}

class MyWatchParty {
    static STORAGE_KEY = "mwp-state";
    static SHORTCUTS_KEY = "mwp-shortcuts";
    static EXAMPLES = {
        twitch: ["Twitch", "https://www.twitch.tv/name"],
        youtube: ["YouTube", "https://www.youtube.com/watch?v=…"],
        kick: ["Kick", "https://kick.com/name"],
        facebook: ["Facebook", "https://www.facebook.com/…/videos/…"],
    };

    constructor() {
        /** @type {Screen[]} */
        this.screens = [];
        this.main = null;

        this.container = document.getElementById("screens");
        this.emptyState = document.getElementById("empty-state");
        this.status = document.getElementById("status");
        this.dialog = document.getElementById("add-dialog");
        this.dialogTitle = document.getElementById("add-dialog-title");
        this.form = document.getElementById("add-form");
        this.input = document.getElementById("stream-url");
        this.error = document.getElementById("stream-url-error");
        this.shareButton = document.getElementById("share-button");
        this.shortcutsToggle = document.getElementById("shortcuts-toggle");

        document.querySelectorAll("[data-action=add]").forEach((b) =>
            b.addEventListener("click", () => this.openAddDialog(b.dataset.platform)));
        this.shareButton.addEventListener("click", () => this.copyShareLink());
        this.form.addEventListener("submit", (ev) => this.onAddSubmit(ev));
        this.input.addEventListener("input", () => this.showError(""));
        document.getElementById("add-cancel").addEventListener("click", () => this.dialog.close());
        this.container.addEventListener("click", (ev) => this.onScreenClick(ev));
        document.addEventListener("keydown", (ev) => this.onKeyDown(ev));

        this.shortcutsToggle.checked = this.read(MyWatchParty.SHORTCUTS_KEY) !== "off";
        this.shortcutsToggle.addEventListener("change", () =>
            this.write(MyWatchParty.SHORTCUTS_KEY, this.shortcutsToggle.checked ? "on" : "off"));

        this.restore();
    }

    /** localStorage can throw (private mode, blocked storage) */
    read(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // not critical
        }
    }

    announce(message) {
        this.status.textContent = "";
        // let screen readers notice the change even when the text repeats
        setTimeout(() => (this.status.textContent = message), 50);
    }

    /** @param {string} [platform] pre-selected from the platform buttons, only changes the wording */
    openAddDialog(platform) {
        const example = MyWatchParty.EXAMPLES[platform];
        this.dialogTitle.textContent = example ? "Add a " + example[0] + " stream" : "Add a stream";
        this.input.placeholder = example ? example[1] : "Paste a stream link";
        this.input.value = "";
        this.showError("");
        this.dialog.showModal();
        this.input.focus();
    }

    showError(message) {
        this.error.textContent = message;
        this.error.classList.toggle("hidden", !message);
        this.input.setAttribute("aria-invalid", String(Boolean(message)));
    }

    onAddSubmit(ev) {
        ev.preventDefault();
        const result = parseStreamUrl(this.input.value);
        if (!result.ok) {
            this.showError(result.error);
            this.input.focus();
            return;
        }
        const existing = this.screens.find((s) => s.stream.provider === result.stream.provider && s.stream.id === result.stream.id);
        if (existing) {
            this.showError(existing.label + " is already in your watch party.");
            return;
        }
        this.dialog.close();
        this.addStream(result.stream);
    }

    /**
     * @param {object} stream
     * @param {{makeMain?: boolean, muted?: boolean, silent?: boolean}} options
     */
    addStream(stream, { makeMain = true, muted = false, silent = false } = {}) {
        const screen = new Screen(stream, true);
        this.screens.push(screen);
        this.container.append(screen.el);
        screen.updateView();

        screen.start().catch((e) => {
            console.error(e);
            this.removeScreen(screen, { silent: true });
            this.announce("Couldn't load " + screen.label + ". Check your connection or ad blocker and try again.");
        });

        if (makeMain || !this.main) {
            this.setMain(screen, { muted, silent: true });
        } else {
            screen.apply();
        }

        if (!silent) {
            this.announce("Added " + screen.label + ".");
        }
        this.update();
        return screen;
    }

    setMain(screen, { muted = false, silent = false } = {}) {
        if (this.main && this.main !== screen) {
            this.main.isMain = false;
            this.main.muted = true;
            this.main.apply();
        }
        this.main = screen;
        screen.isMain = true;
        screen.muted = muted;
        screen.apply();
        if (!silent) {
            this.announce(screen.label + " is now the main stream.");
        }
        this.update();
    }

    toggleMute() {
        if (!this.main) return;
        this.main.muted = !this.main.muted;
        this.main.apply();
        this.announce(this.main.label + (this.main.muted ? " muted." : " unmuted."));
        this.save();
    }

    removeScreen(screen, { silent = false } = {}) {
        screen.destroy();
        this.screens = this.screens.filter((s) => s !== screen);
        if (this.main === screen) {
            this.main = null;
            if (this.screens[0]) {
                this.setMain(this.screens[0], { silent: true });
            }
        }
        if (!silent) {
            this.announce("Removed " + screen.label + "." + (this.main ? " " + this.main.label + " is the main stream." : ""));
        }
        this.update();
    }

    onScreenClick(ev) {
        const button = ev.target.closest("button");
        const el = ev.target.closest(".screen");
        const screen = el && this.screens.find((s) => s.el === el);
        if (!button || !screen) return;

        if (button.classList.contains("screen-select")) {
            this.setMain(screen);
        } else if (button.classList.contains("screen-mute")) {
            this.toggleMute();
        } else if (button.classList.contains("screen-remove")) {
            const index = this.screens.indexOf(screen);
            this.removeScreen(screen);
            // keep keyboard focus somewhere sensible
            const next = this.screens[Math.min(index, this.screens.length - 1)];
            (next ? next.el.querySelector(".screen-remove") : document.querySelector("[data-action=add]")).focus();
        }
    }

    onKeyDown(ev) {
        if (!this.shortcutsToggle.checked || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const target = ev.target;
        if (this.dialog.open || target.closest("input, textarea, select, [contenteditable]")) return;

        if (ev.key === "+") {
            ev.preventDefault();
            this.openAddDialog();
        } else if (/^[1-9]$/.test(ev.key)) {
            const screen = this.screens[Number(ev.key) - 1];
            if (screen && screen !== this.main) {
                this.setMain(screen);
            }
        } else if (ev.key === "m" || ev.key === "M") {
            this.toggleMute();
        }
    }

    /** Refresh page-level UI and persist state */
    update() {
        const hasScreens = this.screens.length > 0;
        this.emptyState.classList.toggle("hidden", hasScreens);
        this.container.classList.toggle("hidden", !hasScreens);
        this.shareButton.classList.toggle("hidden", !hasScreens);
        this.save();
    }

    save() {
        const streams = encodeStreams(this.screens.map((s) => s.stream));
        const mainIndex = this.screens.indexOf(this.main);
        this.write(MyWatchParty.STORAGE_KEY, JSON.stringify({ streams, main: mainIndex }));

        // Written by hand so links stay readable (?s=tw:name,yt:id); ids are already URI-encoded
        let query = streams ? "?s=" + streams : "";
        if (streams && mainIndex > 0) {
            query += "&main=" + mainIndex;
        }
        history.replaceState(null, "", location.pathname + query);
    }

    /** Restore streams from a shared link, falling back to the last session */
    restore() {
        const params = new URLSearchParams(location.search);
        // read the raw value: URLSearchParams would decode the ids a second time
        let streams = (location.search.match(/[?&]s=([^&]*)/) || [])[1];
        let main = Number(params.get("main")) || 0;
        if (!streams) {
            try {
                const saved = JSON.parse(this.read(MyWatchParty.STORAGE_KEY) || "{}");
                streams = saved.streams;
                main = saved.main || 0;
            } catch (e) {
                streams = null;
            }
        }

        const list = decodeStreams(streams);
        // Browsers block autoplay with sound until the user interacts, so restored streams start muted
        list.forEach((stream, i) => this.addStream(stream, { makeMain: i === main, muted: true, silent: true }));
        if (list.length) {
            this.announce("Restored " + list.length + " stream" + (list.length > 1 ? "s" : "") + ". Press the Unmute button to hear the main stream.");
        }
        this.update();
    }

    async copyShareLink() {
        const link = location.href;
        try {
            await navigator.clipboard.writeText(link);
            this.announce("Link copied. Anyone who opens it will see the same streams.");
        } catch (e) {
            prompt("Copy this link to share your watch party:", link);
        }
    }
}

if (typeof module !== "undefined") {
    module.exports = { parseStreamUrl, encodeStreams, decodeStreams };
} else {
    window.MwP = new MyWatchParty();
}
