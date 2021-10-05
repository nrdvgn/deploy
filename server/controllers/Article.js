const provider     = require("../models/db/ArticleProvider");
const RequestError = require("../models/errors/RequestError");
const ServerError  = require("../models/errors/ServerError");


let lregexp = require("../models/System").getLanguageSupport();


for (let i = 0; i < lregexp.length; ++i) {
    lregexp[i] = lregexp[i].code;
}

lregexp = new RegExp("^(" + lregexp.join("|") + ")$");


function __fetchData(data, auth) {

    if (data && (auth.authoritative || auth.user == data.uploader || data.display)) {
        return {
            content:  data.content,
            title:    data.title,
            language: data.language,
            category: data.category,
            author:   data.author || data.user,
            image:    data.image,
            date:     data.date.toISOString(),
            tags:     data.tags,
            display:  data.display
        };
    }

    return null;
}



async function __general(req, res, next) {

    let entries = undefined;
    let result  = undefined;

    switch (req.method) {

        case "DELETE":
            if (!req.auth.authoritative) { return res.unauthorized(); }

        case "GET":

            entries         = Object.fromEntries(req.route.entries);

            let fetch_value = (x) => {
                if (x) return Number(x.match(/^\d+/));
                else   return 0;
            }

            entries.limit   = fetch_value(entries.limit);
            entries.page    = fetch_value(entries.page);
            entries.offset  = fetch_value(entries.offset);
            entries.preview = fetch_value(entries.preview);

            if (!entries.displayed) entries.displayed = 0;
            else entries.displayed = Number(entries.displayed) ? 1 : -1;

            if (req.method == "GET") {
                result = await provider.readMany(req.route.query, entries.limit, entries.page, entries.offset, entries.displayed, entries.tag);

                let data = [];
                for (let i = 0; i < result.length; ++i) {
                    let d = __fetchData(result[i], req.auth);
                    if (d) {
                        if (entries.preview > 0) {
                            d.content = d.content.replace(/<(a|h1|figure)[^>]*>[^<]+<\/(a|h1|figure)>/g, " ")
                                                 .replace(/<[^>]+>/g, " ")
                                                 .replace(/\s+/g, " ")
                                                 .replace(/\.{2} /g, ". ")
                                                 .slice(0, entries.preview);
                        }
                        
                        data.push(d);
                    }
                }
                result = data;

                return res.success(result);
            } else return res.success(await provider.deleteMany(req.route.query, entries.limit, entries.page, entries.offset, entries.displayed, entries.tag));


        case "POST":
            if (!req.auth.user) { return res.unauthorized(); }

            entries = req.getJsonData();

            if (!entries.category && req.route.query.category) entries.category = req.route.query.category;
            if (!entries.language && req.route.query.language) entries.language = req.route.query.language;

            if (entries instanceof Array) {
                for (let i = 0; i < entries.length; ++i) {
                    entries[i].user    = req.auth.user;
                    entries[i].display = Boolean(req.auth.authoritative) || false;
                }

                result = await provider.createMany(entries)

            } else if (typeof(entries) === "object") {
                entries.user    = req.auth.user;
                entries.display = Boolean(req.auth.authoritative) || false;

                result = await provider.createOne(entries)
            } else return res.bad();

            return res.success(result);


        case "PATCH":
            if (!req.auth.authoritative) { return res.unauthorized(); }

            entries = req.getJsonData();

            if (typeof(entries.display) != "boolean" || entries.length > 1) {
                return res.bad();
            }

            return res.success(await provider.updateMany(req.route.query, entries));

        case "PUT":
        default: return res.bad();
    }

}

async function __entry(req, res) {

    let entries = undefined;
    let result  = undefined;

    switch (req.method) {
        case "GET":
            result = __fetchData(await provider.readOne(req.route.query), req.auth);
            if (result) return res.success(result);
            else return res.notfound();

        case "POST": // translate
            if (!req.auth.user) { return res.unauthorized(); }

            entries = req.getJsonData();
            result  = await provider.translateOne(req.route.query, req.getJsonData());

        case "PUT":
            if (!req.auth.authoritative) {
                result = await provider.readOne(req.route.query);

                if (result.user !== req.auth.user)
                    return res.unauthorized();
            }

            entries = req.getJsonData();
            return res.success(await provider.updateOne(req.route.query, entries, 0));

        case "PATCH":
            if (!req.auth.authoritative) {
                result = await provider.readOne(req.route.query);

                if (result.user !== req.auth.user)
                    return res.unauthorized();
            }

            entries = req.getJsonData();
            return res.success(await provider.updateOne(req.route.query, entries, 1));

        case "DELETE":
            if (!req.auth.authoritative) { return res.unauthorized(); }
            return res.success(await provider.deleteOne(req.route.query));

        default: return res.bad();
    }
}




async function controller(req, res, next) {

    // See /docs/schemas/API/ArticleEndpoint.jpg

    req.route.query = {};

    if (req.route.path === "/" || req.route.path.trim() === "") {
        await __general(req, res);
        return;
    }

    let entries = req.route.path.split("/");

    switch (entries.length) {

        case 0: case 1: throw new ServerError("UnexpectedRequest", "Route path is inconsistent");

        case 2:
            if (entries[1].match(/^[0-9a-zA-Z]{24}$/)) {
                req.route.query._id = entries[1];
                await __entry(req, res);
                break;

            } else if (entries[1].match(lregexp)) {
                req.route.query.language = entries[1];
            } else {
                req.route.query.category = entries[1];
            }

            await __general(req, res);
            break;

        case 3:
            if (entries[2].match(lregexp)) {
                req.route.query.language = entries[2];
            } else throw new RequestError("UnexpectedPath", "Language route is unexpected");

            req.route.query.category = entries[1];
            await __general(req, res);
            break;

        default: // more than 4
            entries[3] = entries.splice(3).join("/");
        case 4:
            if (entries[2].match(lregexp)) {
                req.route.query.language = entries[2];
            } else throw new RequestError("UnexpectedPath", "Language route is unexpected");

            req.route.query.category = entries[1];
            req.route.query.title    = entries[3];

            await __entry(req, res);
            break;
    }
}

module.exports = controller;
