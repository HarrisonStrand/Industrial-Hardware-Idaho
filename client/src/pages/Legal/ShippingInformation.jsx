import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Legal.css";

export default function ShippingInformation() {
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
            Shipping Information
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='row m-0'>
              <div className='legal-copy text-main'>
                <p className='mb-3'>
                  Below is shipping and delivery information for online orders from{" "}
                  <span className='fw-semibold'>{BRAND}</span>.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Processing time</h5>
                <p className='mb-3'>
                  Most in-stock orders are prepared within{" "}
                  <span className='fw-semibold'>1–2 business days</span>. Larger orders may require
                  additional handling time.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Backorders</h5>
                <p className='mb-2'>
                  If an item is out of stock, it may be backordered.{" "}
                  <span className='fw-semibold'>We typically hold orders until complete</span> so
                  everything ships together.
                </p>
                <p className='mb-3'>
                  If you would like a partial shipment, please contact us and we’ll do our best to
                  accommodate (additional shipping charges may apply).
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Delivery methods</h5>
                <ul className='legal-list'>
                  <li>
                    <span className='fw-semibold'>Standard carriers:</span> common parcel services for
                    most orders.
                  </li>
                  <li>
                    <span className='fw-semibold'>Local delivery (heavy orders):</span> For qualifying
                    heavy or bulky orders, we may deliver using our own van (availability and delivery
                    area may apply).
                  </li>
                  <li>
                    <span className='fw-semibold'>Freight / special handling:</span> For oversized items,
                    we may coordinate special delivery options when needed.
                  </li>
                  <li>
                    <span className='fw-semibold'>Local pickup:</span> Pick up your order at our
                    location during regular hours.
                  </li>
                </ul>

                {(ADDR1 || CITY) && (
                  <>
                    <h5 className='legal-title text-uppercase mt-4'>Local pickup</h5>
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

                <h5 className='legal-title text-uppercase mt-4'>Tracking</h5>
                <p className='mb-3'>
                  When your order ships, tracking details may be provided by email (if an email was
                  supplied at checkout).
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Delivery estimates</h5>
                <p className='mb-3'>
                  Delivery dates are estimates and may vary due to carrier delays, weather, or other
                  factors outside our control.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Questions?</h5>
                <p className='mb-0'>
                  For shipping questions, contact us
                  {EMAIL ? (
                    <>
                      {" "}
                      at <span className='fw-semibold'>{EMAIL}</span>
                    </>
                  ) : null}
                  {PHONE ? (
                    <>
                      {" "}
                      or <span className='fw-semibold'>{PHONE}</span>
                    </>
                  ) : null}
                  .
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
