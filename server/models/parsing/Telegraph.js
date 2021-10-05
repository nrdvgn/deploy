#!/usr/bin/env node

const System      = require("../System");
const Article     = require("../../views/Article");
const ServerError = require("../errors/ServerError");


class TelegraphError extends ServerError {
    constructor(message, e = undefined) {
        super("TelegraphError", message, 500);
        super.log(e);
    };
}


const __table = {
    b:      Article.BlockFormat.strong,
    strong: Article.BlockFormat.strong,
    i:      Article.BlockFormat.cursive,
    em:     Article.BlockFormat.cursive,
    u:      Article.BlockFormat.underline,
    ins:    Article.BlockFormat.underline,
    s:      Article.BlockFormat.strike,
    strike: Article.BlockFormat.strike,
    del:    Article.BlockFormat.strike,
    a:      Article.BlockFormat.link,
    q:      Article.BlockFormat.quote,
};

async function __fetchArticle(url) {
    let content = await System.fetchExternal(url);

    try {
        content = (await content.text()).trim().match(/<article[^>]+>(.+)<\/article>/)[1];
    } catch (e) { throw new TelegraphError("Error was occurred with trying of fetching content", e); }


    content = content.replace(/<br[^>]*>\s*<\/(address|h\d|p|blockquote)>/g,"</$1>").
                      replace(/<p>(<br>)?<\/p>/g, "").
                      replace(/<hr>([^<]*<\/hr>)?/g, "").
                      replace(/<br[^>]*>/g, "\x19").
                      replace(/<(h\d|address|p|ul|ol|blockquote) [^>]+>/g, "<$1>");

    // Delete local links
    content = content.replace(/<p[^>]*>[^<]*<a[^>]+href=\"\/[^>]+>[^<]+<\/a>[^<]*<\/p>/g, "");
    content = content.replace(/<a[^>]+href=\"\/[^>]+>[^<]+<\/a>/g, "");

    // Delete article footer
    content = content.replace(/<figure><img[^>]+><figcaption><\/figcaption><\/figure>$/, "")

    return content;
}


function __fetchIFrameLink(src) {
    src = src.split("?url=");
    if (src.length == 2) {
        return decodeURIComponent(src[1]);
    } else return "";
}



function __fetchIndexes(src, begin, end) {

    let tag     = undefined;
    let indexes = {
        tag_b: begin,
        tag_e: begin,
        begin: begin,
        end:   begin
    }

    if (end != 0) src = src.slice(0, end);

    while (src[begin] && src[begin++] != "<") {}

    if (!src[begin])
        return undefined;

    while (src.charCodeAt(begin) <= 0x20) { ++begin; } // <-- UNSAFE

    indexes.tag_b = begin;

    while (src[++begin] != ">") {
        if ((src.charCodeAt(begin) < 0x61 || src.charCodeAt(begin) > 0x7a)
        &&  (src.charCodeAt(begin) < 0x31 || src.charCodeAt(begin) > 0x36))
            break;
    }

    indexes.tag_e = begin;

    while (src[begin++] != ">") {}

    indexes.begin = begin;
    tag           = src.slice(indexes.tag_b, indexes.tag_e);

    do {
        while (src[(end = begin++)] && src[end] != "<") {}

        if (src[begin++] === "/") { // <-- UNSAFE
            if (src.slice(begin, begin + tag.length) === tag) {
                break;
            }
        }

    } while (src[begin]);


    if (src[begin]) {
        indexes.end = end;
        return indexes;
    } else return undefined;
}

function __getBlockModel(bslice, format = Article.BlockFormat.empty) {

    let b     = 0;
    let e     = 0;
    let link  = undefined;
    let model = [];
    let mask  = undefined;

    for (; e < bslice.length; ) {

        mask = 0;

        if (bslice[e] === "<") {

            if (b != e) {
                model.push({
                    content: bslice.slice(b,e),
                    format:  format,
                    link:    link
                });

                if (link) link = undefined;
            }

            b = ++e;

            while (bslice[++e] && bslice[e] != ">") {}

            if (bslice[b] === "/") {
                mask = __table[bslice.slice(++b,e).match(/[a-z]+/)];
                if (mask) {
                    format &= ~mask;
                }
            } else {
                let l = bslice.slice(b,e);
                let t = l.match(/[a-z]+/);

                if (t == "a") {
                    link    = l.match(/href="?([^"\s]+)"?/)[1];
                    format |= Article.BlockFormat.link;
                } else {
                    mask = __table[t];
                    if (mask) format |= mask;
                }
            }

            b = ++e;

        } else ++e;
    }

    if (b != e) {
        model.push({
            content: bslice.slice(b,e),
            format:  format,
            link:    link
        });
    }

    return model;
}

function __parseBlock(content, tag) {

    let format = Article.BlockFormat.empty;

    switch (tag) {
        case "h3":    tag = "h2";         break;
        case "h4":    tag = "h3";         break;
        case "aside": tag = "blockquote"; break;
        case "blockquote":
            format = Article.BlockFormat.quote;
            tag    = "p";
            break;

        default: break;
    }

    let model = __getBlockModel(content, format);
    let block = new Article.Block(tag);

    for (let i = 0; i < model.length; ++i) {
        block.append(model[i].content, model[i].format, model[i].link);
    }

    let b = block.toString();

    return b;
}

function __parseList(content, tag) {

    let i    = 0;
    let data = "";

    while ((i = __fetchIndexes(content, i, 0))) {

        if (content.slice(i.tag_b, i.tag_e) === "li") { // <-- it is not support other (second level) tags inside lists
            data += __parseBlock(content.slice(i.begin, i.end), "li");
        }

        i = ++i.end;
    }

    return "<" + tag + ">" + data + "</" + tag + ">";
}


async function __parseFigure(content, tag) {

    let data = content.match(/<\s*(\S+)[^>]+src="?([^"]+)"?/);
    let link = "";

    if (!data || !data[1] || !data[2]) return "";

    let description = content.match(/<figcaption>([^<]+)<\/figcaption>/);

    if (description && description[1])
         description = description[1];
    else description = "";

    let type = undefined;


    if (data[1] == "img") {
        type = Article.FigureType.img;
        link = await System.downloadExternal("https://telegra.ph/" + data[2]);
    } else if (data[1] == "video") {
        type = Article.FigureType.video;
        link = await System.downloadExternal("https://telegra.ph/" + data[2]);
    } else if (data[1] == "iframe") {
        type = Article.FigureType.iframe;
        link = __fetchIFrameLink(data[2])
    } else return ""; // <-- unexpected case

    let fig = new Article.Figure(type, link, description);

    return fig.toString();
}


class TelegraphParser {

    #article = undefined;
    #context = undefined;
    #data    = undefined;
    #cur     = undefined;
    #end     = undefined;
    #title   = undefined;
    #author  = undefined;


    #nextContext = () => {

        if (this.#context) {
            while (this.#article[++this.#end] != ">") {} // <-- get end of </tag[>]
            this.#cur = this.#end;
        }

        let indexes = __fetchIndexes(this.#article, this.#cur, 0);

        if (indexes) {
            this.#context = this.#article.slice(indexes.tag_b, indexes.tag_e);
            this.#cur     = indexes.begin;
            this.#end     = indexes.end;
            return true;
        } else return false;
    }


    async getAuthor() {
        if (!this.#data) {
            await this.toString();
        }

        return this.#author;
    }

    async getTitle() {
        if (!this.#data) {
            await this.toString();
        }

        return this.#title;
    }

    async getImage() {
        if (!this.#data) {
            await this.toString();
        }

        let d = this.#data.match(/<img src="([^"]+)" \/>/);
        if (d) return d[1];
        else   return "";
    }

    async toString() {

        if (this.#data) return this.#data;

        this.#article = await this.#article;
        this.#data    = "";


        while (this.#nextContext()) {
            let content = this.#article.slice(this.#cur, this.#end);

            switch (this.#context) {
                case "h1":
                    this.#title = content.replace(/<[^>]+>/g," ").replace(/\s+/g, " ");
                    let b = __parseBlock(content, this.#context);
                    this.#data += b;
                    break;

                case "address": // author only
                    this.#author = content.split("|")[0].trim();
                    if (this.#author[0] === '@') {
                        this.#author = "Anonymous"
                    }
                    break;

                case "p":
                case "h3":
                case "h4":
                case "blockquote":
                case "aside":
                    this.#data += __parseBlock(content, this.#context);
                    break;

                case "ul":
                case "ol":
                    this.#data += __parseList(content, this.#context);
                    break;

                case "figure":
                    this.#data += await __parseFigure(content, this.#context);
                    break;

                default: throw new TelegraphError("Unsupported tag")
            }
        }

        return (this.#data = this.#data.replace(/\x19/g, "<br />"));
    }

    constructor(url) {
        this.#article = __fetchArticle(url);
        this.#cur  = 0;
    }
}



if (process.argv[1] === __filename) { // <-- TEST

    async function main() {
        let p = new TelegraphParser("https://telegra.ph/Data-model-test-06-25");
        console.log(await p.toString());
    }

    main().then(() => process.exit(0));

} else module.exports = TelegraphParser;
