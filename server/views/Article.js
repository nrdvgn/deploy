const config = require("../config").services.iframe || {};
const iframe = require("./IFrame");


const ArticleBlockFormat = Object.freeze({
    empty:     0x00,
    cursive:   0x01, // i
    strong:    0x02, // b
    strike:    0x04, // del
    underline: 0x08, // ins
    link:      0x10, // a
    quote:     0x20, // q
});

const ArticleFigureType = Object.freeze({
    iframe: 0x00,
    img:    0x01,
    video:  0x02,
});





class ArticleFigure {

    #type        = undefined;
    #description = undefined;
    #url         = undefined;

    toString() {

        let content = "";

        if (this.#url) {
            if (this.#type === "iframe") {
                content += iframe(this.#url);
            } else {
                if (this.#type === "video") {
                    content += "<video src=\"" + this.#url +
                               "\" controls width=\"" + (config.width || 640) +
                               "\" height=\"" + (config.height || 360) + "\"></video>";
                } else {
                    content += "<img src=\"" + this.#url + "\" />";
                }
            }
        }

        if (this.#description) {
            content += "<figcaption>" + this.#description + "</figcaption>";
        }

        return "<figure>" + content + "</figure>";
    }

    constructor (type, url, description = "") {
        this.#url         = url;
        this.#description = description;

        switch (type) {
            case ArticleFigureType.img:   this.#type = "img";    break;
            case ArticleFigureType.video: this.#type = "video";  break;
            default:                      this.#type = "iframe"; break;
        }
    }
}



class ArticleList {

    #data  = undefined;
    #dtype = undefined;

    append(part, format = ArticleBlockFormat.empty, data = undefined, isEnd = true) {

        this.#data[this.#data.length - 1].append(part, format, data);

        if (isEnd) {
            this.#data.push(new ArticleBlock("li"));
        }
    }

    toString() {

        let content = "";

        for (let i = 0; i < this.#data.length; ++i) {
            if (this.#data[i].isEmpty()) {
                content += this.#data[i].toString();
            }
        }

        return "<" + this.#dtype + ">" + content + "</" + this.#dtype + ">";
    }

    constructor(isNumerable) {
        this.#dtype = (isNumerable) ? "ol" : "ul";
        this.#data  = [ new ArticleBlock("li") ];
    }
}



class ArticleBlock  {

    static #getTags = (mask) => {
        const tags = { 0x01: "i", 0x02: "b", 0x04: "del", 0x08: "ins", 0x10: "a", 0x20: "q" };

        if (mask == 0) return [];

        let w    = [];
        let keys = Object.keys(ArticleBlockFormat);

        for (let i = 0; i < keys.length; ++i) {
            if (ArticleBlockFormat[keys[i]]&mask) {
                w.push(tags[ArticleBlockFormat[keys[i]]]);
            }
        }

        return w;
    }

    static #fetchTags = (old_mask, new_mask) => {

        // See: /docs/services/Telegraph Parser/NestingOfPFormat.jpg

        if (new_mask == old_mask)
            return {
                close: [],
                open:  []
            }

        if (new_mask >= old_mask)
            return {
                close: ArticleBlock.#getTags(old_mask),
                open:  ArticleBlock.#getTags(new_mask).reverse()
            }

        let mask = 0;
        let keys = Object.keys(ArticleBlockFormat).reverse();

        for (let i = 0; i < keys.length; ++i) {
            if (ArticleBlockFormat[keys[i]]&old_mask == ArticleBlockFormat[keys[i]]&new_mask) {
                mask |= ArticleBlockFormat[keys[i]];

            } else if (!mask) {
                return {
                    close: ArticleBlock.#getTags(old_mask),
                    open:  ArticleBlock.#getTags(new_mask).reverse()
                }
            } else break;
        }

        return {
            close: ArticleBlock.#getTags(old_mask&(~mask)),
            open:  ArticleBlock.#getTags(new_mask&(~mask)).reverse()
        }

    }



    #data  = undefined;
    #dtype = undefined;



    append(part, format = ArticleBlockFormat.empty, data = undefined) {

        let model = {
            content: part.trim(),
            format:  format,
            link:    data
        }

        this.#data.push(model);
    }



    isEmpty() { return this.#data.length == 0; }



    toString() {

        let content = "";
        let mask    = 0;

        for (let i = 0; i < this.#data.length; ++i) {
            let w = ArticleBlock.#fetchTags(mask, this.#data[i].format);
            mask  = this.#data[i].format;

            if (w.close.length > 0) {
                content += "</" + w.close.join("></") + ">";
            }

            if (this.#data[i].link && w.open.length > 0) {
                for (let j = 0; j < 2; ++j) {
                    if (w.open[j] == "a") {
                        w.open[j] += " href=\"" + this.#data[i].link + "\"";
                        break;
                    }
                }
            }

            if (w.open.length > 0) {
                content += " <" + w.open.join("><") + ">"
            }

            if (this.#data[i].content)
            content += this.#data[i].content;
        }

        let w = ArticleBlock.#fetchTags(mask, 0);

        if (w.close.length > 0) {
            content += "</" + w.close.join("></") + ">"
        }

        return "<" + this.#dtype + ">" + content.trim() + "</" + this.#dtype + ">";
    }



    constructor(block_type = "p") {
        this.#dtype = block_type;
        this.#data = [];
    }
}



class ArticleHeader extends ArticleBlock {

    constructor(level = 3) {
        switch (level) {
            default:
                level = 3;

            case 1:
            case 2:
            case 4:
            case 5:
            case 6:
                super("h" + level.toString());
                break;
        };
    }
}



class ArticleBlockquote extends ArticleBlock {
    constructor() { super("blockquote") }
}



module.exports = {
    Figure:      ArticleFigure,
    List:        ArticleList,
    Block:       ArticleBlock,
    Header:      ArticleHeader,
    Blockquote:  ArticleBlockquote,
    BlockFormat: ArticleBlockFormat,
    FigureType:  ArticleFigureType
};
