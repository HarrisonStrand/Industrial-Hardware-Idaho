// Run: node --test src/services/catalog/__tests__/productImageVisibility.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import { hasProductImage, isListedForImage } from "../productImageVisibility.js";

test("a product with a picture URL is listed", () => {
	assert.equal(isListedForImage({ images: [{ url: "https://x/a.png" }] }), true);
});

test("a product with no picture, an empty list or a blank URL is hidden", () => {
	delete process.env.SHOW_PRODUCTS_WITHOUT_IMAGE;
	assert.equal(isListedForImage({}), false);
	assert.equal(isListedForImage({ images: [] }), false);
	assert.equal(isListedForImage({ images: [{ url: "" }] }), false);
	assert.equal(hasProductImage(null), false);
});

test("SHOW_PRODUCTS_WITHOUT_IMAGE=true lists them again", () => {
	process.env.SHOW_PRODUCTS_WITHOUT_IMAGE = "true";
	assert.equal(isListedForImage({}), true);
	delete process.env.SHOW_PRODUCTS_WITHOUT_IMAGE;
});
