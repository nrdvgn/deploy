const APIError = require("./APIError");

class AccessError extends APIError {
    constructor(name, message, status) {
        let cname = "AccessError";

        if (name instanceof Array) {
            name.push(cname);
        } else if (typeof(name) != "string") {
            name = cname;
        } else {
            name = [ name, cname ]
        }

        super(name, "ERROR", message, status || 403);
    }
}

module.exports = AccessError;
