import User from "../models/User.js";

export async function listUsers(req, res) {
  const users = await User.find({})
    .select("firstName lastName email phone role company account payment emailVerified createdAt")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ users });
}

export async function updateAccountApproval(req, res) {
  const { id } = req.params;
  const { approvedType, approvalStatus, rejectionReason = "" } = req.body || {};

  if (!["RETAIL", "NET30", "HOUSE"].includes(approvedType)) {
    return res.status(400).json({ error: "Invalid approvedType" });
  }

  if (!["NONE", "PENDING", "APPROVED", "REJECTED"].includes(approvalStatus)) {
    return res.status(400).json({ error: "Invalid approvalStatus" });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.account = user.account || {};
  user.account.approvedType = approvedType;
  user.account.approvalStatus = approvalStatus;

  if (approvalStatus === "APPROVED") {
    user.account.approvedAt = new Date();
    user.account.approvedBy = req.user.id;
    user.account.rejectionReason = "";
  }

  if (approvalStatus === "REJECTED") {
    user.account.rejectionReason = rejectionReason || "Not approved at this time.";
  }

  // If set back to Retail, clear request
  if (approvedType === "RETAIL") {
    user.account.requestedType = "RETAIL";
    if (approvalStatus === "APPROVED") user.account.approvalStatus = "NONE";
  }

  await user.save();

  res.json({ success: true });
}

// Set or clear one account's own price multiplier. null (or "") = follow the account type's multiplier.
export async function updatePriceMultiplier(req, res) {
  const raw = req.body?.priceMultiplier;
  const clearing = raw === null || raw === undefined || raw === "";
  const value = Number(raw);

  if (!clearing && (!Number.isFinite(value) || value < 0 || value > 10)) {
    return res.status(400).json({ error: "Price multiplier must be a number from 0 to 10, or empty to use the account type." });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.account) user.account = {};
  user.account.priceMultiplier = clearing ? null : Number(value.toFixed(4));
  await user.save();

  console.log(`ADMIN PRICE MULTIPLIER: user ${user._id} -> ${user.account.priceMultiplier ?? "type default"} (by ${req.user?.id})`);
  res.json({ success: true, priceMultiplier: user.account.priceMultiplier });
}
