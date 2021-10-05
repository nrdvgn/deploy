
const fetch     = require('node-fetch');
const defaults  = require("../config").defaults;
const directory = require("../config").directory;
const APIError  = require("./errors/APIError");
const exec      = require("child_process").execSync
const fs        = require("fs");

class SystemError extends APIError {
    constructor(message, e = undefined) {
        super("SystemError", "FATAL", message, 500);
        super.log(e);
    }
}



// ======================
//    GENERAL BLOCK
// ======================


function getDateAfter(d, h = 0, m = 0, s = 0) {

    h += d * 24;
    m += h * 60;
    s += m * 60;

    s += Math.round(Date.now()/1000);

    return new Date(s*1000)
}



function hasType(obj, type) {

    switch (type) {
        case String:
            return typeof(obj) === "string";
        case Number:
            return typeof(obj) === "number";
        case Boolean:
            return typeof(obj) === "boolean";
        case Object:
            return typeof(obj) === "object";
        case "array":
            return obj instanceof Array;
        case undefined:
            return obj === null;

        default:
            if (typeof(type) === "string")   return typeof(obj) === type;
            if (typeof(type) === "function") return obj instanceof type;

            throw new SystemError("Unexpected type value");
    }
}

// ======================






// ======================
//    LANGUAGE BLOCK
// ======================

function getLanguageSupport() { return [
    { code: "be", international: "Belarusian", local: "Беларуская мова"  },
    { code: "bs", international: "Bosnian",    local: "Bosanski jezik"   },
    { code: "bg", international: "Bulgarian",  local: "Български език"   },
    { code: "cs", international: "Czech",      local: "Čeština"          },
    { code: "en", international: "English",    local: "English"          },
    { code: "fr", international: "French",     local: "Français"         },
    { code: "de", international: "German",     local: "Deutsch"          },
    { code: "el", international: "Greek",      local: "Ελληνικά"         },
    { code: "it", international: "Italian",    local: "Italiano"         },
    { code: "mk", international: "Macedonian", local: "Македонски јазик" },
    { code: "pl", international: "Polish",     local: "Język polski"     },
    { code: "pt", international: "Portuguese", local: "Português"        },
    { code: "ro", international: "Romanian",   local: "Română"           },
    { code: "ru", international: "Russian",    local: "Русский"          },
    { code: "sr", international: "Serbian",    local: "Српски језик"     },
    { code: "sk", international: "Slovak",     local: "Slovenčina"       },
    { code: "sl", international: "Slovenian",  local: "Slovenščina"      },
    { code: "es", international: "Spanish",    local: "Español"          },
    { code: "sv", international: "Swedish",    local: "Svenska"          },
    { code: "uk", international: "Ukrainian",  local: "Українська"       },
]}



let __lregexp = getLanguageSupport();


for (let i = 0; i < __lregexp.length; ++i) {
    __lregexp[i] = __lregexp[i].code;
}

__lregexp = new RegExp("^(" + __lregexp.join("|") + ")$");


function isCorrectLanguage(lang) {
    return Boolean(lang.match(__lregexp));
}



function getLanguageCode(lang) {

    if (typeof(lang) === "string") {
        lang = lang.split("-")[0].split("_")[0].slice(0,2).toLowerCase();
    }

    if (isCorrectLanguage(lang)) return lang;
    else return defaults.language;
}
// ======================






// ======================
//    DOWNLOAD BLOCK
// ======================

function __getRandomFilename(mime = undefined) {
    const exts = {
        "audio/mp4":        "m4a",
        "audio/mpeg":       "mp3",
        "audio/ogg":        "ogg",
        "image/bmp":        "bmp",
        "image/gif":        "gif",
        "image/jpeg":       "jpg",
        "image/png":        "png",
        "image/svg+xml":    "svg",
        "image/tiff":       "tiff",
        "video/3gpp":       "3gp",
        "video/mp4":        "mp4",
        "video/mpeg":       "mpeg",
        "video/ogg":        "ogv",
        "audio/midi":       "midi",
        "audio/x-flac":     "flac",
        "audio/x-ms-wma":   "wma",
        "audio/x-wav":      "wav",
        "video/x-matroska": "mkv",
        "video/x-ms-wmv":   "wmv",
        "video/x-msvideo":  "avi",
    }

    let i = 0;
    let n = Buffer.alloc(48)

    do {
        n[i] = Math.floor(Math.random()/0.0000001)%16;
        n[i] = (n[i] < 0x0a) ? (n[i] | 0x30) : ((n[i] | 0x60) - 9)
    } while(++i < 48);

    return n.toString() + ((mime && exts[mime]) ? "." + exts[mime] : "");
}

function isFileExists(filename) {
    try {
        fs.statSync(filename);
        return true;
    } catch (e) { return false; }
}

function getMIMEType(filename) {
    if (isFileExists(filename)) {
        return exec("file -b --mime-type " + filename).toString().trim();
    } else return ""
}

function save(buffer, mime = undefined) {

    let filename = undefined;

    if (typeof(buffer) === "string") {
        let b = buffer.match(/data:([a-z/]+)\s*;\s*base64\s*,\s*([A-Za-z0-9+\/]+={0,3})/);

        if (b && b[1] && b[2] && Number.isInteger(b[2].length / 4)) {
            mime = b[1];
            b    = Buffer.from(b[2], "base64");
        } else if ((b = buffer.match(/^[A-Za-z0-9+\/]+={0,3}$/)) && b[0]) {
            b    = Buffer.from(b[0], "base64");
        } else throw new SystemError("Incorrect data to write");

        buffer = b;
    }

    if (buffer instanceof Buffer) {

        let fd = undefined;

        if (!mime) {
            do {
                filename = directory.temp + "/" + __getRandomFilename();
            } while (isFileExists(filename))

            fd = fs.openSync(filename, "w");
            fs.writeSync(fd, buffer);
            fs.close(fd);

            mime = getMIMEType(filename);

            fs.rmSync(filename);
        }

        do {
            filename = directory.upload + "/" + __getRandomFilename(mime);
        } while (isFileExists(filename));

        fd = fs.openSync(filename, "w");
        fs.writeSync(fd, buffer);
        fs.close(fd);

    } else throw new SystemError("Incorrect data to write");

    return directory.route + "/" + filename.split("/").pop();
}



async function fetchExternal(url) {
    try {
        return await fetch(url);
    } catch (e) { throw new SystemError("Error was occured with fetching data by url", e); }
}



async function downloadExternal(url) {

    let content = await fetchExternal(url);
    let type    = content.headers.get("content-type");

    try {
        content = await content.buffer();
    } catch (e) { throw new SystemError("Error was occured with fetching data content", e); }

    return save(content, type);
}


function removeInternal(filename) {

    if (!filename) return 0;

    if (filename.match(new RegExp("^" + directory.route + "/[0-9a-z]{48}(\.[a-z]{0,4})?$"))) {
        filename = directory.upload + "/" + filename.split(directory.route + "/")[1];
    } else if (filename.match(/^\/[0-9a-z]{48}(\.[a-z]{0,4})?$/)) {
        filename = directory.upload + filename;
    } else if (!(filename.match(new RegExp("^" + directory.upload + "/[0-9a-z]{48}(\.[a-z]{0,4})?$")))) {
        throw new SystemError("Unexpected filename (" + filename + ")");
    }

    if (isFileExists(filename)) {
        fs.rmSync(filename);
        return 1;
    }

    return 0;
}

// ======================





module.exports = {
    getLanguageSupport, getLanguageCode, isCorrectLanguage,

    getDateAfter, hasType,

    save, fetchExternal, downloadExternal, removeInternal,

    getMIMEType, isFileExists
}
