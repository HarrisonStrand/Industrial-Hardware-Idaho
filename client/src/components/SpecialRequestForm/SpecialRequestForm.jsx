import { useState } from "react";
import "./SpecialRequestForm.css";

export default function SpecialRequestForm() {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    partName: "",
    partDescription: "",
    quantityNeeded: "",
    customerPO: "",
    contactName: "",
    companyName: "",
    phone: "",
    email: "",
    date: today
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const payload = {
      partName: formData.partName,
      partDescription: formData.partDescription,
      quantityNeeded: formData.quantityNeeded,
      customerPO: formData.customerPO,
      name: formData.contactName,
      company: formData.companyName,
      phone: formData.phone,
      email: formData.email,
      date: formData.date
    };

    try {
      const res = await fetch("/api/special-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to submit request");
      }

      setSuccess(true);
      setFormData({
        partName: "",
        partDescription: "",
        quantityNeeded: "",
        customerPO: "",
        contactName: "",
        companyName: "",
        phone: "",
        email: "",
        date: today
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className='contact-form g-0 py-3' onSubmit={handleSubmit}>
      <div className='row g-3'>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Part Name
          </label>
          <input
            type='text'
            name='partName'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.partName}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Quantity Needed
          </label>
          <input
            type='number'
            min='1'
            name='quantityNeeded'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.quantityNeeded}
            onChange={handleChange}
          />
        </div>

        <div className='col-12'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Part Description
          </label>
          <textarea
            name='partDescription'
            rows='5'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.partDescription}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Customer PO (optional)
          </label>
          <input
            type='text'
            name='customerPO'
            className='form-input form-control rounded-3 text-dark'
            value={formData.customerPO}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Date
          </label>
          <input
            type='date'
            name='date'
            className='form-input form-control rounded-3 text-dark'
            value={formData.date}
            disabled
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Company Name
          </label>
          <input
            type='text'
            name='companyName'
            className='form-input form-control rounded-3 text-dark'
            value={formData.companyName}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Customer Name / Title
          </label>
          <input
            type='text'
            name='contactName'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.contactName}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Phone Number
          </label>
          <input
            type='tel'
            name='phone'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.phone}
            onChange={handleChange}
          />
        </div>

        <div className='col-12 col-md-6'>
          <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
            Email
          </label>
          <input
            type='email'
            name='email'
            className='form-input form-control rounded-3 text-dark'
            required
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        {error && <div className='col-12 text-danger'>{error}</div>}
        {success && (
          <div className='col-12 text-success'>
            Your request has been sent successfully.
          </div>
        )}

        <div className='col-12 text-end'>
          <button
            type='submit'
            className='btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-3 text-main-light'
            disabled={loading}
          >
            {loading ? "Sending..." : "Submit Request"}
          </button>
        </div>

      </div>
    </form>
  );
}
