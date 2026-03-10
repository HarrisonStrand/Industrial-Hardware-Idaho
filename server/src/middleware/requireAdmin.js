// server/middleware/requireAdmin.js
export default function requireAdmin(req, res, next) {
  // auth.js should have already set req.user
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  // Match your User model: you have isAdmin boolean in User.js
  if (req.user.isAdmin !== true) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}