const APIError = require("./APIError");

class ServerError extends APIError {
    constructor(name, message, status) {
        let cname = "ServerError";

        if (name instanceof Array) {
            name.push(cname);
        } else if (typeof(name) != "string") {
            name = cname;
        } else {
            name = [ name, cname ]
        }

        super(name, "FATAL", message, status || 500);
    }
}

module.exports = ServerError;
