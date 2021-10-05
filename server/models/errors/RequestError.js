const APIError = require("./APIError");

class RequestError extends APIError {
    constructor(name, message, status) {
        let cname = "RequestError";

        if (name instanceof Array) {
            name.push(cname);
        } else if (typeof(name) != "string") {
            name = cname;
        } else {
            name = [ name, cname ]
        }

        super(name, "WARNING", message, status || 400);
    }
}

module.exports = RequestError;
