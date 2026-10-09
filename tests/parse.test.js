const test = require("node:test");
const assert = require("node:assert");
const { parseStreamUrl, encodeStreams, decodeStreams } = require("../main.js");

const ok = (input, provider, kind, id) =>
    test(`parses ${input}`, () => {
        assert.deepStrictEqual(parseStreamUrl(input), { ok: true, stream: { provider, kind, id } });
    });

const fails = (input) =>
    test(`rejects ${input}`, () => {
        const result = parseStreamUrl(input);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error);
    });

ok("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ");
ok("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "youtube", "video", "dQw4w9WgXcQ");
ok("https://youtu.be/dQw4w9WgXcQ?si=abc", "youtube", "video", "dQw4w9WgXcQ");
ok("https://www.youtube.com/live/dQw4w9WgXcQ?si=abc", "youtube", "video", "dQw4w9WgXcQ");
ok("youtube.com/shorts/dQw4w9WgXcQ", "youtube", "video", "dQw4w9WgXcQ");
ok("https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow/live", "youtube", "channel", "UCSJ4gkVC6NrvII8umztf0Ow");
fails("https://www.youtube.com/@LofiGirl/live");
fails("https://www.youtube.com/watch?v=short");

ok("https://www.twitch.tv/shroud", "twitch", "channel", "shroud");
ok("https://www.twitch.tv/Shroud/", "twitch", "channel", "shroud");
ok("twitch.tv/shroud?sr=a", "twitch", "channel", "shroud");
ok("https://m.twitch.tv/shroud", "twitch", "channel", "shroud");
ok("https://www.twitch.tv/videos/123456", "twitch", "video", "123456");
fails("https://www.twitch.tv/directory");
fails("https://www.twitch.tv/shroud/clip/SomeClip");
fails("https://www.twitch.tv/");

ok("https://kick.com/xqc", "kick", "channel", "xqc");
ok("kick.com/Some-Streamer/", "kick", "channel", "some-streamer");
fails("https://kick.com/");

ok("https://www.facebook.com/watch/live/?v=123&ref=watch", "facebook", "video", "https://www.facebook.com/watch/live/?v=123&ref=watch");
ok("https://m.facebook.com/user/videos/123/#x", "facebook", "video", "https://www.facebook.com/user/videos/123/");

fails("");
fails("not a url at all");
fails("https://evil.com/?youtube.com");
fails("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ");

test("share links round-trip", () => {
    const streams = [
        { provider: "twitch", kind: "channel", id: "shroud" },
        { provider: "youtube", kind: "video", id: "dQw4w9WgXcQ" },
        { provider: "facebook", kind: "video", id: "https://www.facebook.com/watch/live/?v=1,2&a=b" },
        { provider: "kick", kind: "channel", id: "xqc" },
    ];
    assert.deepStrictEqual(decodeStreams(encodeStreams(streams)), streams);
});

test("broken share links are ignored", () => {
    assert.deepStrictEqual(decodeStreams("nope:1,tw:,yt:%E0%A4%A,tw:ok"), [{ provider: "twitch", kind: "channel", id: "ok" }]);
    assert.deepStrictEqual(decodeStreams(null), []);
});
