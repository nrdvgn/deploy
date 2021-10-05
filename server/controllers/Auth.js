




function __DEBUG__(req, isAuthoritative = true) {
    req.auth               = {};
    req.auth.user          = "DEBUG_USER"
    req.auth.authoritative = isAuthoritative;
}


function controller(req,res,next) {
    __DEBUG__(req, true);
    next();
}




module.exports = controller;
