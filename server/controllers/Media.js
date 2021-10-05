const System = require("../models/System")

function controller(req,res,next) {
    switch (req.method) {
        case "GET":    return res.file(req.route.path)
        case "POST":   return res.success({ path: System.save(req.getBinaryData()) });
        case "DELETE": return res.success(System.removeInternal(req.route.path));

        case "PUT":
        case "PATCH":
        default: return res.bad();
    }
}

module.exports = controller;
