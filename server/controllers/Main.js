const fs           = require("fs");
const config       = require("../config");
const getMIMEType  = require("../models/System").getMIMEType
const isFileExists = require("../models/System").isFileExists

let __defaults = {
    bad:          "",
    forbidden:    "",
    notfound:     "",
    notallowed:   "",
    unauthorized: ""
}



function __getDataView(data) {

    // See: /docs/schemas/API/ResponseModel.jpg

    switch(typeof(data)) {
        case "object":

            if (data instanceof Buffer)     return { blob: data.toString("base64") };
            else if (data instanceof Array) return { values: data };
            else                            return { struct: Object.fromEntries(Object.entries(data)) };

        case "number":

            if (Number.isInteger(data))    return { code: data }
            else if (Number.isNaN(data))   return { point: { value: 0.0000, isNan: true } }

            else if (data  === Infinity || data === -Infinity)
                 return { point: { value: 0.0000, isInf: true, isNegative: Boolean(data === -Infinity) } }
            else return { point: { value: data } }

        case "string":  return { message: data };
        case "boolean": return { result: data  };

        default: return null;
    }

}


function __fetchRouteInfo(url) {

    url = decodeURIComponent(url);
    url = url.split("#")[0].split("?");
    url[0] += "/";

    let res = {
        entries: url.slice(1).join("?"),
        path:    url[0].replace(/\/+/g, "/").split("/"),
        name:    ""
    }

    res.path.pop();

    if (res.entries) {
        res.entries = res.entries.split("&");

        for (let i = 0; i < res.entries.length; ++i) {
            res.entries[i] = res.entries[i].split("=");
            if (res.entries[i].length == 1) {
                res.entries[i].push("");
            }

            if (res.entries[i].length > 2) {
                res.entries[i][1] = res.entries[i].splice(1).join("=");
            }
        }
    } else res.entries = [];

    if (res.path.length <= 2 && !res.path[1]) {
        res.path = "/";
    } else if (res.path.length == 2) {
        res.name = res.path[1];
        res.path = "/";
    } else {
        res.name = res.path.splice(1,1)[0];
        res.path = res.path.join("/");
    }

    return res;
}


function __extendRes(res) {

    res.bad = function(message = __defaults.bad) {
        this.status(400).
             send(message);
    }

    res.forbidden = function(message = __defaults.forbidden) {
        this.status(403).
             send(message);
    }

    res.notfound = function(message = __defaults.notfound) {
        this.status(404).
             send(message);
    }

    res.notallowed = function(message = __defaults.notallowed) {
        this.status(405).
             send(message);
    }

    res.unauthorized = function(message = __defaults.unauthorized) {
        this.status(401).
             send(message);
    }

    res.success = function(data = null, status = 200) {
        this.status(status).
             set("Content-Type", "application/json").
             send({ success: true, data: __getDataView(data) });
    }

    res.failure = function(data = "Contact with administrator", status = 500) {
        this.status(status).
             set("Content-Type", "application/json").
             send({ success: false, data: __getDataView(data) });
    }

    res.file = function(path) {
        let paths = [ config.directory.upload + path, path ];

        for (let i = 0; i < paths.length; ++i) {
            if (isFileExists(paths[i])) {
                this.status(200).
                     set("Content-Type", getMIMEType(paths[i])).
                     send(fs.readFileSync(paths[i]));
                return;
            }
        }

        this.notfound();
    }
}


function __extendReq(req, res) {

    req.getUrlEncodedDataEntries = function() {
        let type = this.get("Content-Type");
        if ((this.method === "POST") && (type === "application/x-www-form-urlencoded")) {
            try {
                __fetchEntries(this.body.toString)
            } catch (e) {
                res.bad();
            }
        } else if (type === "application/json") {
            res.notallowed();
        } else {
            res.forbidden();
        }
    }

    req.getBinaryData = function() {
        let type = this.get("Content-Type");
        if ((this.method === "POST" || this.method === "PUT") && (type === "application/octet-stream")) {
            return this.body;
        } else if (type === "application/octet-stream") {
            res.notallowed();
        } else {
            res.forbidden();
        }
    }

    req.getJsonData = function() {
        let type = this.get("Content-Type");
        if ((this.method === "POST" || this.method === "PUT" || this.method === "PATCH") && (type === "application/json")) {
            try {
                return JSON.parse(this.body.toString());
            } catch (e) {
                res.bad();
            }
        } else if (type === "application/json") {
            res.notallowed();
        } else {
            res.forbidden();
        }
    }
}


function controller(req,res,next) {

    req.body  = [];
    req.route = __fetchRouteInfo(req.originalUrl);

    __extendRes(res);
    __extendReq(req, res);
    req.setEncoding("binary");
    req.on("data", (c) => { req.body.push(Buffer.from(c, "binary")); });
    req.on("end",  ( ) => { req.body = Buffer.concat(req.body); next(); });
}


module.exports = controller;
