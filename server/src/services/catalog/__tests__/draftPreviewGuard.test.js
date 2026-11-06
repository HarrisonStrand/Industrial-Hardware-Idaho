// Run: npm --prefix server run test:draft-preview   (no database: nothing here connects)
// Checks that in preview the driver's write methods are replaced by refusals and the HTTP guard refuses writes.
import test from "node:test";
import assert from "node:assert/strict";

process.env.CATALOG_PREVIEW = "drafts";
process.env.NODE_ENV = "development";
delete process.env.RENDER;
delete process.env.RENDER_SERVICE_ID;

const { default: mongoose } = await import("mongoose");
const { draftPreviewReadOnly, READ_ONLY_MESSAGE } = await import("../../../config/draftPreviewGuard.js");

test("in preview Mongoose builds no indexes and creates no collections", () => {
	assert.equal(mongoose.get("autoIndex"), false);
	assert.equal(mongoose.get("autoCreate"), false);
});

test("in preview every driver write method rejects without touching the database", async () => {
	const proto = mongoose.mongo.Collection.prototype;
	for (const method of ["insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne",
		"deleteMany", "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "bulkWrite", "createIndex", "drop"]) {
		await assert.rejects(() => proto[method].call({}), new RegExp(READ_ONLY_MESSAGE), method);
	}
	await assert.rejects(() => mongoose.mongo.Db.prototype.createCollection.call({}), new RegExp(READ_ONLY_MESSAGE));
	assert.equal(typeof proto.find, "function");
	assert.notEqual(proto.find.name, "refusedWrite", "reads are untouched");
});

test("the HTTP guard lets reads through and refuses every other method with 403", () => {
	for (const method of ["GET", "HEAD", "OPTIONS"]) {
		let passed = false;
		draftPreviewReadOnly({ method }, {}, () => { passed = true; });
		assert.equal(passed, true, method);
	}
	for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
		let status = 0;
		let body = null;
		const res = { status(code) { status = code; return this; }, json(data) { body = data; return this; } };
		draftPreviewReadOnly({ method }, res, () => assert.fail(`${method} must not pass`));
		assert.equal(status, 403, method);
		assert.deepEqual(body, { message: "read-only draft preview" });
	}
});
