const express           = require('express');
const config            = require('./config');
const cors              = require('cors');
const APIError          = require("./models/errors/APIError");
const MainController    = require("./controllers/Main");
const AuthController    = require("./controllers/Auth");
const ArticleController = require("./controllers/Article");
const AccountController = require("./controllers/Account");
const LoginController   = require("./controllers/Login");
const MediaController   = require("./controllers/Media");
const { urlencoded }    = require('body-parser');

const app = express();

app.use(cors(config.cors))
// app.use(urlencoded({extended:true}))

app.use((req, res, next) => {
    console.log(req.method, req.url)
    next()
})

app.use(MainController);
app.use(AuthController);

app.use("/articles", async (req, res, next) => {
    try { await ArticleController(req, res, next); } catch (e) { next(e); }
});

app.use("/login", async (req, res, next) => {
    try { await LoginController(req, res, next); } catch (e) { next(e); }
});

app.use("/account", async (req, res, next) => {
    try { await AccountController(req, res, next); } catch (e) { next(e); }
});

app.use(config.directory.route, async (req, res, next) => {
    try { await MediaController(req, res, next); } catch (e) { next(e); }
});


app.use("/",(req,res,next)=>{ res.forbidden(); });
app.use((err,req,res,next)=>{
    res.failure(err.toString(), err.status || 500)
    console.log(err)
});


const main = () => {
    try {
        let port = config.port || 8080;
        let host = config.host || "127.0.0.1"

        app.listen(port, host, () => {
            console.log('Server is running on ' + host + ":" + port.toString());
        })
    } catch (e) { APIError.log(e) }
}

main()
