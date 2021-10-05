#!/usr/bin/env node

const fs     = require("fs");
const exec   = require("child_process").execSync
const path   = require("path");
const extend = require("extend");

let config = {
  port: process.env.PORT || 8080,
  mongodb: {
    url: 'mongodb://127.0.0.1:27017/articles' || "mongodb+srv://user:6HnhZG5eseJKVJc@cluster0.841ly.mongodb.net/db1?retryWrites=true&w=majority",
    options: {
        useNewUrlParser:    true,
        useUnifiedTopology: true
    }
  },
  project: {
    name: path.dirname(path.dirname(__filename)).split("/").pop(),
    mode: "debug",
  },
  services: {
    iframe: {
      tg_engine: true,
      width: 640,
      height: 360,
    },
  },
  directory: {
    upload: __dirname + "/static",
    route:  "/file",
    log:    "/var/log",
    temp:   exec("if [ -d /run/user/$(id -u) ]; then echo /run/user/$(id -u); else mkdir -pm 0700 /var/tmp/run/user/$(id -u) && echo /var/tmp/run/user/$(id -u); fi").toString().trim()
  },
  defaults: {
    language: "ru",
    article_category: "article"
  },
  jwt: {
    accessSecret: process.env.ACCESS || "mysecret-lk3k5jhh643bhg32vhgr3",
    refreshSecret: process.env.REFRESH || "mysecret-wifmsc39zpqksc93nfds4",
  },
  cors: {
    origin: process.env.ORIGIN || ["http://localhost:3000", "http://localhost:5000"],
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
}


try {
    config = extend(true, config, require("./env-config.js"));
} catch (e) {}

if (process.argv[1] === __filename) {
    console.log(config.directory.temp);
} else {

    config.log_path = (config.directory.log)
        ? config.directory.log + "/" + config.project.name || "project-18" + ".log"
        : undefined;


    try {
        fs.statSync(config.directory.upload);
    } catch (e) {
        fs.mkdirSync(config.directory.upload, { recursive: true } );
    }

    module.exports = config;
}
