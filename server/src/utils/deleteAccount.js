import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import User from "../models/User.js";
import { stripe } from "./stripe.js";
import { s3, S3_BUCKET } from "./s3.js";

// Erases a customer's account: saved card (Stripe customer), profile photo and
// the account itself. Orders are kept for the store's records; they hold their
// own copy of the name and addresses, and their old account id no longer
// matches any login. Returns the steps that could not be finished.
export async function deleteUserAccount(user) {
  const problems = [];

  const customerId = user.payment?.stripeCustomerId;
  if (customerId && stripe) {
    try {
      await stripe.customers.del(customerId);
    } catch (err) {
      problems.push(`stripe: ${err?.message || err}`);
    }
  }

  if (user.avatarKey && s3 && S3_BUCKET) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: user.avatarKey }));
    } catch (err) {
      problems.push(`avatar: ${err?.message || err}`);
    }
  }

  await User.deleteOne({ _id: user._id });
  return problems;
}
