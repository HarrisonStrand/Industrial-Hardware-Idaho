export default function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const isAdmin =
    req.user.role === "admin" ||
    req.user.isAdmin === true ||
    req.user.admin === true;

  if (!isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}