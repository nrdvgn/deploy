const config      = require("../config").services.iframe || {};
const ServerError = require("../models/errors/ServerError");

var ENGINE   = undefined;

if (config.tg_engine) {
    ENGINE = "https://telegra.ph/embed/$?url="

    if (config.width && typeof(config.width !== "number")) {
        config.width = 640
    }

    if (config.height && typeof(config.height !== "number")) {
        config.width = 360
    }
}

var DOM = "<iframe src=\"$\" width=\"" + (config.width || 640) + "\" " +
          "height=\"" + (config.height || 360) + "\" " +
          "frameborder=\"0\" allowtransparency=\"true\" " +
          "allowfullscreen=\"true\" scrolling=\"no\"</iframe>";



class IFrameError extends ServerError {
    constructor(service_name, message) {
        super("IFrameError", message + " (" + service_name + ")", 500);
    };
}



function __getVimeoSRC(url) {

    let engine = undefined;

    if (ENGINE) {
        engine  = ENGINE.split("$").join("vimeo");
        engine += "https%3A%2F%2Fvimeo.com%2F"
    } else {
        engine  = "https://player.vimeo.com/video/";
    }

    let video_id = url.split("?")[0].split("/").pop();

    if (Number(video_id) != NaN) {
        return engine + video_id;
    } else {
        throw new IFrameError("Vimeo", url + " - Video ID was not found");
    }
}


function __getYouTubeSRC(url) {

    let engine = undefined;

    if (ENGINE) {
        engine  = ENGINE.split("$").join("youtube");
        engine += "https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D"
    } else {
        engine  = "https://www.youtube.com/embed/";
    }

    let video_id = url.split("?");

    if (video_id.length > 1) {
        video_id = video_id.slice(1).join("?");
    } else {
        throw new IFrameError("YouTube", url + " - Url is not contains the video ID");
    }

    video_id = video_id.match(/v=([^&]+)/);

    if (video_id && video_id.length > 1) {
        video_id = video_id[1];
    } else {
        throw new IFrameError("YouTube", url + " - Video ID was not found");
    }

    return engine + video_id;
}


function __getTwitterSRC(url) {
    /* It is not recommended to use it without tg_engine */

    let engine = undefined;

    if (ENGINE) {
        engine = ENGINE.split("$").join("twitter");
    } else {
        engine = "https://twitframe.com/show?url=";
    }

    return engine + encodeURIComponent(url);
}


function getIFrame(url) {

    let src  = undefined;
    let wrap = DOM.split("$");
    url      = decodeURIComponent(url);

    if (url.match(/(\/\/|www.)youtube.com/)) {
        src = __getYouTubeSRC(url);
    } else if (url.match(/(\/\/|www.)vimeo.com/)) {
        src = __getVimeoSRC(url);
    } else if (url.match(/(\/\/|www.)twitter.com/)) {
        src = __getTwitterSRC(url);
    } else {
        throw new IFrameError("General", url + " - Unsupported iframe type");
    }

    return wrap.join(src);
}

module.exports = getIFrame;
