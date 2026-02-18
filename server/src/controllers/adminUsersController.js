import User from "../models/User.js";

export async function listUsers(req, res) {
  const users = await User.find({})
    .select("firstName lastName email role company account payment createdAt")
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
