// Draft preview safety. Imported by server.js right after
// env.js, before any model is compiled. With the flag off this module does nothing at all.
//
// In preview the local server may point at the production database, so every database write is
// refused at the MongoDB driver level, and Mongoose never builds indexes or creates collections.

import mongoose from "mongoose";
import { isDraftPreview } from "../services/catalog/draftPreview.js";

export const READ_ONLY_MESSAGE = "read-only draft preview";

const COLLECTION_WRITES = [
	"insertOne",
	"insertMany",
	"updateOne",
	"updateMany",
	"replaceOne",
	"deleteOne",
	"deleteMany",
	"findOneAndUpdate",
	"findOneAndReplace",
	"findOneAndDelete",
	"bulkWrite",
	"createIndex",
	"createIndexes",
	"dropIndex",
	"dropIndexes",
	"drop",
	"rename",
];
const DB_WRITES = ["createCollection", "dropCollection", "dropDatabase", "renameCollection"];

function refuse(target, methods, label) {
	for (const method of methods) {
		if (typeof target?.[method] !== "function") continue;
		target[method] = function refusedWrite() {
			const error = new Error(`${READ_ONLY_MESSAGE}: ${label}.${method} refused`);
			error.code = "DRAFT_PREVIEW_READ_ONLY";
			return Promise.reject(error);
		};
	}
}

if (isDraftPreview()) {
	mongoose.set("autoIndex", false);
	mongoose.set("autoCreate", false);
	refuse(mongoose.mongo.Collection.prototype, COLLECTION_WRITES, "collection");
	refuse(mongoose.mongo.Db.prototype, DB_WRITES, "db");
}

// Express middleware: in preview, refuse every request that is not a read.
export function draftPreviewReadOnly(req, res, next) {
	if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
	return res.status(403).json({ message: READ_ONLY_MESSAGE });
}
