





function controller(req,res,next) {
    switch (req.method) {
        case "GET":
        case "POST":
        case "DELETE":
        case "PUT":
        case "PATCH":
        default: return res.bad();
    }
}




module.exports = controller;
