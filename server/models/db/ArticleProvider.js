const System    = require("../System");
const DBError   = require("../errors/DBError");
const directory = require("../../config").directory;
const defaults  = require("../../config").defaults;
const TParser   = require("../parsing/Telegraph");
const Handler   = require("../DB").DBHandler;

let __tregexp = /^https?:\/\/telegra.ph\/\S+$/;
let __dregexp = new RegExp("^" + directory.route + "/[0-9a-z]{48}(\.[a-z]{0,4})?$");
let __wregexp = /https?:\/\//;

class DBArticleProviderError extends DBError {
    constructor(message) { super("ArticleProvider", message); }
}

class UnexpectedData extends DBArticleProviderError {
    constructor(code) { super("Unexpected Data (0x" + code.toString(16) + ")"); }
}

const __S = {
    _gid:     { type: String, default:  "" },
    title:    { type: String, required: true },

    content:  { type: String, required: true },
    category: { type: String, required: true },
    language: { type: String, required: true },

    uploader: { type: String, required: true },
    author:   { type: String, default:  "" },

    image:    { type:  String, default: "" },
    display:  { type: Boolean, default: false },

    date:     { type:    Date, required: true },
    tags:     { type:   Array, default:  [] }
};

const __R = {
    display: {
        code: 0x01,
        check: (e) => { return true; }
    },
    category: {
        code: 0x02,
        check: (e) => { return Boolean(e.match(/^[a-z][a-z0-9]+$/)); }
    },
    language: {
        code: 0x04,
        check: (e) => { return System.isCorrectLanguage(e); }
    },
    title: {
        code: 0x08,
        check: (e) => { return !Boolean(e.match(/[\\\/<>\{\}]/)); }
    },
    author: {
        code: 0x10,
        check: (e) => { return !Boolean(e.match(/[\\\/<>\{\}]/)); }
    },
    image: {
        code: 0x20,
        check: (e) => { return e.match(__wregexp) || e.match(__dregexp); }
    },
    tags: {
        code: 0x40,
        check: (e) => { for (let i in e) { if (typeof(e[i]) != "string") { return false; } } return true; }
    },
    content: {
        code: 0x80,
        check: (e) => { return e.match(__tregexp) || !e.match(/<\/?([Ss][Cc][Rr][Ii][Pp][Tt]|[Ff][Oo][Rr][Mm]|[Ll][Ii][Nn][Kk])>/) }
    }
}



function __checkData(data, code = 0x00) {

    let result = 0x0000;

    if (!data || data.length == 0)
        return undefined;

    for (k in __R) {
        if ((!code || (code && __R[k].code&code)) && data[k] != undefined) {
            result |= (__R[k].code);

            if (!System.hasType(data[k], __S[k].type) || !__R[k].check(data[k])) {
                result |= __R[k].code << 8;
            }
        }
    }

    return result;
}



function __getTitle(content) {
    let d = undefined;

    for (let i = 1; i <= 6; ++i) {
        let regexp = new RegExp("/<h" + i.toString() + "[^>]*>([^<])</");

        if ((d = content.match(regexp)) && d[1]) {
            return d[1];
        }
    }

    if ((d = content.match(/<p[^>]*>([^<])</))) {

        if (!(d = d[1])) throw new UnexpectedData(__R.title.code)
        d = d.replace(/<[^>]+>/g, " ").replace(/\s+/, " ");

        if (d.length <= 128) return d;
        d = d.slice(0, 128).split(" ");
        d.pop();
        return d.join(" ");
    }

    throw new UnexpectedData(__R.title.code)
}



function __getImage(content) {
    let d = content.match(/<img src="([^"]+)" \/>/);
    if (d) return d[1];
    else   return undefined;
}



async function __compileOne(data) {

    let dcode = __checkData(data);

    if (dcode&0xff00 || !(dcode&__R.content.code))
        throw new UnexpectedData(dcode);

    if (data.user) {
        data.uploader = data.user;
        delete data.user;
    }

    if (data.content.match(__tregexp)) {
        let p = new TParser(data.content);
        data.content = await p.toString();

        if (!(dcode&__R.title.code)) {
            data.title = (await p.getTitle()).trim();
        }

        data.image  = await p.getImage();
        data.author = await p.getAuthor();

    } else {
        if (!(dcode&__R.title.code)) {
            data.title = __getTitle(data.content);
        }

        if (!(dcode&__R.image.code)) {
            let i = __getImage(data.content);
            if (i) data.image = i;
        }
    }

    if (!(dcode&__R.category.code)) {
        data.category = defaults.article_category;
    }

    if (!(dcode&__R.language.code)) {
        data.language = defaults.language;
    }

    if (!(dcode&__R.display.code)) {
        data.display = false;
    }

    if (data.image) {

        if (data.image.match(__wregexp)) {
            data.image = await System.downloadExternal(data.image);

        } else if (!data.image.match(__dregexp)) {
            delete data.image;
        }
    }

    data.title = data.title.replace(/\//g, "|")

    data.date = Date.now();

    return data;
}



function __compileQuery(query, type = 1) {
    const c = __R.category.code|__R.language.code|__R.title.code;

    if (query._id) {
        if (type == 1) return { _id: query._id };
        else throw new UnexpectedData(0xffff);
    }

    let dcode = __checkData(query, c);

    if (dcode&0xff00 || (type == 1 && (dcode&c != c)))
        throw new UnexpectedData(0xffff);

    if (!dcode) return {};

    let data = {};

    if (dcode&__R.category.code)
        data.category = query.category;

    if (dcode&__R.language.code)
        data.language = query.language;

    if (dcode&__R.title.code)
        data.title = query.title;

    return data;
}



const __handler = new Handler("Articles", __S);


function __clean(data) {

    let toDelete = [ data.image ];
    let found    = data.content.match(new RegExp("<img src=\"" + directory.route + "/[0-9a-z]{48}(\.[a-z]{0,4})?\"", "g"));

    if (found) {
        for (let i = 0; i < found.length; ++i) {
            toDelete.push(found[i].split('"')[1]);
        }
    }

    for (let i = 0; i < toDelete.length; ++i) {
        System.removeInternal(toDelete[i]);
    }
}


class DBArticleProvider {

    async createOne(data) {
        data = await __compileOne(data);

        if (!await this.readOne({ title: data.title, category: data.category, language: data.language })) {
            return await __handler.createOne(await __compileOne(data), true);
        } else {
            __clean(data);
            throw new DBArticleProviderError("Not unique article");
        }
    }

    async createMany(data_array) {

        if (data_array instanceof Array) {

            let promises = [];

            for (let i = 0; i < data_array.length; ++i) {
                data_array[i] = await __compileOne(data_array[i]);
                promises.push(this.readOne(data.title, data.category, data.language));
            }

            for (let i = 0; i < promises.length; ++i) {
                if (await promises[i]) {
                    throw new DBArticleProviderError("Not unique article");
                }
            }

        } else {
            throw new DBArticleProviderError("Invalid argument");
        }

        return await __handler.createMany(data_array);
    }

    async readOne(query) {
        return await __handler.readOne(__compileQuery(query));
    }

    async readMany(query, limit = 0, page = 0, offset = 0, display = 0, tag = undefined) {
        query = __compileQuery(query, 2);

        if (display != 0) query.display = display > 0;
        if (tag)          query.tags    = tag;

        return await __handler.readMany(query, limit, page, offset);
    }

    async updateOne(query, data, type = 0) {
        const c = [
            __R.content.code | __R.author.code   | __R.image.code    | __R.tags.code,
            __R.title.code   | __R.language.code | __R.category.code | __R.display.code
        ]

        let dcode = __checkData(data);

        if (dcode && (dcode&c[type]) == dcode) {
            return await __handler.updateOne(__compileQuery(query), data);
        } else {
            throw new DBArticleProviderError("Unsupported updateOne request");
        }
    }

    async updateMany(query, data) {
        let dcode = 0;

        if ((dcode = __checkData(data)) && (dcode&__R.display.code == dcode)) {
            return await __handler.updateMany(__compileQuery(query, 2), data);
        } else {
            throw new DBArticleProviderError("Unsupported updateMany request");
        }
    }

    async deleteOne(query) {
        query    = __compileQuery(query);
        let data = await this.readOne(query);

        if (data) {
            __clean(data);
            return await __handler.deleteOne(query);
        } else return 0;
    }

    async deleteMany(query, limit = 0, page = 0, offset = 0, display = 0, tag = undefined) {

        query = __compileQuery(query, 2);

        if (display != 0) query.display = display > 0;
        if (tag)          query.tags    = tag;

        let data = await __handler.readMany(query, limit, page, offset);

        if (data && data.length) {
            for (let i = 0; i < data.length; ++i) {
                __clean(data[i]);
            }

            return await __handler.deleteMany(query);
        } else return 0;
    }

    async translateOne(query, data) {

        let target = await __handler.readOne((query = __compileQuery(query)));

        if (!target) {
            throw DBArticleProviderError("Nothing to translate");
        }

        if (!target._gid) {
            await __handler.updateOne(query, { _gid: target._id });
            target._gid = target._id;
        }

        data = await __compileOne(data);
        data._gid = target._gid;

        if (!await __handler.readOne({ title: data.title, category: data.category, language: data.language })) {
            return await __handler.createOne(data, true);
        } else {
            throw new DBArticleProviderError("Not unique article");
        }
    }

    constructor() { }
}

module.exports = new DBArticleProvider();
