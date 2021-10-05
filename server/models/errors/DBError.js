const ServerError = require("./ServerError");

class DBError extends ServerError {
    constructor(name, message, status = 500) {
        let cname = "DBError";

        if (name instanceof Array) {
            name.push(cname);
        } else if (typeof(name) != "string") {
            name = cname;
        } else {
            name = [ name, cname ]
        }

        super(name, message, status || 500);
    }
}

module.exports = DBError;
