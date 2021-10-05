const fs       = require("fs");
const config   = require("../../config");
const mode     = (config.project.mode || "release").toUpperCase()

let __is_initialized = false;
let __trace_fd       = 1;
let __log_fd         = undefined;

const __http_sn = {
    100: "Continue",
    101: "Switching Protocols",
    200: "Ok",
    201: "Created",
    202: "Accepted",
    203: "Non Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request Uri Too Large",
    415: "Unsupported Media Type",
    416: "Request Range Not Satisfiable",
    417: "Expectation Failed",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported"
}


class APIError extends Error {


    static debug(message) {
        if (mode === "DEBUG") {
            console.log("[DEBUG] " + (new Date()).toISOString() + ": " + message)
        }
    }



    static trace(message) {
        if (__trace_fd) {
            fs.writeSync(__trace_fd, message + "\n");
        }
    }



    static log(message) {

        if (!__is_initialized && config.log_path) {
            if (__log_fd && __log_fd > 2) { fs.close(__log_fd); }
            try {
                __log_fd = fs.openSync(config.log_path, "a");
            } catch (e) {
                __log_fd = 2;
            }
            __is_initialized = true;
        } else if (!__is_initialized) {
            __log_fd = 2;
            __is_initialized = true;
        }

        try {
            fs.writeSync(__log_fd, message + "\n");
        } catch (e) {
            __is_initialized = false;
            log(message);
        }
    }


    static disableTrace() {
        if (__trace_fd && __trace_fd > 2) {
            fs.close(__trace_fd);
        }

        __trace_fd = undefined;
    }



    static enableTrace(fd = 1) {
        __trace_fd = fd;
    }



    static isCorrectHTTPStatus(status) {
        return Boolean(__http_sn[status]);
    }



    static geHTTPStatusByName(name) {
        for (i in __http_sn) {
            if (__http_sn[i] === name) {
                return i;
            }
        }
        return undefined;
    }



    static getHTTPStatusName(status) {
        return __http_sn[status];
    }



    #date = undefined;

    log(e) { if (e) APIError.log(e); }

    toString() {
        let str  = "["  + this.type                + "] ";
            str +=        this.name                + ": ";
            str +=        this.message                  ;
            str += " (" + this.#date.toISOString() + ")" ;

        return str;
    }

    constructor(name, type, message, status) {
        let cname = "APIError";

        super(message || "Contact with administrator");

        if (name instanceof Array) {
            name.push(cname);
            super.name = name.reverse().join(".");
        } else if (typeof(name) != "string") {
            super.name = cname;
        } else {
            super.name = cname + "." + name;
        }

        this.type   = type || "INFO";
        this.status = (APIError.isCorrectHTTPStatus(status)) ? status : 500;
        this.#date  = new Date();
    }
}

module.exports = APIError;
