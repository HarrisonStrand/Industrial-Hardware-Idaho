import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Legal.css";

export default function PrivacyPolicy() {
  const brand = useContext(BrandContext);

  const BRAND = brand?.brandName || "";
  const LEGAL = brand?.legalEntityName || "";
  const WEBSITE = brand?.websiteUrl || "";
  const EMAIL = brand?.supportEmail || "";
  const PHONE = brand?.supportPhone || "";
  const HOURS = brand?.supportHours || "";

  return (
    <>
      <div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
        <div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
          <div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
            Privacy Policy
          </div>

          <div className='theme-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
            <div className='row m-0'>
              <div className='legal-copy text-main'>
                <p className='mb-3'>
                  This Privacy Policy explains how <span className='fw-semibold'>{BRAND}</span>{" "}
                  (operated by <span className='fw-semibold'>{LEGAL}</span>) collects, uses, and
                  shares information when you visit or make a purchase from our website
                  {WEBSITE ? (
                    <>
                      {" "}
                      (<span className='fw-semibold'>{WEBSITE}</span>)
                    </>
                  ) : null}
                  .
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Information we collect</h5>
                <ul className='legal-list'>
                  <li>
                    <span className='fw-semibold'>Order information:</span> name, billing/shipping
                    address, phone, email, payment confirmation details, and items purchased.
                  </li>
                  <li>
                    <span className='fw-semibold'>Account information:</span> login credentials and
                    profile details you provide.
                  </li>
                  <li>
                    <span className='fw-semibold'>Device & usage data:</span> IP address, browser,
                    pages viewed, and interactions (via cookies and similar technologies).
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>How we use information</h5>
                <ul className='legal-list'>
                  <li>To process orders, payments, shipping, returns, and customer support.</li>
                  <li>To provide and improve our website, products, and services.</li>
                  <li>To communicate order updates, account updates, and service messages.</li>
                  <li>
                    To prevent fraud, protect our customers, and maintain security of our systems.
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>How we share information</h5>
                <p className='mb-2'>
                  We share information only as needed to run our business, including with:
                </p>
                <ul className='legal-list'>
                  <li>
                    <span className='fw-semibold'>Payment processors</span> to process transactions.
                  </li>
                  <li>
                    <span className='fw-semibold'>Shipping carriers</span> to deliver orders.
                  </li>
                  <li>
                    <span className='fw-semibold'>Service providers</span> (hosting, analytics, email)
                    who help operate the site.
                  </li>
                  <li>
                    <span className='fw-semibold'>Legal compliance</span> if required by law or to
                    protect rights and safety.
                  </li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Cookies</h5>
                <p className='mb-3'>
                  We use cookies and similar technologies to keep you signed in (if applicable),
                  remember cart contents, understand site usage, and improve performance. You can
                  disable cookies in your browser settings, but parts of the site may not function
                  correctly.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Data retention</h5>
                <p className='mb-3'>
                  We retain information as needed for order fulfillment, customer service, legal
                  obligations, dispute resolution, and enforcing agreements.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Security</h5>
                <p className='mb-3'>
                  We use reasonable safeguards to protect your information, but no method of
                  transmission or storage is 100% secure.
                </p>

                <h5 className='legal-title text-uppercase mt-4'>Your choices</h5>
                <ul className='legal-list'>
                  <li>You can update your account information in your profile (if available).</li>
                  <li>You can request access, correction, or deletion where applicable.</li>
                  <li>You can opt out of marketing emails (if we send them).</li>
                </ul>

                <h5 className='legal-title text-uppercase mt-4'>Contact</h5>
                <p className='mb-0'>
                  For privacy questions, contact{" "}
                  <span className='fw-semibold'>{BRAND}</span>
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
                  {HOURS ? (
                    <>
                      {" "}
                      (<span className='fw-semibold'>{HOURS}</span>)
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
