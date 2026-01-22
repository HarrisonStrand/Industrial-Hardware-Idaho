import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Legal.css";

export default function ReturnsExchanges() {
  const brand = useContext(BrandContext);

  const BRAND = brand?.brandName || "";
  const EMAIL = brand?.supportEmail || "";
  const PHONE = brand?.supportPhone || "";
  const HOURS = brand?.supportHours || "";
  const ADDR1 = brand?.supportAddressLine1 || "";
  const ADDR2 = brand?.supportAddressLine2 || "";
  const CITY = brand?.supportCityStateZip || "";

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Returns & Exchanges
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='row m-0'>
              <div className='legal-copy text-main'>
                <p className='mb-3'>
                  We want you to be satisfied with your purchase. This policy explains how returns
                  and exchanges work for online orders from{" "}
                  <span className='fw-semibold'>{BRAND}</span>.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Return window</h5>
                <p className='mb-3'>
                  Returns are accepted within <span className='fw-semibold'>30 days</span> of
                  delivery (or pickup), provided the item is unused, uninstalled, and in resalable
                  condition with original packaging.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Restocking fee</h5>
                <p className='mb-3'>
                  A <span className='fw-semibold'>5% restocking fee</span> may apply to eligible
                  returns. Shipping charges are not refundable (unless required by law or the return
                  is due to our error).
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Non-returnable items</h5>
                <ul className='legal-list'>
                  <li>Special order items</li>
                  <li>Cut-to-length / modified materials</li>
                  <li>Clearance / final sale items</li>
                  <li>Used items</li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Return eligibility</h5>
                <ul className='legal-list'>
                  <li>Items must be unused, uninstalled, and in resalable condition.</li>
                  <li>Original packaging, labels, and included parts must be intact.</li>
                  <li>Proof of purchase may be required.</li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>How to start a return</h5>
                <p className='mb-2'>
                  Contact us to request return instructions. Please include your order number and a
                  brief description of the return.
                </p>
                <ul className='legal-list'>
                  {EMAIL && (
                    <li>
                      Email: <span className='fw-semibold'>{EMAIL}</span>
                    </li>
                  )}
                  {PHONE && (
                    <li>
                      Phone: <span className='fw-semibold'>{PHONE}</span>
                    </li>
                  )}
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Return methods</h5>
                <ul className='legal-list'>
                  <li>
                    <span className='fw-semibold'>In-store return (local pickup items):</span> Bring
                    the item to our location during regular hours.
                  </li>
                  <li>
                    <span className='fw-semibold'>Ship-back return:</span> Return shipping is
                    typically the customer’s responsibility unless the return is due to our error.
                  </li>
                </ul>

                {(ADDR1 || CITY) && (
                  <>
                    <h5 className='legal-title text-uppercase mt-4'>Return address / local pickup</h5>
                    <p className='mb-2'>
                      <span className='fw-semibold'>{BRAND}</span>
                      <br />
                      {ADDR1}
                      {ADDR2 ? (
                        <>
                          <br />
                          {ADDR2}
                        </>
                      ) : null}
                      {CITY ? (
                        <>
                          <br />
                          {CITY}
                        </>
                      ) : null}
                    </p>
                    {HOURS ? (
                      <p className='text-muted small mb-0'>
                        Regular hours: <span className='fw-semibold'>{HOURS}</span>
                      </p>
                    ) : null}
                  </>
                )}

                <h5 className='legal-title text-uppercase mt-4'>Refund timing</h5>
                <p className='mb-3'>
                  After receiving and inspecting your return, refunds are typically processed within{" "}
                  <span className='fw-semibold'>5–10 business days</span>. Refunds are issued to the
                  original payment method when possible.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Damaged, missing, or incorrect items</h5>
                <p className='mb-0'>
                  If your order arrives damaged or incorrect, contact us promptly. Keep all packaging
                  and take photos if possible so we can help quickly.
                </p>

                <p className='text-muted small mt-3 mb-0'>
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContactBanner />
    </>
  );
}
