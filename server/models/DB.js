const mongoose = require('mongoose');
const DBError  = require("./errors/DBError")
const mongodb  = require("../config").mongodb;


class DBSchemaError extends DBError {
    constructor(e = undefined) {
        super("SchemaError", "Invalid db schema format");
        super.log(e);
    }
}

class DBHandleError extends DBError {
    constructor(operation, e = undefined) {
        super("HandleError", "The error was triggered by the operation \"" + operation + "\"");
        super.log(e);
    }
}

class DBConnectionError extends DBError {
    constructor(e = undefined) {
        super("ConnectionError", "Error was occured with db connection");
        super.log(e);
    }
}


if (mongoose.connection.readyState == 0) {
    mongoose.connect(mongodb.url, mongodb.options).then(null, (e) => {
        throw new DBConnectionError(e);
    });
}


async function __connection() {
    if (mongoose.connection.readyState != 1) {

        if (mongoose.connection.readyState == 0 || mongoose.connection.readyState == 3) {
            try {
                await mongoose.connect(mongodb.url, mongodb.options);
            } catch (e) {
                throw new DBConnectionError(e);
            }
        }

        while(mongoose.connection.readyState == 2) {}
    }
}


class DBHandler {

    #model = undefined

    async updateOne(query, change) {
        await __connection();
        try {
            return (await this.#model.updateOne(query, change)).nModified;
        } catch (e) { throw new DBHandleError("updateOne", e); }
    }

    async updateMany(query, change) {
        await __connection();
        try {
            return (await this.#model.updateMany(query, change)).nModified;
        } catch (e) { throw new DBHandleError("updateMany", e); }
    }

    async deleteOne(query) {
        await __connection();
        try {
            return (await this.#model.deleteOne(query)).deletedCount;
        } catch (e) { throw new DBHandleError("deleteOne", e); }
    }

    async deleteMany(query) {
        await __connection();
        try {
            return (await this.#model.deleteMany(query)).deletedCount;
        } catch (e) { throw new DBHandleError("deleteMany", e); }
    }

    async createOne(content) {
        await __connection();
        try {
            return Number(Boolean(await this.#model.create(content)));
        } catch (e) {
            if (e.name === "MongoError" && e.code == 11000) {
                throw new DBError("NotUniqueValue", "Trying to create existed value, which marked as unique");
            } else { throw new DBHandleError("create", e); }
        }
    }

    async createMany(content_array) {
        await __connection();

        let promises = [];
        let n        = 0;

        if (content_array instanceof Array) {
            for (let i = 0; i < content_array.length; ++i) {
                promises.push(this.createOne(content_array[i]));
            }
        }

        for (let i = 0; i < promises.length; ++i) {
            n += await promises[i];
        }

        return n;
    }

    async readOne(query, offset = 0) {
        await __connection();
        try {
            let r = await this.#model.find(query).skip(offset).limit(1);

            if (r.length > 0) {
                return r[0];
            } else return null;

        } catch (e) { throw new DBHandleError("find", e); }
    }

    async readMany(query, limit = 0, page = 0, offset = 0, sort = { date: -1 }) {
        await __connection();
        if (typeof(sort) !== "object") {
            sort = null;
        }

        offset += limit * page;

        try {
            if (sort) {
                if (limit == 0) {
                    return await this.#model.find(query).sort({date: -1}).skip(offset);
                } else {
                    return await this.#model.find(query).sort({date: -1}).skip(offset).limit(limit);
                }
            } else {
                if (limit == 0) {
                    return await this.#model.find(query).skip(offset);
                } else {
                    return await this.#model.find(query).skip(offset).limit(limit);
                }
            }
        } catch (e) { throw new DBHandleError("find", e); }
    }


    constructor(name, schema) {
        if (schema instanceof mongoose.Schema) {
            this.#model = mongoose.model(name, schema);
        } else if (typeof(schema) == "object") {
            try {
                this.#model = mongoose.model(name, mongoose.Schema(schema));
            } catch (e) { throw new DBSchemaError(e); }
        } else throw new DBSchemaError();
    }
}



module.exports = {
    DBHandler,
};
