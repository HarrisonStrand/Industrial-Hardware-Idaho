import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const email = process.argv[2];
if (!email) {
  console.log('Usage: node src/scripts/makeAdmin.js "admin@ihidaho.com"');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { role: "admin" } },
      { new: true }
    );

    if (!user) {
      console.log("❌ User not found:", email);
      process.exit(1);
    }

    console.log("✅ Updated user:", {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
