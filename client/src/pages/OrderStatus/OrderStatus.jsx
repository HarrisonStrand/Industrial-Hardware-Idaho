import { useState } from "react";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./OrderStatus.css";

export default function OrderStatus() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-status-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Order Status
          </div>

          <div className='theme-status-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='text-main mb-3'>
              Enter your order details to request an update. (Order tracking integration can be added later.)
            </div>

            <form className='contact-form g-0 py-3' onSubmit={(e) => e.preventDefault()}>
              <div className='row g-3'>
                <div className='col-12 col-md-6'>
                  <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                    Order Number
                  </label>
                  <input
                    className='form-input form-control rounded-3 text-dark'
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                  />
                </div>

                <div className='col-12 col-md-6'>
                  <label className='form-input-label text-uppercase form-label text-main ps-0 ps-sm-2 mb-0'>
                    Email
                  </label>
                  <input
                    type='email'
                    className='form-input form-control rounded-3 text-dark'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className='col-12 text-end'>
                  <button
                    type='submit'
                    className='btn-main-cta rounded-3 text-uppercase fw-regular fs-5 py-3 text-main-light'>
                    Request Update
                  </button>
                </div>
              </div>
            </form>

            <div className='text-muted small'>
              Note: For backorders, we typically hold orders until complete unless you requested a partial shipment.
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
