class MyWatchParty {

    /** Potential video url */
    videoUrl;

    /** Index for opened windows */
    videoWindows;

    /** Reference list of video active players */
    videoPlayers;

    /** The main video container that will hold all players */
    container;

    /** The main big add video button */
    mainAddVideoButton;

    /**
     * 
     */
    constructor() {
        document.addEventListener("keydown", (ev) => this.keyListener(ev));

        this.container = document.getElementById("container");
        this.mainAddVideoButton = document.getElementById("add-video");

        this.videoWindows = 0;

        this.videoPlayers = {};
    }

    /**
     * Allow user to enter video url
     */
    openLoadDialog() {
        if (this.videoUrl = prompt("Copy video url from Twitch, YouTube or Facebook")) {
            this.processVideoUrl();

            this.toggleMainButton();
        }

    }

    /**
     * Toggle the main video button (show/hide)
     */
    toggleMainButton() {
        if (this.videoWindows > 0) {
            this.mainAddVideoButton.classList.add('hidden')
        } else {
            this.mainAddVideoButton.classList.remove('hidden')
        }
    }

    /**
     * Start processing the video and create HTML embed if all fine
     */
    processVideoUrl() {
        if (this.isValidUrl()) {
            this.loadAndDisplayVideo();
        } else {
            alert("Invalid video url")
        }
    }

    /**
     * Check if entered video url is supported
     * @returns bool
     */
    isValidUrl() {
        return this.videoUrl.includes("youtube.com")
            || this.videoUrl.includes("youtu.be")
            || this.videoUrl.includes("twitch.tv")
            || this.videoUrl.includes("facebook.com");
    }

    /**
     * Create HTML element and embed player
     */
    loadAndDisplayVideo() {
        let videoFrame = document.createElement("div");
        videoFrame.id = "my-watch-party-" + this.videoWindows;
        videoFrame.dataset.playerId = this.videoWindows;
        videoFrame.classList.add("w-full", "aspect-video");
        this.container.append(videoFrame);

        this.createEmbedVideo(videoFrame);

        this.videoWindows++;
    }

    /**
     * Find proper video provider and create its player
     */
    createEmbedVideo(videoFrame) {
        const provider = this.getVideoProvider()
        videoFrame.dataset.provider = provider;

        switch (provider) {
            case "twitch":
                this.embedTwitch()
                break;

            case "youtube":
                this.embedYoutube()
                break;

            case "facebook":
                this.embedFacebook()
                break;

            default:
                break;
        }
    }

    /**
     * Create player for Twitch
     */
    embedTwitch() {
        let options = {
            width: "100%",
            height: "100%",
            channel: this.videoUrl.substring(this.videoUrl.lastIndexOf("/") + 1)
        };

        this.videoPlayers["mvp-" + this.videoWindows] =
            new Twitch.Player("my-watch-party-" + this.videoWindows, options);
    }

    /**
     * Create player and start youtube video
     */
    embedYoutube() {
        let videoId = "";
        if (this.videoUrl.includes("youtu.be")) {
            videoId = this.videoUrl.substring(this.videoUrl.lastIndexOf("/") + 1);
        } else {
            const regex = /(watch\?v\=)(.*)\&/;
            videoId = this.videoUrl.match(regex)[2];
        }

        const youtubeOptions = {
            width: "100%",
            height: "100%",
            videoId,
            events: {
                'onReady': this.onYoutubePlayerReady
            }
        };
        this.videoPlayers["mvp-" + this.videoWindows] =
            new YT.Player("my-watch-party-" + this.videoWindows, youtubeOptions);
    }

    /**
     * Play youtube when ready
     * @param {*} event 
     */
    onYoutubePlayerReady(event) {
        event.target.setVolume(100);
        event.target.playVideo();
    }

    /**
     * Embed video from Facebook
     */
    embedFacebook() {
        let videoDiv = document.getElementById("my-watch-party-" + this.videoWindows);

        let fbEmbed = document.createElement("iframe");
        fbEmbed.src = "https://www.facebook.com/plugins/video.php?href=" + this.videoUrl;
        fbEmbed.width = "100%";
        fbEmbed.height = "100%";
        fbEmbed.style = "border:none;overflow:hidden";
        fbEmbed.scrolling = "no";
        fbEmbed.frameborder = "0";
        fbEmbed.allowfullscreen = "true";
        fbEmbed.allow = "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";

        videoDiv.append(fbEmbed);
    }

    /**
     * Gets the video provider service
     * @returns string
     */
    getVideoProvider() {
        if (this.videoUrl.includes("youtube.com")
            || this.videoUrl.includes("youtu.be"))
            return "youtube";
        if (this.videoUrl.includes("twitch.tv"))
            return "twitch";
        if (this.videoUrl.includes("facebook.com"))
            return "facebook";
    }

    /**
     * Binds specific keyboard shortcuts
     * 
     * @param {KeyboardEvent} event 
     * @returns void
     */
    keyListener(event) {
        const keyName = event.key;

        if (keyName === "+") {
            // Open the video url dialog
            this.openLoadDialog();
            return;
        }

        if (event.ctrlKey) {
            // Even though event.key is not "Control" (e.g., "a" is pressed),
            // event.ctrlKey may be true if Ctrl key is pressed at the same time.
            console.log(`Combination of ctrlKey + ${keyName}`);
        } else {
            console.log(`Key pressed ${keyName}`);
        }
    }
}