import { useState } from "react";
import "./ContactForm.css";

export default function ContactForm() {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    contactName: "",
    companyName: "",
    phone: "",
    email: "",
    subject: "",
    message: "",
    date: today
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  setSuccess(false);

  const payload = {
    name: formData.contactName,
    company: formData.companyName,
    phone: formData.phone,
    email: formData.email,
    subject: formData.subject,
    message: formData.message,
    date: formData.date
  };

  try {
const res = await fetch("/api/contact", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  credentials: "include",
  body: JSON.stringify(payload)
});


    if (!res.ok) {
      // SAFELY handle non-JSON responses
      const text = await res.text();
      throw new Error(text || "Failed to send message");
    }

    setSuccess(true);
    setFormData({
      contactName: "",
      companyName: "",
      phone: "",
      email: "",
      subject: "",
      message: "",
      date: today
    });

  } catch (err) {
    setError(err.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
};



  return (
    <form className="contact-form g-0 py-3" onSubmit={handleSubmit}>
      <div className="row g-3">

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Contact Name
          </label>
          <input
            type="text"
            name="contactName"
            className="form-input form-control rounded-3 text-dark"
            required
            value={formData.contactName}
            onChange={handleChange}
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Company Name
          </label>
          <input
            type="text"
            name="companyName"
            className="form-input form-control rounded-3 text-dark"
            value={formData.companyName}
            onChange={handleChange}
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            className="form-input form-control rounded-3 text-dark"
            required
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Email
          </label>
          <input
            type="email"
            name="email"
            className="form-input form-control rounded-3 text-dark"
            required
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Date
          </label>
          <input
            type="date"
            name="date"
            className="form-input form-control rounded-3 text-dark"
            value={formData.date}
            disabled
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Subject
          </label>
          <input
            type="text"
            name="subject"
            className="form-input form-control rounded-3 text-dark"
            required
            value={formData.subject}
            onChange={handleChange}
          />
        </div>

        <div className="col-12">
          <label className="form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0">
            Message
          </label>
          <textarea
            name="message"
            rows="6"
            className="form-input form-control rounded-3 text-dark"
            required
            value={formData.message}
            onChange={handleChange}
          />
        </div>

        {error && (
          <div className="col-12 text-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="col-12 text-success">
            Your message has been sent successfully.
          </div>
        )}

        <div className="col-12 text-end">
          <button
            type="submit"
            className="btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-3 text-main-light"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </div>

      </div>
    </form>
  );
}
